import { InventoryConsumptionEngine } from './inventory-consumption.engine';

/**
 * Aislamiento de tenant en el motor de consumo de inventario.
 *
 * `resolveEffects` expande cada línea de venta resolviendo productos por id
 * (`loadProduct`) y luego descuenta stock (`consume`). Ninguno de los dos pasos
 * acota la consulta al tenant del contexto, que sí viaja en `InventoryContext`
 * y se usa para escribir los movimientos.
 *
 * Es el segundo eslabón del problema descrito en
 * `products.tenant-isolation.spec.ts`: si un `childProductId` ajeno llega a
 * persistirse en un combo, al vender ese combo se descuenta stock de otro
 * tenant.
 */
describe('InventoryConsumptionEngine — aislamiento de tenant', () => {
  const TENANT = 'tenant-1';
  const FOREIGN_PRODUCT_ID = 'producto-de-otro-tenant';

  let engine: InventoryConsumptionEngine;
  let tx: any;

  const ctx = {
    tenantId: TENANT,
    branchId: null,
    userId: 'user-1',
    referenceId: 'order-1',
  };

  beforeEach(() => {
    engine = new InventoryConsumptionEngine();

    tx = {
      product: {
        // El producto existe y tiene stock — pero pertenece a otro tenant.
        // `PRODUCT_LOAD_SELECT` ni siquiera trae `tenantId`, así que el motor
        // no tiene forma de notarlo.
        findUnique: jest.fn().mockResolvedValue({
          id: FOREIGN_PRODUCT_ID,
          name: 'Producto ajeno',
          type: 'SIMPLE',
          trackInventory: true,
          stock: 100,
          recipe: null,
          comboItems: [],
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      supply: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      supplyMovement: { create: jest.fn().mockResolvedValue({}) },
      branchInventory: { updateMany: jest.fn(), create: jest.fn() },
      inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
    };
  });

  const line = [{ productId: FOREIGN_PRODUCT_ID, quantity: 2, itemType: 'PRODUCT' as const }];

  it('la resolución del producto está acotada al tenant del contexto', async () => {
    await engine.consume(tx, line, ctx).catch(() => undefined);

    const calls = [
      ...tx.product.findUnique.mock.calls,
      ...tx.product.findFirst.mock.calls,
    ];
    const scoped = calls.some(([args]: [any]) => args?.where?.tenantId === TENANT);

    expect(scoped).toBe(true);
  });

  it('el descuento de stock está acotado al tenant del contexto', async () => {
    await engine.consume(tx, line, ctx).catch(() => undefined);

    expect(tx.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT }),
      }),
    );
  });

  it('no descuenta stock de un producto que no pertenece al tenant', async () => {
    await expect(engine.consume(tx, line, ctx)).rejects.toThrow();
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });
});
