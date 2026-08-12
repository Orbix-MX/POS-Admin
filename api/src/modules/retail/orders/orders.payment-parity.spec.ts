import { OrdersService } from './orders.service';

/**
 * P1-03 — Paridad de huella financiera entre create() y addPayment().
 *
 * Hallazgo: create() emitía CashMovement SALE para CARD; addPayment() lo omitía.
 * Decisión: create() es la referencia (la CashMovement CARD alimenta el resumen
 * de caja totals.sales.card). addPayment() ahora genera la MISMA estructura.
 *
 * Estas pruebas ejecutan el MISMO conjunto de pagos por ambos caminos y comparan
 * la huella de Payment + CashMovement. No tocan inventario, Order ni OrderItem.
 */

const TENANT = 'tenant-1';

interface Split {
  method: string;
  amount: number;
  currency?: 'MXN' | 'USD';
}

/** Huella comparable de las llamadas cashMovement.create. */
function cashFootprint(create: jest.Mock) {
  return create.mock.calls.map((c) => ({
    type: c[0].data.type,
    method: c[0].data.paymentMethod,
    currency: c[0].data.currency,
    amount: c[0].data.amount,
    amountMxnEquivalent: c[0].data.amountMxnEquivalent ?? null,
  }));
}

/** Huella comparable de las llamadas payment.create. */
function paymentFootprint(create: jest.Mock) {
  return create.mock.calls.map((c) => ({
    method: c[0].data.paymentMethod,
    currency: c[0].data.currency,
    amount: c[0].data.amount,
  }));
}

// ── create() ──────────────────────────────────────────────────────────────────

function runCreate(payments: Split[]) {
  const paymentCreate = jest.fn().mockResolvedValue({ id: 'pay' });
  const cashMovementCreate = jest.fn().mockResolvedValue({ id: 'cm' });
  const consume = jest.fn();

  const tx = {
    order: { create: jest.fn().mockResolvedValue({ id: 'order-1' }), findUnique: jest.fn().mockResolvedValue({ id: 'order-1' }) },
    orderItem: { create: jest.fn().mockResolvedValue({}) },
    payment: { create: paymentCreate },
    customer: { update: jest.fn() },
    accountReceivable: { create: jest.fn() },
    cashMovement: { create: cashMovementCreate },
    // create()/addPayment() revalidan la sesión dentro de la transacción (CASH-003).
    cashSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1', status: 'ABIERTA' }) },
  };
  const prisma = {
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
    { validateCoupon: jest.fn(), incrementUsage: jest.fn() } as never,
    { log: jest.fn() } as never,
    { consume, restore: jest.fn(), validate: jest.fn() } as never,
  );

  const total = payments.reduce((s, p) => s + (p.currency === 'USD' ? p.amount * 20 : p.amount), 0);
  const primary = payments.find((p) => p.method !== 'CREDITO')?.method ?? payments[0].method;
  // venta mostrador (sin cliente) → sin AR; aísla la comparación a Payment + CashMovement
  const dto = {
    items: [{ productId: 'p1', quantity: 1, price: total }],
    paymentMethod: primary,
    payments,
  };
  return { run: service.create(dto), paymentCreate, cashMovementCreate, consume };
}

// ── addPayment() ────────────────────────────────────────────────────────────────

function runAddPayment(payments: Split[]) {
  const paymentCreate = jest.fn().mockResolvedValue({ id: 'pay' });
  const cashMovementCreate = jest.fn().mockResolvedValue({ id: 'cm' });

  const tx = {
    payment: { create: paymentCreate },
    cashMovement: { create: cashMovementCreate },
    order: { update: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue({ id: 'order-1' }) },
    accountReceivable: { update: jest.fn() },
    // addPayment() revalida la sesión dentro de la transacción (CASH-003).
    cashSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1', status: 'ABIERTA' }) },
  };
  const order = {
    id: 'order-1',
    total: 100000,
    status: 'CONFIRMED',
    paymentStatus: 'PARTIALLY_PAID',
    payments: [],
    accountReceivable: null,
  };
  const prisma = {
    order: { findFirst: jest.fn().mockResolvedValue(order) },
    cashSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1', status: 'ABIERTA', exchangeRateUsdMxn: 20 }) },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  const service = new OrdersService(
    prisma as never,
    { getUserId: () => 'user-1' } as never,
    { requireTenantId: () => TENANT, getBranchId: () => 'branch-1' } as never,
    { validateCoupon: jest.fn(), incrementUsage: jest.fn() } as never,
    { log: jest.fn() } as never,
    { consume: jest.fn(), restore: jest.fn(), validate: jest.fn() } as never,
  );
  return { run: service.addPayment('order-1', { payments }), paymentCreate, cashMovementCreate };
}

