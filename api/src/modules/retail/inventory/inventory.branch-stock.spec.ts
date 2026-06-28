import { BadRequestException } from '@nestjs/common';
import { InventoryConsumptionEngine, InventoryContext } from './inventory-consumption.engine';

/**
 * P1-04 — BranchInventory nunca queda negativo.
 *
 * Fake de transacción que SÍ modela el nivel de stock por (sucursal, producto) y
 * el guard `stock: { gte }`, para probar el decremento acotado y el clamp a 0.
 * El stock global conserva su guard autoritativo (consume() lanza si falta).
 */

interface FakeProduct {
  id: string;
  name: string;
  type: 'SIMPLE' | 'RECIPE' | 'COMBO' | 'SERVICE';
  trackInventory: boolean;
  stock: number;
  recipe: { items: FakeRecipeItem[] } | null;
  comboItems: { childProductId: string; quantity: number }[];
}
interface FakeRecipeItem {
  supplyId: string;
  quantity: number;
  unit: string;
  normalizedQuantity: number | null;
  supply: { id: string; name: string; unit: string; stock: number; baseUnit: { symbol: string } | null };
}

const simple = (id: string, stock = 100): FakeProduct => ({
  id, name: id, type: 'SIMPLE', trackInventory: true, stock, recipe: null, comboItems: [],
});
const recipe = (id: string, items: FakeRecipeItem[]): FakeProduct => ({
  id, name: id, type: 'RECIPE', trackInventory: false, stock: 0, recipe: { items }, comboItems: [],
});
const supplyItem = (supplyId: string, qty: number): FakeRecipeItem => ({
  supplyId, quantity: qty, unit: 'g', normalizedQuantity: qty,
  supply: { id: supplyId, name: supplyId, unit: 'g', stock: 0, baseUnit: null },
});

/**
 * `branchStocks`: nivel inicial por "branchId:productId" (filas existentes).
 * Filas no listadas no existen → se siembran desde el stock global.
 */
function makeTx(
  products: Record<string, FakeProduct>,
  supplyStock: Record<string, number>,
  branchStocks: Record<string, number>,
) {
  const productStock: Record<string, number> = {};
  for (const p of Object.values(products)) productStock[p.id] = p.stock;
  const rows = new Map<string, number>(Object.entries(branchStocks));
  const key = (b: string, p: string) => `${b}:${p}`;
  const calls = { branchCreate: [] as { key: string; stock: number }[] };

  const tx = {
    product: {
      findUnique: jest.fn(({ where, select }: { where: { id: string }; select?: Record<string, unknown> }) => {
        const p = products[where.id];
        if (!p) return Promise.resolve(null);
        if (select && 'stock' in select && Object.keys(select).length === 1) {
          return Promise.resolve({ stock: productStock[p.id] });
        }
        return Promise.resolve(p);
      }),
      updateMany: jest.fn(({ where, data }: { where: { id: string; stock: { gte: number } }; data: { stock: { decrement: number } } }) => {
        if (productStock[where.id] >= where.stock.gte) {
          productStock[where.id] -= data.stock.decrement;
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      }),
      update: jest.fn(({ where, data }: { where: { id: string }; data: { stock: { increment: number } } }) => {
        productStock[where.id] += data.stock.increment;
        return Promise.resolve({});
      }),
    },
    supply: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve({ stock: supplyStock[where.id] ?? 0 })),
      updateMany: jest.fn(({ where, data }: { where: { id: string; stock: { gte: number } }; data: { stock: { decrement: number } } }) => {
        if ((supplyStock[where.id] ?? 0) >= where.stock.gte) {
          supplyStock[where.id] -= data.stock.decrement;
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      }),
      update: jest.fn(({ where, data }: { where: { id: string }; data: { stock: { increment: number } } }) => {
        supplyStock[where.id] = (supplyStock[where.id] ?? 0) + data.stock.increment;
        return Promise.resolve({});
      }),
    },
    branchInventory: {
      updateMany: jest.fn(
        ({ where, data }: { where: { branchId: string; productId: string; stock?: { gte: number } }; data: { stock: number | { increment: number } } }) => {
          const k = key(where.branchId, where.productId);
          if (!rows.has(k)) return Promise.resolve({ count: 0 });
          // Guarded decrement: solo si la fila tiene suficiente.
          if (where.stock && typeof where.stock.gte === 'number') {
            if ((rows.get(k) ?? 0) >= where.stock.gte) {
              rows.set(k, (rows.get(k) ?? 0) + (data.stock as { increment: number }).increment);
              return Promise.resolve({ count: 1 });
            }
            return Promise.resolve({ count: 0 });
          }
          // Clamp: data.stock es número (0).
          if (typeof data.stock === 'number') {
            rows.set(k, data.stock);
            return Promise.resolve({ count: 1 });
          }
          // Incremento (restore).
          rows.set(k, (rows.get(k) ?? 0) + data.stock.increment);
          return Promise.resolve({ count: 1 });
        },
      ),
      create: jest.fn(({ data }: { data: { branchId: string; productId: string; stock: number } }) => {
        rows.set(key(data.branchId, data.productId), data.stock);
        calls.branchCreate.push({ key: key(data.branchId, data.productId), stock: data.stock });
        return Promise.resolve({});
      }),
    },
    inventoryMovement: { create: jest.fn(() => Promise.resolve({})) },
    supplyMovement: { create: jest.fn(() => Promise.resolve({})) },
  };

  return { tx, rows, productStock, supplyStock, calls, key };
}

