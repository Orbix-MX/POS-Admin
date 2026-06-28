import { BranchesService } from './branches.service';

/**
 * A0-01 — Completar el ledger de inventario.
 *
 * Transferencias, ajustes manuales y conteos (bulk) modificaban BranchInventory
 * SIN registrar InventoryMovement. Estas pruebas demuestran que ahora SÍ generan
 * el movimiento correspondiente, sin duplicados y sin alterar el stock resultante.
 */

const TENANT = 'tenant-1';

function build() {
  const invCreate = jest.fn().mockResolvedValue({ id: 'mov' });
  const biUpsert = jest.fn().mockResolvedValue({ stock: 0 });
  const biUpdate = jest.fn().mockResolvedValue({});
  const biFindUnique = jest.fn().mockResolvedValue({ stock: 100 });
  const biFindMany = jest.fn().mockResolvedValue([]);

  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch' }), updateMany: jest.fn(), update: jest.fn() },
    branchInventory: { findUnique: biFindUnique, findMany: biFindMany, upsert: biUpsert, update: biUpdate },
    inventoryMovement: { create: invCreate },
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (tx: unknown) => Promise<unknown>)({
            branchInventory: { upsert: biUpsert },
            inventoryMovement: { create: invCreate },
          }),
    ),
  };

  const service = new BranchesService(
    prisma as never,
    { requireTenantId: () => TENANT } as never,
    { log: jest.fn() } as never,
    {} as never,
  );

  return { service, invCreate, biUpsert, biFindUnique, biFindMany };
}

const movData = (m: jest.Mock, i = 0) => m.mock.calls[i][0].data;

describe('BranchesService — ledger de inventario (A0-01)', () => {
  describe('transferStock', () => {
    it('genera TRANSFER_OUT en origen y TRANSFER_IN en destino, enlazados por referenceId', async () => {
      const { service, invCreate } = build();
      await service.transferStock('A', { toBranchId: 'B', productId: 'p1', quantity: 5 });

      expect(invCreate).toHaveBeenCalledTimes(2);
      const out = movData(invCreate, 0);
      const inn = movData(invCreate, 1);
      expect(out).toMatchObject({ type: 'TRANSFERENCIA', branchId: 'A', productId: 'p1', quantity: 5, referenceType: 'TRANSFER_OUT', tenantId: TENANT });
      expect(inn).toMatchObject({ type: 'TRANSFERENCIA', branchId: 'B', productId: 'p1', quantity: 5, referenceType: 'TRANSFER_IN', tenantId: TENANT });
      expect(out.referenceId).toBe(inn.referenceId); // mismo transferId
    });
  });

  describe('updateInventoryItem (ajuste manual)', () => {
    it('registra AJUSTE con el delta (nuevo - anterior)', async () => {
      const { service, invCreate, biFindUnique, biUpsert } = build();
      biFindUnique.mockResolvedValue({ stock: 8 });
      biUpsert.mockResolvedValue({ stock: 12 });

      await service.updateInventoryItem('branch', 'p1', 12);

      expect(invCreate).toHaveBeenCalledTimes(1);
      expect(movData(invCreate)).toMatchObject({
        type: 'AJUSTE', branchId: 'branch', productId: 'p1', quantity: 4, referenceType: 'INVENTORY_ADJUST',
      });
    });

    it('delta 0 (sin cambio) no genera movimiento (sin duplicados/ruido)', async () => {
      const { service, invCreate, biFindUnique, biUpsert } = build();
      biFindUnique.mockResolvedValue({ stock: 5 });
      biUpsert.mockResolvedValue({ stock: 5 });

      await service.updateInventoryItem('branch', 'p1', 5);
      expect(invCreate).not.toHaveBeenCalled();
    });
  });

  describe('bulkUpdateInventory (conteo físico)', () => {
    it('genera un AJUSTE por cada diferencia; omite los items sin cambio', async () => {
      const { service, invCreate, biFindMany } = build();
      biFindMany.mockResolvedValue([
        { productId: 'p1', stock: 10 },
        { productId: 'p2', stock: 0 },
      ]);

      await service.bulkUpdateInventory('branch', {
        items: [
          { productId: 'p1', stock: 7 }, // delta -3
          { productId: 'p2', stock: 0 }, // delta 0 → sin movimiento
        ],
      });

      expect(invCreate).toHaveBeenCalledTimes(1);
      expect(movData(invCreate)).toMatchObject({
        type: 'AJUSTE', productId: 'p1', branchId: 'branch', quantity: -3, referenceType: 'INVENTORY_COUNT',
      });
    });
  });
});
