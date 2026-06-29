import { ServiceQuotesService } from './service-quotes.service';

/**
 * A0-02 — Service Quotes delega el consumo de inventario en el motor compartido.
 *
 * Antes `convert()` decrementaba product.stock a mano (sin InventoryMovement ni
 * branchInventory). Ahora reutiliza InventoryConsumptionEngine.consume, idéntico
 * a Retail/Restaurante: misma venta, mismo inventario, mismo ledger.
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';

function build() {
  const consume = jest.fn();

  const tx = {
    order: {
      create: jest.fn().mockResolvedValue({ id: 'order-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'order-1' }),
    },
    orderItem: { create: jest.fn().mockResolvedValue({}) },
    payment: { create: jest.fn().mockResolvedValue({}) },
    serviceQuote: { update: jest.fn().mockResolvedValue({}) },
    customer: { update: jest.fn().mockResolvedValue({}) },
    // El motor es real-mock: no debe tocarse product.update directamente aquí.
    product: { update: jest.fn(), updateMany: jest.fn() },
  };

  const prisma = {
    serviceQuote: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'q1', status: 'APPROVED', customerId: 'c1', notes: null,
        estimatedDeliveryDate: null, items: [],
      }),
    },
    product: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'p1', name: 'Producto', sku: 'SKU1', trackInventory: true, stock: 100 },
      ]),
    },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const service = new ServiceQuotesService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => BRANCH } as never,
    { getUserId: () => 'user-1' } as never,
    { consume, restore: jest.fn(), validate: jest.fn() } as never,
  );

  return { service, consume, tx };
}

describe('ServiceQuotesService.convert — consumo vía motor (A0-02)', () => {
  it('delega los productos extra en inventory.consume y no decrementa stock a mano', async () => {
    const { service, consume, tx } = build();

    await service.convert('q1', {
      extraProducts: [{ productId: 'p1', price: 50, quantity: 3 }],
    });

    expect(consume).toHaveBeenCalledTimes(1);
    const [, lines, ctx] = consume.mock.calls[0];
    expect(lines).toEqual([{ productId: 'p1', quantity: 3, itemType: 'PRODUCT' }]);
    expect(ctx).toEqual(
      expect.objectContaining({ tenantId: TENANT, branchId: BRANCH, referenceId: 'order-1', referenceType: 'ORDER' }),
    );

    // Ya no hay decremento manual de stock en el servicio.
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('sin productos extra: consume con lista vacía (no rompe)', async () => {
    const { service, consume } = build();
    await service.convert('q1', {});
    expect(consume).toHaveBeenCalledWith(expect.anything(), [], expect.objectContaining({ referenceType: 'ORDER' }));
  });
});
