import { InventoryEngine } from './inventory.engine';

/**
 * Fase 1 — InventoryEngine encapsula los primitivos de inventario. Estos tests
 * fijan el comportamiento (guard de stock, siembra de branchInventory, forma de
 * los movimientos) para que la adopción de Fase 2 sea una sustitución 1:1.
 */

function makeTx() {
  return {
    inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
    supplyMovement: { create: jest.fn().mockResolvedValue({}) },
    product: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ stock: 7 }),
    },
    supply: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ stock: 12 }),
    },
    branchInventory: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('InventoryEngine', () => {
  let engine: InventoryEngine;

  beforeEach(() => {
    engine = new InventoryEngine();
  });

  describe('recordProductMovement', () => {
    it('escribe el movimiento con los campos provistos y defaults nulos', async () => {
      const tx = makeTx();
      await engine.recordProductMovement(tx as never, {
        tenantId: 't1',
        type: 'VENTA',
        productId: 'p1',
        quantity: 3,
      });
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          tenantId: 't1',
          type: 'VENTA',
          productId: 'p1',
          branchId: null,
          quantity: 3,
          referenceId: null,
          referenceType: null,
          notes: null,
          createdById: null,
        },
      });
    });
  });

  describe('recordSupplyMovement', () => {
    it('escribe el movimiento de insumo con defaults nulos', async () => {
      const tx = makeTx();
      await engine.recordSupplyMovement(tx as never, {
        tenantId: 't1',
        supplyId: 's1',
        type: 'ADJUSTMENT',
        quantity: 2,
      });
      expect(tx.supplyMovement.create).toHaveBeenCalledWith({
        data: {
          tenantId: 't1',
          supplyId: 's1',
          type: 'ADJUSTMENT',
          quantity: 2,
          branchId: null,
          referenceId: null,
          notes: null,
          createdById: null,
        },
      });
    });
  });

  describe('applyProductStockDelta', () => {
    it('delta 0 → no muta y devuelve true', async () => {
      const tx = makeTx();
      const ok = await engine.applyProductStockDelta(tx as never, { productId: 'p1', delta: 0 });
      expect(ok).toBe(true);
      expect(tx.product.update).not.toHaveBeenCalled();
      expect(tx.product.updateMany).not.toHaveBeenCalled();
    });

    it('resta con guard y stock suficiente → updateMany, devuelve true', async () => {
      const tx = makeTx();
      tx.product.updateMany.mockResolvedValue({ count: 1 });
      const ok = await engine.applyProductStockDelta(tx as never, {
        productId: 'p1', delta: -5, guardInsufficient: true,
      });
      expect(ok).toBe(true);
      expect(tx.product.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', stock: { gte: 5 } },
        data: { stock: { increment: -5 } },
      });
    });

    it('resta con guard y stock insuficiente → devuelve false sin mutar increment', async () => {
      const tx = makeTx();
      tx.product.updateMany.mockResolvedValue({ count: 0 });
      const ok = await engine.applyProductStockDelta(tx as never, {
        productId: 'p1', delta: -5, guardInsufficient: true,
      });
      expect(ok).toBe(false);
      expect(tx.product.update).not.toHaveBeenCalled();
    });

    it('suma sin guard → increment directo', async () => {
      const tx = makeTx();
      const ok = await engine.applyProductStockDelta(tx as never, { productId: 'p1', delta: 4 });
      expect(ok).toBe(true);
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { stock: { increment: 4 } },
      });
    });
  });

  describe('applySupplyStockDelta', () => {
    it('resta con guard insuficiente → false', async () => {
      const tx = makeTx();
      tx.supply.updateMany.mockResolvedValue({ count: 0 });
      const ok = await engine.applySupplyStockDelta(tx as never, {
        supplyId: 's1', delta: -3, guardInsufficient: true,
      });
      expect(ok).toBe(false);
      expect(tx.supply.update).not.toHaveBeenCalled();
    });
  });

  describe('applyBranchInventoryDelta', () => {
    it('sin branchId → no-op', async () => {
      const tx = makeTx();
      await engine.applyBranchInventoryDelta(tx as never, null, 'p1', -2);
      expect(tx.branchInventory.updateMany).not.toHaveBeenCalled();
      expect(tx.branchInventory.create).not.toHaveBeenCalled();
    });

    it('resta con fila suficiente → updateMany guardado, sin siembra', async () => {
      const tx = makeTx();
      tx.branchInventory.updateMany.mockResolvedValue({ count: 1 });
      await engine.applyBranchInventoryDelta(tx as never, 'b1', 'p1', -2);
      expect(tx.branchInventory.updateMany).toHaveBeenCalledWith({
        where: { branchId: 'b1', productId: 'p1', stock: { gte: 2 } },
        data: { stock: { increment: -2 } },
      });
      expect(tx.branchInventory.create).not.toHaveBeenCalled();
    });

    it('resta sin fila → clamp falla y siembra desde stock global', async () => {
      const tx = makeTx();
      // Primer updateMany (guardado) no afecta; segundo (clamp a 0) tampoco → siembra.
      tx.branchInventory.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 });
      tx.product.findUnique.mockResolvedValue({ stock: 9 });
      await engine.applyBranchInventoryDelta(tx as never, 'b1', 'p1', -2);
      expect(tx.branchInventory.create).toHaveBeenCalledWith({
        data: { branchId: 'b1', productId: 'p1', stock: 9 },
      });
    });

    it('suma sin fila → siembra desde stock global', async () => {
      const tx = makeTx();
      tx.branchInventory.updateMany.mockResolvedValue({ count: 0 });
      tx.product.findUnique.mockResolvedValue({ stock: 5 });
      await engine.applyBranchInventoryDelta(tx as never, 'b1', 'p1', 3);
      expect(tx.branchInventory.create).toHaveBeenCalledWith({
        data: { branchId: 'b1', productId: 'p1', stock: 5 },
      });
    });
  });

  describe('getProductStock / getSupplyStock', () => {
    it('devuelve stock de producto', async () => {
      const tx = makeTx();
      tx.product.findUnique.mockResolvedValue({ stock: 7 });
      expect(await engine.getProductStock(tx as never, 'p1')).toBe(7);
    });

    it('producto inexistente → null', async () => {
      const tx = makeTx();
      tx.product.findUnique.mockResolvedValue(null);
      expect(await engine.getProductStock(tx as never, 'p1')).toBeNull();
    });

    it('convierte Decimal de insumo a número', async () => {
      const tx = makeTx();
      tx.supply.findUnique.mockResolvedValue({ stock: 12 });
      expect(await engine.getSupplyStock(tx as never, 's1')).toBe(12);
    });
  });
});