const ctx = (branchId: string | null): InventoryContext => ({
  tenantId: 'tenant-1', branchId, userId: 'user-1', referenceId: 'order-1', referenceType: 'ORDER',
});

describe('InventoryConsumptionEngine — BranchInventory no negativo (P1-04)', () => {
  it('venta normal: branch con suficiente → decrementa sin negativo', async () => {
    const { tx, rows } = makeTx({ p1: simple('p1', 100) }, {}, { 'b1:p1': 10 });
    await engine().consume(tx as never, [{ productId: 'p1', quantity: 4, itemType: 'PRODUCT' }], ctx('b1'));
    expect(rows.get('b1:p1')).toBe(6);
  });

  it('branch exacto (= cantidad): queda en 0, nunca negativo', async () => {
    const { tx, rows } = makeTx({ p1: simple('p1', 100) }, {}, { 'b1:p1': 5 });
    await engine().consume(tx as never, [{ productId: 'p1', quantity: 5, itemType: 'PRODUCT' }], ctx('b1'));
    expect(rows.get('b1:p1')).toBe(0);
  });

  it('branch insuficiente pero global suficiente: clamp a 0 (NO negativo) y la venta NO falla', async () => {
    const { tx, rows, productStock } = makeTx({ p1: simple('p1', 25) }, {}, { 'b1:p1': 2 });
    await engine().consume(tx as never, [{ productId: 'p1', quantity: 5, itemType: 'PRODUCT' }], ctx('b1'));
    expect(rows.get('b1:p1')).toBe(0);     // antes quedaba -3
    expect(rows.get('b1:p1')).toBeGreaterThanOrEqual(0);
    expect(productStock.p1).toBe(20);      // global descontado normalmente
    expect(productStock.p1).toBeGreaterThanOrEqual(0);
  });

  it('stock global insuficiente: lanza y no toca branch', async () => {
    const { tx, rows } = makeTx({ p1: simple('p1', 2) }, {}, { 'b1:p1': 10 });
    await expect(
      engine().consume(tx as never, [{ productId: 'p1', quantity: 5, itemType: 'PRODUCT' }], ctx('b1')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(rows.get('b1:p1')).toBe(10); // intacto
  });

  it('sin fila previa: siembra desde el stock global (no negativo)', async () => {
    const { tx, rows, calls } = makeTx({ p1: simple('p1', 25) }, {}, {});
    await engine().consume(tx as never, [{ productId: 'p1', quantity: 2, itemType: 'PRODUCT' }], ctx('b1'));
    expect(calls.branchCreate).toEqual([{ key: 'b1:p1', stock: 23 }]); // 25 - 2
    expect(rows.get('b1:p1')).toBe(23);
  });

  it('restore completo: reingresa al branch (venta normal round-trip simétrico)', async () => {
    const { tx, rows } = makeTx({ p1: simple('p1', 100) }, {}, { 'b1:p1': 10 });
    const line = [{ productId: 'p1', quantity: 4, itemType: 'PRODUCT' as const }];
    await engine().consume(tx as never, line, ctx('b1'));
    await engine().restore(tx as never, line, ctx('b1'));
    expect(rows.get('b1:p1')).toBe(10); // 10 → 6 → 10
  });

  it('refund parcial: reingresa solo lo devuelto', async () => {
    const { tx, rows } = makeTx({ p1: simple('p1', 100) }, {}, { 'b1:p1': 10 });
    await engine().consume(tx as never, [{ productId: 'p1', quantity: 5, itemType: 'PRODUCT' }], ctx('b1'));
    await engine().restore(tx as never, [{ productId: 'p1', quantity: 2, itemType: 'PRODUCT' }], ctx('b1'));
    expect(rows.get('b1:p1')).toBe(7); // 10 → 5 → 7
  });

  it('cancelación (restore total) tras venta normal vuelve al inicio', async () => {
    const { tx, rows } = makeTx({ p1: simple('p1', 100), p2: simple('p2', 100) }, {}, { 'b1:p1': 8, 'b1:p2': 3 });
    const lines = [
      { productId: 'p1', quantity: 3, itemType: 'PRODUCT' as const },
      { productId: 'p2', quantity: 1, itemType: 'PRODUCT' as const },
    ];
    await engine().consume(tx as never, lines, ctx('b1'));
    await engine().restore(tx as never, lines, ctx('b1'));
    expect(rows.get('b1:p1')).toBe(8);
    expect(rows.get('b1:p2')).toBe(3);
  });

  it('COMBO: solo las hojas SIMPLE mueven branch; nunca negativo', async () => {
    const products = {
      combo: { id: 'combo', name: 'combo', type: 'COMBO' as const, trackInventory: false, stock: 0, recipe: null,
        comboItems: [{ childProductId: 'p1', quantity: 2 }, { childProductId: 'r1', quantity: 1 }] },
      p1: simple('p1', 100),
      r1: recipe('r1', [supplyItem('s1', 4)]),
    };
    const { tx, rows } = makeTx(products, { s1: 100 }, { 'b1:p1': 10 });
    await engine().consume(tx as never, [{ productId: 'combo', quantity: 3, itemType: 'PRODUCT' }], ctx('b1'));
    expect(rows.get('b1:p1')).toBe(4); // 10 - 2*3
    expect(rows.has('b1:combo')).toBe(false);
    expect(rows.has('b1:r1')).toBe(false);
  });

  it('RECIPE: no toca branchInventory (consume insumos)', async () => {
    const { tx, rows, supplyStock } = makeTx({ r1: recipe('r1', [supplyItem('s1', 5)]) }, { s1: 100 }, {});
    await engine().consume(tx as never, [{ productId: 'r1', quantity: 2, itemType: 'PRODUCT' }], ctx('b1'));
    expect(rows.size).toBe(0);
    expect(supplyStock.s1).toBe(90);
  });

  it('múltiples sucursales: el consumo en B1 no afecta a B2', async () => {
    const { tx, rows } = makeTx({ p1: simple('p1', 100) }, {}, { 'b1:p1': 10, 'b2:p1': 7 });
    await engine().consume(tx as never, [{ productId: 'p1', quantity: 4, itemType: 'PRODUCT' }], ctx('b1'));
    expect(rows.get('b1:p1')).toBe(6);
    expect(rows.get('b2:p1')).toBe(7); // intacta
  });
});

function engine() {
  return new InventoryConsumptionEngine();
}
