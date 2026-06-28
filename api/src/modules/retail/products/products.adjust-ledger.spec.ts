import { ProductsService } from './products.service';

/**
 * A0-02 — products.updateStock (ajuste manual) emite movimiento AJUSTE.
 *
 * Antes escribía product.stock sin registro en el ledger (solo audit.log). Ahora
 * el ajuste y su InventoryMovement AJUSTE van juntos en una transacción. Mismo
 * resultado de stock; se añade trazabilidad.
 */

const TENANT = 'tenant-1';

function build(prev: number) {
  const invCreate = jest.fn().mockResolvedValue({});
  const productUpdate = jest.fn().mockImplementation(({ data }: { data: { stock: number } }) =>
    Promise.resolve({ id: 'p1', stock: data.stock }),
  );

  const prisma = {
    product: {
      findFirst: jest.fn().mockResolvedValue({ id: 'p1', type: 'SIMPLE', trackInventory: true, stock: prev }),
      update: productUpdate,
    },
    inventoryMovement: { create: invCreate },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
      cb({ product: { update: productUpdate }, inventoryMovement: { create: invCreate } }),
    ),
  };

  const service = new ProductsService(
    prisma as never,
    { requireTenantId: () => TENANT } as never,
    { log: jest.fn() } as never,
    { upload: jest.fn(), delete: jest.fn(), buildKey: () => 'k' } as never,
  );

  return { service, invCreate, productUpdate };
}

describe('ProductsService.updateStock — ledger de ajuste (A0-02)', () => {
  it('alta (+5): stock final correcto y movimiento AJUSTE +5', async () => {
    const { service, invCreate, productUpdate } = build(10);
    const result = await service.updateStock('p1', 5);

    expect(productUpdate.mock.calls[0][0].data.stock).toBe(15); // 10 + 5
    expect(result.stock).toBe(15);
    expect(invCreate).toHaveBeenCalledTimes(1);
    expect(invCreate.mock.calls[0][0].data).toMatchObject({
      type: 'AJUSTE', productId: 'p1', quantity: 5, referenceType: 'PRODUCT_ADJUST', tenantId: TENANT,
    });
  });

  it('baja (-3): movimiento AJUSTE -3', async () => {
    const { service, invCreate } = build(10);
    await service.updateStock('p1', -3);
    expect(invCreate.mock.calls[0][0].data).toMatchObject({ type: 'AJUSTE', quantity: -3 });
  });

  it('delta 0: no genera movimiento', async () => {
    const { service, invCreate } = build(10);
    await service.updateStock('p1', 0);
    expect(invCreate).not.toHaveBeenCalled();
  });
});
