import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * H-05 — el servidor pasa a ser la autoridad de precio y de conciliación
 * pago↔total en `POST /orders`.
 *
 * Antes `item.price` viajaba del cliente sin comparar contra el catálogo, y
 * nada exigía que `sum(payments)` cuadrara con `total` fuera de layaway/
 * crédito — una venta podía marcarse `paymentStatus: PAID` cobrando $0.
 */

const TENANT = 'tenant-1';
const PRODUCT_PRICE = 1000;

interface PaymentSplit {
  method: string;
  amount: number;
  currency?: 'MXN' | 'USD';
}

function build(allowedPermissions: string[] = []) {
  const orderCreate = jest.fn().mockResolvedValue({ id: 'order-1' });
  const paymentCreate = jest.fn().mockResolvedValue({ id: 'pay-1' });
  const cashMovementCreate = jest.fn().mockResolvedValue({ id: 'cm-1' });
  const auditLog = jest.fn();
  const consume = jest.fn();

  const tx = {
    order: {
      create: orderCreate,
      findUnique: jest.fn().mockResolvedValue({ id: 'order-1', total: PRODUCT_PRICE }),
    },
    orderItem: { create: jest.fn().mockResolvedValue({}) },
    payment: { create: paymentCreate },
    customer: { update: jest.fn().mockResolvedValue({}) },
    accountReceivable: { create: jest.fn().mockResolvedValue({ id: 'ar-1' }) },
    cashMovement: { create: cashMovementCreate },
    cashSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1', status: 'ABIERTA' }) },
  };

  const prisma = {
    customer: { findFirst: jest.fn() },
    product: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'p1', name: 'Producto', sku: 'SKU1', price: PRODUCT_PRICE, taxRate: null, categoryId: null, recipe: null },
      ]),
    },
    service: { findMany: jest.fn().mockResolvedValue([]) },
    tenant: { findUnique: jest.fn().mockResolvedValue({ settings: {} }) },
    cashSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1', status: 'ABIERTA', exchangeRateUsdMxn: 20 }) },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const service = new OrdersService(
    prisma as never,
    { getUserId: () => 'user-1' } as never,
    { requireTenantId: () => TENANT, getBranchId: () => 'branch-1' } as never,
    { validateCoupon: jest.fn(), incrementUsage: jest.fn(), getAutoApplicableCoupons: jest.fn() } as never,
    { log: auditLog } as never,
    { consume, restore: jest.fn(), validate: jest.fn() } as never,
    { actorHas: jest.fn((key: string) => Promise.resolve(allowedPermissions.includes(key))) } as never,
  );

  return { service, orderCreate, paymentCreate, cashMovementCreate, auditLog };
}

function saleWithPrice(price: number, payments: PaymentSplit[]) {
  const primary = payments.find((p) => p.method !== 'CREDITO')?.method ?? payments[0].method;
  return {
    items: [{ productId: 'p1', quantity: 1, price }],
    paymentMethod: primary,
    payments,
  } as never;
}

function saleWithDiscount(discount: number, payments: PaymentSplit[]) {
  const primary = payments.find((p) => p.method !== 'CREDITO')?.method ?? payments[0].method;
  return {
    items: [{ productId: 'p1', quantity: 1, price: PRODUCT_PRICE, discount }],
    paymentMethod: primary,
    payments,
  } as never;
}

