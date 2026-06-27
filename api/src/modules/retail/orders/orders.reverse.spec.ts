import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * P0 — Estabilización crítica del vertical Retail.
 *
 * P0-02: la reversa (cancel/return) tras un reembolso parcial NO debe restaurar
 *        de nuevo inventario ni volver a sacar efectivo ya devuelto.
 * P0-01: OrdersService.create debe rechazar referencias cross-tenant de
 *        Product / Customer / Service antes de crear la venta.
 *
 * Servicio construido con mocks directos para aislar la lógica de Nest DI.
 * NO toca InventoryConsumptionEngine ni OrderCheckoutEngine.
 */

// ───────────────────────── P0-02: reversa sin doble restauración ──────────────

interface ReverseOpts {
  refunds?: { amount: number; items: { orderItemId: string; quantity: number }[] }[];
  orderMovements?: Record<string, unknown>[];
  refundMovements?: Record<string, unknown>[];
}

function buildReverseService(opts: ReverseOpts = {}) {
  const {
    refunds = [],
    orderMovements = [
      {
        type: 'SALE',
        currency: 'MXN',
        amount: 200,
        amountMxnEquivalent: null,
        amountOriginalCurrency: null,
        exchangeRateUsed: null,
        paymentMethod: 'CASH',
      },
    ],
    refundMovements = [],
  } = opts;

  const order = {
    id: 'order-1',
    orderNumber: 'V-1',
    status: 'DELIVERED',
    paymentStatus: 'PARTIALLY_REFUNDED',
    branchId: 'branch-1',
    customerId: null,
    total: 200,
    items: [
      { id: 'oi1', productId: 'p1', itemType: 'PRODUCT', quantity: 2 },
      { id: 'oi2', productId: 'p2', itemType: 'PRODUCT', quantity: 1 },
    ],
    payments: [{ amount: 200, paymentMethod: 'CASH', status: 'PAID' }],
    refunds,
    accountReceivable: null,
  };

  const cashMovementCreate = jest.fn().mockResolvedValue({ id: 'cm-rev' });
  const restore = jest.fn();

  const tx = {
    inventory: undefined,
    cashSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1' }) },
    cashMovement: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { referenceType: unknown } }) => {
        const rt = where.referenceType;
        if (rt === 'REFUND') return Promise.resolve(refundMovements);
        return Promise.resolve(orderMovements); // { in: ['ORDER','CHANGE_OUT'] }
      }),
      create: cashMovementCreate,
    },
    accountReceivable: { update: jest.fn(), delete: jest.fn() },
    customer: { update: jest.fn() },
    order: {
      update: jest.fn().mockResolvedValue({ id: 'order-1', status: 'REFUNDED', paymentStatus: 'REFUNDED' }),
    },
  };

  const prisma = {
    order: { findFirst: jest.fn().mockResolvedValue(order) },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const inventory = { restore, consume: jest.fn(), validate: jest.fn() };
  const service = new OrdersService(
    prisma as never,
    { getUserId: () => 'user-1' } as never,
    { requireTenantId: () => 'tenant-1', getBranchId: () => 'branch-1' } as never,
    { getAutoApplicableCoupons: jest.fn() } as never,
    { log: jest.fn() } as never,
    inventory as never,
  );

  return { service, restore, cashMovementCreate };
}

