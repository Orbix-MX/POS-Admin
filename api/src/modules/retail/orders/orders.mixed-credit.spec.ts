import { OrdersService } from './orders.service';

/**
 * P1-02 — AccountReceivable en pagos mixtos (Retail).
 *
 * Una venta a crédito debe generar la CxC por el SALDO realmente financiado
 * (total − pagos inmediatos), no por el total. paidNow ya excluye los CREDITO,
 * así que la CxC = remainingBalance. Espejo de la lógica de apartados.
 *
 * Construido con mocks directos. NO toca OrderCheckoutEngine ni
 * InventoryConsumptionEngine (inventory es mock no-op).
 */

const TENANT = 'tenant-1';
const CUSTOMER = 'c1';

interface PaymentSplit {
  method: string;
  amount: number;
  currency?: 'MXN' | 'USD';
}

/** Service de create con la transacción completa cableada y captura de las
 *  llamadas a accountReceivable.create / order.create / inventory.consume. */
function build() {
  const arCreate = jest.fn().mockResolvedValue({ id: 'ar-1' });
  const orderCreate = jest.fn().mockResolvedValue({ id: 'order-1' });
  const paymentCreate = jest.fn().mockResolvedValue({ id: 'pay-1' });
  const cashMovementCreate = jest.fn().mockResolvedValue({ id: 'cm-1' });
  const consume = jest.fn();

  const tx = {
    order: {
      create: orderCreate,
      findUnique: jest.fn().mockResolvedValue({ id: 'order-1', total: 1000 }),
    },
    orderItem: { create: jest.fn().mockResolvedValue({}) },
    payment: { create: paymentCreate },
    customer: { update: jest.fn().mockResolvedValue({}) },
    accountReceivable: { create: arCreate },
    cashMovement: { create: cashMovementCreate },
    // `create()` revalida dentro de la transacción que la caja siga abierta
    // (CASH-003), así que el cliente transaccional también expone cashSession.
    cashSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1', status: 'ABIERTA' }) },
  };

  const prisma = {
    customer: { findFirst: jest.fn().mockResolvedValue({ id: CUSTOMER, addresses: [] }) },
    product: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'p1', name: 'Producto', sku: 'SKU1', taxRate: null, categoryId: null, recipe: null },
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
    { log: jest.fn() } as never,
    { consume, restore: jest.fn(), validate: jest.fn() } as never,
  );

  return { service, arCreate, orderCreate, paymentCreate, cashMovementCreate, consume };
}

/** Venta de $1000 (1 producto a 1000, sin impuestos) con los splits dados. */
function sale(payments: PaymentSplit[]) {
  const primary = payments.find((p) => p.method !== 'CREDITO')?.method ?? payments[0].method;
  return {
    customerId: CUSTOMER,
    items: [{ productId: 'p1', quantity: 1, price: 1000 }],
    paymentMethod: primary,
    payments,
  } as never;
}

async function arBalanceOf(payments: PaymentSplit[]): Promise<number | 'NO_AR'> {
  const { service, arCreate } = build();
  await service.create(sale(payments));
  if (arCreate.mock.calls.length === 0) return 'NO_AR';
  return arCreate.mock.calls[0][0].data.balance;
}

describe('OrdersService.create — CxC en pagos mixtos (P1-02)', () => {
  it('venta 100% crédito → CxC = total (1000)', async () => {
    expect(await arBalanceOf([{ method: 'CREDITO', amount: 1000 }])).toBe(1000);
  });

  it('venta 100% efectivo → no genera CxC', async () => {
    expect(await arBalanceOf([{ method: 'CASH', amount: 1000 }])).toBe('NO_AR');
  });

  it('venta efectivo + crédito (600 + 400) → CxC = 400', async () => {
    expect(
      await arBalanceOf([
        { method: 'CASH', amount: 600 },
        { method: 'CREDITO', amount: 400 },
      ]),
    ).toBe(400);
  });

  it('venta tarjeta + crédito (600 + 400) → CxC = 400', async () => {
    expect(
      await arBalanceOf([
        { method: 'CARD', amount: 600 },
        { method: 'CREDITO', amount: 400 },
      ]),
    ).toBe(400);
  });

  it('venta transferencia + crédito (600 + 400) → CxC = 400', async () => {
    expect(
      await arBalanceOf([
        { method: 'TRANSFER', amount: 600 },
        { method: 'CREDITO', amount: 400 },
      ]),
    ).toBe(400);
  });

  it('múltiples pagos, solo una parte a crédito (300 + 300 + 400) → CxC = 400', async () => {
    expect(
      await arBalanceOf([
        { method: 'CASH', amount: 300 },
        { method: 'CARD', amount: 300 },
        { method: 'CREDITO', amount: 400 },
      ]),
    ).toBe(400);
  });

  it('CxC.totalAmount conserva el total (1000) aunque el saldo sea 400', async () => {
    const { service, arCreate } = build();
    await service.create(
      sale([
        { method: 'CASH', amount: 600 },
        { method: 'CREDITO', amount: 400 },
      ]),
    );
    expect(arCreate.mock.calls[0][0].data.totalAmount).toBe(1000);
    expect(arCreate.mock.calls[0][0].data.balance).toBe(400);
  });

  it('lo demás no cambia: Order.total, inventario, Payment y CashMovement intactos', async () => {
    const { service, orderCreate, consume, paymentCreate, cashMovementCreate } = build();
    await service.create(
      sale([
        { method: 'CASH', amount: 600 },
        { method: 'CREDITO', amount: 400 },
      ]),
    );
    // Order.total sigue siendo el total de la venta.
    expect(orderCreate.mock.calls[0][0].data.total).toBe(1000);
    // Inventario consumido una vez (sin cambios por el fix de CxC).
    expect(consume).toHaveBeenCalledTimes(1);
    // Payment: una fila por split (incluido el CREDITO).
    expect(paymentCreate).toHaveBeenCalledTimes(2);
    // CashMovement: solo los no-crédito (CASH) → 1.
    expect(cashMovementCreate).toHaveBeenCalledTimes(1);
  });
});