// ── comparación ─────────────────────────────────────────────────────────────────

async function compare(payments: Split[]) {
  const c = runCreate(payments);
  await c.run;
  const a = runAddPayment(payments);
  await a.run;
  return {
    cashCreate: cashFootprint(c.cashMovementCreate),
    cashAdd: cashFootprint(a.cashMovementCreate),
    payCreate: paymentFootprint(c.paymentCreate),
    payAdd: paymentFootprint(a.paymentCreate),
  };
}

describe('OrdersService — paridad create() vs addPayment() (P1-03)', () => {
  it('CASH: misma huella de CashMovement', async () => {
    const r = await compare([{ method: 'CASH', amount: 1000 }]);
    expect(r.cashAdd).toEqual(r.cashCreate);
    expect(r.cashCreate).toEqual([
      { type: 'SALE', method: 'CASH', currency: 'MXN', amount: 1000, amountMxnEquivalent: null },
    ]);
  });

  it('CARD: ahora ambos emiten CashMovement SALE idéntico (fix del hallazgo)', async () => {
    const r = await compare([{ method: 'CARD', amount: 1000 }]);
    expect(r.cashAdd).toEqual(r.cashCreate);
    expect(r.cashAdd).toEqual([
      { type: 'SALE', method: 'CARD', currency: 'MXN', amount: 1000, amountMxnEquivalent: null },
    ]);
  });

  it('TRANSFER: misma huella', async () => {
    const r = await compare([{ method: 'TRANSFER', amount: 1000 }]);
    expect(r.cashAdd).toEqual(r.cashCreate);
    expect(r.cashAdd).toHaveLength(1);
    expect(r.cashAdd[0].method).toBe('TRANSFER');
  });

  it('USD (CASH): misma huella incluyendo amountMxnEquivalent', async () => {
    const r = await compare([{ method: 'CASH', amount: 50, currency: 'USD' }]);
    expect(r.cashAdd).toEqual(r.cashCreate);
    expect(r.cashAdd).toEqual([
      { type: 'SALE', method: 'CASH', currency: 'USD', amount: 50, amountMxnEquivalent: 1000 },
    ]);
  });

  it('CREDITO: ninguno emite CashMovement', async () => {
    const r = await compare([{ method: 'CREDITO', amount: 1000 }]);
    expect(r.cashCreate).toEqual([]);
    expect(r.cashAdd).toEqual([]);
  });

  it('múltiples pagos (CASH + CARD + CREDITO): misma huella; CREDITO sin CashMovement', async () => {
    const r = await compare([
      { method: 'CASH', amount: 500 },
      { method: 'CARD', amount: 300 },
      { method: 'CREDITO', amount: 200 },
    ]);
    expect(r.cashAdd).toEqual(r.cashCreate);
    // dos CashMovements (CASH + CARD), CREDITO excluido
    expect(r.cashAdd).toEqual([
      { type: 'SALE', method: 'CASH', currency: 'MXN', amount: 500, amountMxnEquivalent: null },
      { type: 'SALE', method: 'CARD', currency: 'MXN', amount: 300, amountMxnEquivalent: null },
    ]);
    // Payment: una fila por split en ambos caminos (incluido CREDITO)
    expect(r.payAdd).toEqual(r.payCreate);
    expect(r.payCreate).toHaveLength(3);
  });
});
