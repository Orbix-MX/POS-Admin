import { NotFoundException } from '@nestjs/common';
import { PurchasesService } from './purchases.service';

/**
 * @odd aislamiento-de-cupones T-003 (A-3, A-4)
 * Red automática (corre en el CI) del aislamiento de compras. La prueba contra la base real, con dos empresas y la recepción
 * completa, está en `api/test/purchases-isolation.e2e-spec.ts` y se ejecuta a mano: el CI no tiene base de datos.
 */

const TENANT = 'tenant-1';

function build(opts: { supplierOwned?: boolean; ownedProducts?: number } = {}) {
  const { supplierOwned = true, ownedProducts } = opts;
  const prisma = {
    supplier: { findFirst: jest.fn().mockResolvedValue(supplierOwned ? { id: 'sup-1' } : null) },
    product: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(where.id.in.slice(0, ownedProducts ?? where.id.in.length).map((id) => ({ id }))),
      ),
    },
    branch: { findFirst: jest.fn().mockResolvedValue(null) },
    purchaseOrder: {
      findFirst: jest.fn().mockResolvedValue({ id: 'po-1', status: 'BORRADOR', supplierId: 'sup-1', expectedDate: null, notes: null }),
      create: jest.fn().mockResolvedValue({ id: 'po-1' }),
      update: jest.fn().mockResolvedValue({ id: 'po-1' }),
    },
    purchaseOrderItem: { deleteMany: jest.fn() },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(prisma)),
  };
  const service = new PurchasesService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => null } as never,
    { getUserId: () => 'user-1' } as never,
    { assertVariantOfProduct: jest.fn() } as never,
  );
  return { service, prisma };
}

const dto = { supplierId: 'sup-1', items: [{ productId: 'p1', quantityOrdered: 1, unitCost: 10 }] };

describe('PurchasesService — referencias del body acotadas por empresa', () => {
  it('create con un proveedor que no es de la empresa: 404 y no crea la orden', async () => {
    const { service, prisma } = build({ supplierOwned: false });

    await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({ where: { id: 'sup-1', tenantId: TENANT }, select: { id: true } });
    expect(prisma.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it('create con un producto que no es de la empresa: 404, acotado por tenantId, y no crea la orden', async () => {
    const { service, prisma } = build({ ownedProducts: 0 });

    await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.product.findMany).toHaveBeenCalledWith({ where: { id: { in: ['p1'] }, tenantId: TENANT }, select: { id: true } });
    expect(prisma.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it('create con referencias propias crea la orden de la empresa', async () => {
    const { service, prisma } = build();

    await service.create(dto);

    expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT, supplierId: 'sup-1' }) }),
    );
  });

  it('update solo del proveedor (sin items) con uno ajeno: 404 y no escribe', async () => {
    const { service, prisma } = build({ supplierOwned: false });

    await expect(service.update('po-1', { supplierId: 'sup-ajeno' })).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
  });

  it('update con items Y un proveedor ajeno a la vez: 404 y no borra ni reescribe las líneas', async () => {
    const { service, prisma } = build({ supplierOwned: false });

    await expect(
      service.update('po-1', { supplierId: 'sup-ajeno', items: dto.items }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.purchaseOrderItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
  });

  it('update con un producto ajeno en las líneas: 404 y no escribe', async () => {
    const { service, prisma } = build({ ownedProducts: 0 });

    await expect(service.update('po-1', { items: dto.items })).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.purchaseOrderItem.deleteMany).not.toHaveBeenCalled();
  });

  it('receive con una sucursal que no es de la empresa: 404 ANTES de leer o escribir nada de la orden', async () => {
    const { service, prisma } = build();

    await expect(
      service.receive('po-1', { items: [{ productId: 'p1', quantityReceived: 1 }], branchId: 'branch-ajena' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.branch.findFirst).toHaveBeenCalledWith({ where: { id: 'branch-ajena', tenantId: TENANT }, select: { id: true } });
    expect(prisma.purchaseOrder.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