describe('OrdersService.create — H-05: precio de catálogo', () => {
  it('rechaza un precio distinto al de catálogo sin orders:price-override', async () => {
    const { service } = build([]);

    await expect(
      service.create(saleWithPrice(1, [{ method: 'CASH', amount: 1 }])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('con orders:price-override, acepta el precio distinto y lo audita', async () => {
    const { service, orderCreate, auditLog } = build(['orders:price-override']);

    await service.create(saleWithPrice(1, [{ method: 'CASH', amount: 1 }]));

    expect(orderCreate).toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_PRICE_OVERRIDE',
        after: expect.objectContaining({
          overrides: [expect.objectContaining({ productId: 'p1', catalogPrice: PRODUCT_PRICE, chargedPrice: 1 })],
        }),
      }),
    );
  });

  it('el precio de catálogo exacto nunca dispara el chequeo (no llama actorHas ni audita)', async () => {
    const { service, auditLog } = build([]);

    await service.create(saleWithPrice(PRODUCT_PRICE, [{ method: 'CASH', amount: PRODUCT_PRICE }]));

    expect(auditLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_PRICE_OVERRIDE' }),
    );
  });
});

describe('OrdersService.create — H-05: conciliación pago↔total', () => {
  it('rechaza si sum(payments) no cuadra con el total (venta no-crédito, no-layaway)', async () => {
    const { service } = build([]);

    await expect(
      service.create(saleWithPrice(PRODUCT_PRICE, [{ method: 'CASH', amount: 0 }])),
    ).rejects.toThrow(/no coincide con el total/);
  });

  it('acepta y marca PAID cuando el pago cuadra exacto, ignorando dto.paymentStatus', async () => {
    const { service, orderCreate } = build([]);

    const dto = saleWithPrice(PRODUCT_PRICE, [{ method: 'CASH', amount: PRODUCT_PRICE }]);
    await service.create({ ...(dto as object), paymentStatus: 'PENDING' } as never);

    expect(orderCreate.mock.calls[0][0].data.paymentStatus).toBe('PAID');
  });

  it('un pago de más también se rechaza (no solo de menos)', async () => {
    const { service } = build([]);

    await expect(
      service.create(saleWithPrice(PRODUCT_PRICE, [{ method: 'CASH', amount: PRODUCT_PRICE + 500 }])),
    ).rejects.toThrow(/no coincide con el total/);
  });

  it('venta 100% crédito no exige conciliación (va a CxC, no a caja)', async () => {
    const { service, orderCreate } = build([]);

    await service.create(saleWithPrice(PRODUCT_PRICE, [{ method: 'CREDITO', amount: 0 }]));

    expect(orderCreate).toHaveBeenCalled();
  });

  it('layaway con depósito parcial no exige conciliación', async () => {
    const { service, orderCreate } = build([]);

    const dto = { ...(saleWithPrice(PRODUCT_PRICE, [{ method: 'CASH', amount: 200 }]) as object), isLayaway: true };
    await service.create(dto as never);

    expect(orderCreate).toHaveBeenCalled();
    expect(orderCreate.mock.calls[0][0].data.paymentStatus).toBe('PARTIALLY_PAID');
  });
});

describe('OrdersService.create — H-05 (re-auditoría): descuento manual', () => {
  it('rechaza un descuento manual sin orders:discount-override (variante del fraude de $0)', async () => {
    const { service } = build([]);

    // Descuenta el total completo: si esto pasara, la venta cobraría $0 y
    // paidNow(0) === total(0) cuadraría igual — el mismo fraude que el precio.
    await expect(
      service.create(saleWithDiscount(PRODUCT_PRICE, [{ method: 'CASH', amount: 0 }])),
    ).rejects.toThrow(/descuento manual/);
  });

  it('con orders:discount-override, acepta el descuento y lo audita', async () => {
    const { service, orderCreate, auditLog } = build(['orders:discount-override']);

    await service.create(saleWithDiscount(PRODUCT_PRICE, [{ method: 'CASH', amount: 0 }]));

    expect(orderCreate).toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_DISCOUNT_OVERRIDE',
        after: expect.objectContaining({
          overrides: [expect.objectContaining({ label: 'Producto', discount: PRODUCT_PRICE })],
        }),
      }),
    );
  });

  it('sin descuento (discount: 0 o ausente) nunca dispara el chequeo', async () => {
    const { service, auditLog } = build([]);

    await service.create(saleWithPrice(PRODUCT_PRICE, [{ method: 'CASH', amount: PRODUCT_PRICE }]));

    expect(auditLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_DISCOUNT_OVERRIDE' }),
    );
  });

  it('tener orders:price-override no basta para descontar (son permisos independientes)', async () => {
    const { service } = build(['orders:price-override']);

    await expect(
      service.create(saleWithDiscount(PRODUCT_PRICE, [{ method: 'CASH', amount: 0 }])),
    ).rejects.toThrow(/descuento manual/);
  });
});