describe('OrdersService.reverseOrder (P0-02 — sin doble restauración)', () => {
  it('Caso 1: venta → refund parcial → reverse no restaura de nuevo lo ya reembolsado', async () => {
    // oi1 vendió 2, ya reembolsada 1 → reversa solo repone 1 de oi1 y 1 de oi2.
    // Caja: venta 200, refund previo 80 → reversa solo saca 120 (no 200).
    const { service, restore, cashMovementCreate } = buildReverseService({
      refunds: [{ amount: 80, items: [{ orderItemId: 'oi1', quantity: 1 }] }],
      refundMovements: [
        { type: 'EXPENSE', currency: 'MXN', amount: 80, amountMxnEquivalent: null, paymentMethod: 'CASH' },
      ],
    });

    await service.returnOrder('order-1', 'devolución');

    // Inventario: remanente neto, NO el total vendido.
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore.mock.calls[0][1]).toEqual([
      { productId: 'p1', itemType: 'PRODUCT', quantity: 1 },
      { productId: 'p2', itemType: 'PRODUCT', quantity: 1 },
    ]);

    // Caja: una sola reversa por el remanente (120), no por el total (200).
    expect(cashMovementCreate).toHaveBeenCalledTimes(1);
    const movData = cashMovementCreate.mock.calls[0][0].data;
    expect(movData.type).toBe('EXPENSE');
    expect(movData.amount).toBe(120);
  });

  it('Caso 1b (control): sin refund previo la reversa repone todo y saca el efectivo completo', async () => {
    const { service, restore, cashMovementCreate } = buildReverseService();

    await service.cancelOrder('order-1', 'cancelación');

    expect(restore.mock.calls[0][1]).toEqual([
      { productId: 'p1', itemType: 'PRODUCT', quantity: 2 },
      { productId: 'p2', itemType: 'PRODUCT', quantity: 1 },
    ]);
    expect(cashMovementCreate).toHaveBeenCalledTimes(1);
    expect(cashMovementCreate.mock.calls[0][0].data.amount).toBe(200);
  });

  it('Caso 1c: reembolso total previo → la reversa no repone stock ni saca efectivo', async () => {
    const { service, restore, cashMovementCreate } = buildReverseService({
      refunds: [
        {
          amount: 200,
          items: [
            { orderItemId: 'oi1', quantity: 2 },
            { orderItemId: 'oi2', quantity: 1 },
          ],
        },
      ],
      refundMovements: [
        { type: 'EXPENSE', currency: 'MXN', amount: 200, amountMxnEquivalent: null, paymentMethod: 'CASH' },
      ],
    });

    await service.returnOrder('order-1', 'ya reembolsada');

    // Nada que restaurar (lista vacía) y cero nuevas salidas de caja.
    expect(restore.mock.calls[0][1]).toEqual([]);
    expect(cashMovementCreate).not.toHaveBeenCalled();
  });
});

// ───────────────────────── P0-01: aislamiento multi-tenant en create ──────────

function buildCreateService(prismaOverrides: Record<string, unknown>) {
  const transaction = jest.fn();
  const prisma = {
    customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', addresses: [] }) },
    product: { findMany: jest.fn().mockResolvedValue([]) },
    service: { findMany: jest.fn().mockResolvedValue([]) },
    tenant: { findUnique: jest.fn().mockResolvedValue({ settings: {} }) },
    cashSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1', exchangeRateUsdMxn: 20 }) },
    $transaction: transaction,
    ...prismaOverrides,
  };

  const service = new OrdersService(
    prisma as never,
    { getUserId: () => 'user-1' } as never,
    { requireTenantId: () => 'tenant-1', getBranchId: () => 'branch-1' } as never,
    { getAutoApplicableCoupons: jest.fn(), validateCoupon: jest.fn() } as never,
    { log: jest.fn() } as never,
    { consume: jest.fn(), restore: jest.fn(), validate: jest.fn() } as never,
  );

  return { service, transaction };
}

describe('OrdersService.create (P0-01 — aislamiento multi-tenant)', () => {
  it('Caso 2: producto de otro tenant → NotFound y la venta nunca se crea', async () => {
    const { service, transaction } = buildCreateService({
      // product.findMany filtra por tenantId → no encuentra el producto ajeno.
      product: { findMany: jest.fn().mockResolvedValue([]) },
    });

    await expect(
      service.create({
        items: [{ productId: 'p-otro-tenant', quantity: 1, price: 100 }],
        paymentMethod: 'CASH',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('Caso 3: cliente de otro tenant → NotFound y la venta nunca se crea', async () => {
    const { service, transaction } = buildCreateService({
      customer: { findFirst: jest.fn().mockResolvedValue(null) }, // filtrado por tenant
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p1', name: 'Prod', sku: 'S1', taxRate: null, categoryId: null, recipe: null },
        ]),
      },
    });

    await expect(
      service.create({
        customerId: 'c-otro-tenant',
        items: [{ productId: 'p1', quantity: 1, price: 100 }],
        paymentMethod: 'CASH',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('Caso 4: servicio de otro tenant → NotFound y la venta nunca se crea', async () => {
    const { service, transaction } = buildCreateService({
      service: { findMany: jest.fn().mockResolvedValue([]) }, // filtrado por tenant
    });

    await expect(
      service.create({
        items: [{ itemType: 'SERVICE', serviceId: 'svc-otro-tenant', name: 'X', quantity: 1, price: 50 }],
        paymentMethod: 'CASH',
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
