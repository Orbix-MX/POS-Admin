import { BadRequestException } from '@nestjs/common';
import { InventoryConsumptionEngine, InventoryContext } from './inventory-consumption.engine';

/**
 * Unit tests for the universal inventory engine. A hand-rolled fake transaction
 * client records every write so we can assert WHAT moved and prove symmetry
 * (consume vs restore) across SIMPLE / RECIPE / COMBO trees.
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
  supply: {
    id: string;
    name: string;
    unit: string;
    stock: number;
    baseUnit: { symbol: string } | null;
  };
}

const CTX: InventoryContext = {
  tenantId: 'tenant-1',
  branchId: 'branch-1',
  userId: 'user-1',
  referenceId: 'order-1',
  referenceType: 'ORDER',
};

function makeTx(products: Record<string, FakeProduct>, supplyStock: Record<string, number>) {
  const productStock: Record<string, number> = {};
  for (const p of Object.values(products)) productStock[p.id] = p.stock;

  const calls = {
    productUpdateMany: [] as { id: string; decrement: number }[],
    productUpdate: [] as { id: string; increment: number }[],
    supplyUpdateMany: [] as { id: string; decrement: number }[],
    supplyUpdate: [] as { id: string; increment: number }[],
    inventoryMovements: [] as { type: string; productId: string; quantity: number }[],
    supplyMovements: [] as { type: string; supplyId: string; quantity: number }[],
    branchInventory: [] as { productId: string; increment: number }[],
  };

  const tx = {
    product: {
      findUnique: jest.fn(({ where, select }: { where: { id: string }; select: Record<string, unknown> }) => {
        const p = products[where.id];
        if (!p) return Promise.resolve(null);
        if (select && 'stock' in select && Object.keys(select).length === 1) {
          return Promise.resolve({ stock: productStock[p.id] });
        }
        return Promise.resolve(p);
      }),
      updateMany: jest.fn(({ where, data }: { where: { id: string; stock: { gte: number } }; data: { stock: { decrement: number } } }) => {
        const dec = data.stock.decrement;
        if (productStock[where.id] >= where.stock.gte) {
          productStock[where.id] -= dec;
          calls.productUpdateMany.push({ id: where.id, decrement: dec });
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      }),
      update: jest.fn(({ where, data }: { where: { id: string }; data: { stock: { increment: number } } }) => {
        productStock[where.id] += data.stock.increment;
        calls.productUpdate.push({ id: where.id, increment: data.stock.increment });
        return Promise.resolve({});
      }),
    },
    supply: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve({ stock: supplyStock[where.id] ?? 0 }),
      ),
      updateMany: jest.fn(({ where, data }: { where: { id: string; stock: { gte: number } }; data: { stock: { decrement: number } } }) => {
        const dec = data.stock.decrement;
        if ((supplyStock[where.id] ?? 0) >= where.stock.gte) {
          supplyStock[where.id] -= dec;
          calls.supplyUpdateMany.push({ id: where.id, decrement: dec });
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      }),
      update: jest.fn(({ where, data }: { where: { id: string }; data: { stock: { increment: number } } }) => {
        supplyStock[where.id] = (supplyStock[where.id] ?? 0) + data.stock.increment;
        calls.supplyUpdate.push({ id: where.id, increment: data.stock.increment });
        return Promise.resolve({});
      }),
    },
    branchInventory: {
      updateMany: jest.fn(({ data }: { where: unknown; data: { stock: { increment: number } } }) => {
        calls.branchInventory.push({ productId: 'n/a', increment: data.stock.increment });
        return Promise.resolve({ count: 1 });
      }),
      create: jest.fn(() => Promise.resolve({})),
    },
    inventoryMovement: {
      create: jest.fn(({ data }: { data: { type: string; productId: string; quantity: number } }) => {
        calls.inventoryMovements.push({ type: data.type, productId: data.productId, quantity: data.quantity });
        return Promise.resolve({});
      }),
    },
    supplyMovement: {
      create: jest.fn(({ data }: { data: { type: string; supplyId: string; quantity: number } }) => {
        calls.supplyMovements.push({ type: data.type, supplyId: data.supplyId, quantity: data.quantity });
        return Promise.resolve({});
      }),
    },
  };

  return { tx, calls, productStock, supplyStock };
}

const simple = (id: string, stock = 100, trackInventory = true): FakeProduct => ({
  id, name: id, type: 'SIMPLE', trackInventory, stock, recipe: null, comboItems: [],
});

const recipe = (id: string, items: FakeRecipeItem[]): FakeProduct => ({
  id, name: id, type: 'RECIPE', trackInventory: false, stock: 0, recipe: { items }, comboItems: [],
});

const supplyItem = (supplyId: string, qty: number): FakeRecipeItem => ({
  supplyId, quantity: qty, unit: 'g', normalizedQuantity: qty,
  supply: { id: supplyId, name: supplyId, unit: 'g', stock: 0, baseUnit: null },
});

describe('InventoryConsumptionEngine', () => {
  let engine: InventoryConsumptionEngine;

  beforeEach(() => {
    engine = new InventoryConsumptionEngine();
  });

  describe('SIMPLE', () => {
    it('consume decrements product stock and logs a VENTA movement', async () => {
      const { tx, calls, productStock } = makeTx({ p1: simple('p1', 10) }, {});
      await engine.consume(tx as never, [{ productId: 'p1', quantity: 3, itemType: 'PRODUCT' }], CTX);

      expect(productStock.p1).toBe(7);
      expect(calls.inventoryMovements).toEqual([{ type: 'VENTA', productId: 'p1', quantity: 3 }]);
    });

    it('skips products with trackInventory = false', async () => {
      const { tx, calls } = makeTx({ p1: simple('p1', 10, false) }, {});
      await engine.consume(tx as never, [{ productId: 'p1', quantity: 3, itemType: 'PRODUCT' }], CTX);

      expect(calls.productUpdateMany).toHaveLength(0);
      expect(calls.inventoryMovements).toHaveLength(0);
    });

    it('throws on insufficient stock', async () => {
      const { tx } = makeTx({ p1: simple('p1', 2) }, {});
      await expect(
        engine.consume(tx as never, [{ productId: 'p1', quantity: 5, itemType: 'PRODUCT' }], CTX),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ignores SERVICE lines and null products', async () => {
      const { tx, calls } = makeTx({ p1: simple('p1', 10) }, {});
      await engine.consume(
        tx as never,
        [
          { productId: null, quantity: 1, itemType: 'SERVICE' },
          { productId: 'svc', quantity: 1, itemType: 'SERVICE' },
        ],
        CTX,
      );
      expect(calls.productUpdateMany).toHaveLength(0);
    });
  });

  describe('RECIPE', () => {
    it('consume decrements supplies, not product stock', async () => {
      const products = { r1: recipe('r1', [supplyItem('s1', 5), supplyItem('s2', 2)]) };
      const { tx, calls, supplyStock } = makeTx(products, { s1: 100, s2: 100 });
      await engine.consume(tx as never, [{ productId: 'r1', quantity: 3, itemType: 'PRODUCT' }], CTX);

      expect(supplyStock.s1).toBe(85); // 100 - 5*3
      expect(supplyStock.s2).toBe(94); // 100 - 2*3
      expect(calls.supplyMovements.map((m) => m.type)).toEqual(['RECIPE_CONSUMPTION', 'RECIPE_CONSUMPTION']);
      expect(calls.productUpdateMany).toHaveLength(0);
    });
  });

  describe('COMBO', () => {
    it('expands children: SIMPLE child decrements stock, RECIPE child consumes supplies', async () => {
      const products = {
        combo: { id: 'combo', name: 'combo', type: 'COMBO' as const, trackInventory: false, stock: 0, recipe: null,
          comboItems: [ { childProductId: 'p1', quantity: 2 }, { childProductId: 'r1', quantity: 1 } ] },
        p1: simple('p1', 50),
        r1: recipe('r1', [supplyItem('s1', 4)]),
      };
      const { tx, productStock, supplyStock } = makeTx(products, { s1: 100 });
      await engine.consume(tx as never, [{ productId: 'combo', quantity: 3, itemType: 'PRODUCT' }], CTX);

      expect(productStock.p1).toBe(50 - 2 * 3); // child qty 2 × order qty 3
      expect(supplyStock.s1).toBe(100 - 4 * 1 * 3); // recipe needs 4 × comboQty 1 × order 3
    });
  });

  describe('symmetry: consume then restore returns to the original state', () => {
    it('SIMPLE + RECIPE + COMBO net to zero', async () => {
      const products = {
        combo: { id: 'combo', name: 'combo', type: 'COMBO' as const, trackInventory: false, stock: 0, recipe: null,
          comboItems: [ { childProductId: 'p1', quantity: 2 }, { childProductId: 'r1', quantity: 1 } ] },
        p1: simple('p1', 50),
        p2: simple('p2', 30),
        r1: recipe('r1', [supplyItem('s1', 4), supplyItem('s2', 1)]),
      };
      const { tx, productStock, supplyStock } = makeTx(products, { s1: 100, s2: 80 });
      const lines = [
        { productId: 'combo', quantity: 3, itemType: 'PRODUCT' as const },
        { productId: 'p2', quantity: 5, itemType: 'PRODUCT' as const },
      ];

      const p1Before = productStock.p1, p2Before = productStock.p2;
      const s1Before = supplyStock.s1, s2Before = supplyStock.s2;

      await engine.consume(tx as never, lines, CTX);
      await engine.restore(tx as never, lines, CTX);

      expect(productStock.p1).toBe(p1Before);
      expect(productStock.p2).toBe(p2Before);
      expect(supplyStock.s1).toBe(s1Before);
      expect(supplyStock.s2).toBe(s2Before);
    });

    it('never increments the stock of virtual RECIPE / COMBO parents (no ghost stock)', async () => {
      const products = {
        combo: { id: 'combo', name: 'combo', type: 'COMBO' as const, trackInventory: false, stock: 0, recipe: null,
          comboItems: [{ childProductId: 'r1', quantity: 1 }] },
        r1: recipe('r1', [supplyItem('s1', 4)]),
      };
      const { tx, calls, productStock } = makeTx(products, { s1: 100 });
      const lines = [{ productId: 'combo', quantity: 2, itemType: 'PRODUCT' as const }];

      await engine.consume(tx as never, lines, CTX);
      await engine.restore(tx as never, lines, CTX);

      // Virtual parents keep stock 0 and are never written to.
      expect(productStock.combo).toBe(0);
      expect(productStock.r1).toBe(0);
      expect(calls.productUpdate.find((c) => c.id === 'combo' || c.id === 'r1')).toBeUndefined();
      // Only the supply round-trips back to its original level.
      expect(tx.supply.update).toHaveBeenCalled();
    });
  });
});
