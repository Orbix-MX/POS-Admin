import 'dotenv/config';
import { randomBytes } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { PurchasesService } from '../src/modules/retail/purchases/purchases.service';
import { VariantInventoryResolver } from '../src/modules/retail/inventory/variant-inventory.resolver';

/**
 * @odd aislamiento-de-cupones T-003 (A-3, A-4)
 * Contra la base real y con dos empresas: una orden de compra no puede apuntar a un proveedor, un producto, una variante ni una
 * sucursal de OTRA empresa, y la recepción no puede escribir en datos ajenos aunque la orden ya esté guardada con ids ajenos.
 *
 * Estos e2e NO corren en el CI (no tiene base de datos): se ejecutan a mano con `jest --config test/jest-e2e.json`. Crean sus
 * datos con el prefijo `e2e-compras-` y los borran al terminar; si una ejecución anterior murió a medias, el siguiente
 * `beforeAll` barre sus restos por ese prefijo.
 */
const PREFIX = 'e2e-compras-';

describe('PurchasesService — aislamiento entre empresas (e2e)', () => {
  let prisma: PrismaService | undefined;
  const tenantIds: string[] = [];
  let currentTenant = '';

  const db = () => prisma as PrismaService;
  const service = () =>
    new PurchasesService(
      db(),
      { requireTenantId: () => currentTenant, getBranchId: () => null } as never,
      { getUserId: () => null } as never,
      new VariantInventoryResolver(),
    );

  const sfx = () => randomBytes(4).toString('hex');

  /** Borra empresas de prueba con el orden que exigen las claves foráneas (líneas y cuentas por pagar apuntan al producto sin cascada). */
  async function purge(where: Prisma.TenantWhereInput) {
    const ids = (await db().tenant.findMany({ where, select: { id: true } })).map((t) => t.id);
    if (ids.length === 0) return;
    const orderIds = (await db().purchaseOrder.findMany({ where: { tenantId: { in: ids } }, select: { id: true } })).map((o) => o.id);
    await db().purchaseReceiptItem.deleteMany({ where: { receipt: { purchaseOrderId: { in: orderIds } } } });
    await db().purchaseReceipt.deleteMany({ where: { purchaseOrderId: { in: orderIds } } });
    await db().purchaseOrderItem.deleteMany({ where: { purchaseOrderId: { in: orderIds } } });
    await db().accountPayable.deleteMany({ where: { purchaseOrderId: { in: orderIds } } });
    await db().purchaseOrder.deleteMany({ where: { id: { in: orderIds } } });
    await db().inventoryMovement.deleteMany({ where: { tenantId: { in: ids } } });
    await db().tenant.deleteMany({ where: { id: { in: ids } } });
  }

  async function company() {
    const tenant = await db().tenant.create({ data: { name: `E2E Compras ${sfx()}`, slug: `${PREFIX}${sfx()}` } });
    tenantIds.push(tenant.id);
    const supplier = await db().supplier.create({ data: { tenantId: tenant.id, name: `Proveedor ${sfx()}`, email: `prov-${sfx()}@e2e.test` } });
    const product = await db().product.create({
      data: { tenantId: tenant.id, sku: `SKU-${sfx()}`, slug: `prod-${sfx()}`, name: `Producto ${sfx()}`, price: 100, stock: 5 },
    });
    const variant = await db().productVariant.create({
      data: { productId: product.id, name: 'Grande', isDefault: false, trackInventory: true, cost: 10, price: 100 },
    });
    const branch = await db().branch.create({ data: { tenantId: tenant.id, name: `Sucursal ${sfx()}`, code: `S-${sfx()}` } });
    return { tenantId: tenant.id, supplier, product, variant, branch };
  }

  const stockOf = async (id: string) => (await db().product.findUniqueOrThrow({ where: { id } })).stock;
  const line = (productId: string, extra: object = {}) => ({ productId, quantityOrdered: 4, unitCost: 10, ...extra });
  const sentOrder = (c: { tenantId: string; supplier: { id: string } }, items: { productId: string; variantId?: string }[]) =>
    db().purchaseOrder.create({
      data: {
        tenantId: c.tenantId, orderNumber: `PC-${sfx()}`, supplierId: c.supplier.id, status: 'ENVIADA',
        subtotal: 40, tax: 0, total: 40,
        items: { create: items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantityOrdered: 4, unitCost: 10, tax: 0, total: 40 })) },
      },
    });

  let A: Awaited<ReturnType<typeof company>>;
  let B: Awaited<ReturnType<typeof company>>;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await purge({ slug: { startsWith: PREFIX } }); // restos de una ejecución anterior que murió a medias
    A = await company();
    B = await company();
  });

  afterAll(async () => {
    try {
      if (prisma) await purge({ id: { in: tenantIds } });
    } finally {
      await prisma?.$disconnect();
    }
  });

  describe('crear', () => {
    it('con el proveedor de otra empresa se rechaza (404) y no deja nada', async () => {
      currentTenant = A.tenantId;

      await expect(service().create({ supplierId: B.supplier.id, items: [line(A.product.id)] })).rejects.toBeInstanceOf(NotFoundException);

      expect(await db().purchaseOrder.count({ where: { tenantId: A.tenantId } })).toBe(0);
    });

    it('con el producto de otra empresa se rechaza (404)', async () => {
      currentTenant = A.tenantId;

      await expect(service().create({ supplierId: A.supplier.id, items: [line(B.product.id)] })).rejects.toBeInstanceOf(NotFoundException);

      expect(await db().purchaseOrder.count({ where: { tenantId: A.tenantId } })).toBe(0);
    });

    it('con proveedor y productos propios se crea; con una variante propia también', async () => {
      currentTenant = A.tenantId;

      const plain = await service().create({ supplierId: A.supplier.id, items: [line(A.product.id)] });
      const withVariant = await service().create({ supplierId: A.supplier.id, items: [line(A.product.id, { variantId: A.variant.id })] });

      expect(plain.supplierId).toBe(A.supplier.id);
      expect(withVariant.items[0].variantId).toBe(A.variant.id);
    });
  });

  describe('editar el borrador', () => {
    it('con items propios válidos sigue funcionando (el camino legítimo no se rompe)', async () => {
      currentTenant = A.tenantId;
      const order = await service().create({ supplierId: A.supplier.id, items: [line(A.product.id)] });

      const updated = await service().update(order.id, { supplierId: A.supplier.id, items: [line(A.product.id, { quantityOrdered: 7 })] });

      expect(updated.items.map((i) => i.quantityOrdered)).toEqual([7]);
    });

    it('con el proveedor ajeno, con un producto ajeno, o con ambos a la vez, se rechaza y no cambia', async () => {
      currentTenant = A.tenantId;
      const order = await service().create({ supplierId: A.supplier.id, items: [line(A.product.id)] });

      await expect(service().update(order.id, { supplierId: B.supplier.id })).rejects.toBeInstanceOf(NotFoundException);
      await expect(service().update(order.id, { items: [line(B.product.id)] })).rejects.toBeInstanceOf(NotFoundException);
      // la rama con items y proveedor ajeno juntos: quitar el supplierId de esa validación lo dejaría pasar
      await expect(
        service().update(order.id, { supplierId: B.supplier.id, items: [line(A.product.id)] }),
      ).rejects.toBeInstanceOf(NotFoundException);

      const after = await db().purchaseOrder.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
      expect(after.supplierId).toBe(A.supplier.id);
      expect(after.items.map((i) => i.productId)).toEqual([A.product.id]);
    });
  });

  describe('recibir', () => {
    it('con la sucursal de otra empresa se rechaza (404) y no registra nada', async () => {
      currentTenant = A.tenantId;
      const order = await sentOrder(A, [{ productId: A.product.id }]);
      const stock = await stockOf(A.product.id);

      await expect(
        service().receive(order.id, { items: [{ productId: A.product.id, quantityReceived: 4 }], branchId: B.branch.id }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(await db().purchaseReceipt.count({ where: { purchaseOrderId: order.id } })).toBe(0);
      expect(await stockOf(A.product.id)).toBe(stock);
      expect(await db().branchInventory.count({ where: { branchId: B.branch.id } })).toBe(0);
    });

    it('una orden ya guardada con un PRODUCTO ajeno no puede tocarlo y la recepción se revierte', async () => {
      currentTenant = A.tenantId;
      const poisoned = await sentOrder(A, [{ productId: B.product.id }]);
      const victim = await stockOf(B.product.id);

      await expect(
        service().receive(poisoned.id, { items: [{ productId: B.product.id, quantityReceived: 4 }] }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(await stockOf(B.product.id)).toBe(victim);
      expect(await db().purchaseReceipt.count({ where: { purchaseOrderId: poisoned.id } })).toBe(0);
    });

    it('una orden ya guardada con un PROVEEDOR ajeno no puede tocar sus totales y la recepción se revierte', async () => {
      currentTenant = A.tenantId;
      const poisoned = await db().purchaseOrder.create({
        data: {
          tenantId: A.tenantId, orderNumber: `PC-${sfx()}`, supplierId: B.supplier.id, status: 'ENVIADA',
          subtotal: 40, tax: 0, total: 40,
          items: { create: [{ productId: A.product.id, quantityOrdered: 4, unitCost: 10, tax: 0, total: 40 }] },
        },
      });
      const own = await stockOf(A.product.id);
      const before = await db().supplier.findUniqueOrThrow({ where: { id: B.supplier.id } });

      await expect(
        service().receive(poisoned.id, { items: [{ productId: A.product.id, quantityReceived: 4 }], branchId: A.branch.id }),
      ).rejects.toBeInstanceOf(NotFoundException);

      const after = await db().supplier.findUniqueOrThrow({ where: { id: B.supplier.id } });
      expect(after.totalOrders).toBe(before.totalOrders);
      expect(String(after.totalSpent)).toBe(String(before.totalSpent));
      // y la recepción entera se revirtió: tampoco subió el stock propio ni quedó un recibo
      expect(await stockOf(A.product.id)).toBe(own);
      expect(await db().purchaseReceipt.count({ where: { purchaseOrderId: poisoned.id } })).toBe(0);
    });

    it('una orden ya guardada con una VARIANTE ajena (producto propio) se rechaza y no deja inventario cruzado', async () => {
      currentTenant = A.tenantId;
      const poisoned = await sentOrder(A, [{ productId: A.product.id, variantId: B.variant.id }]);

      await expect(
        service().receive(poisoned.id, { items: [{ productId: A.product.id, quantityReceived: 4 }], branchId: A.branch.id }),
      ).rejects.toThrow();

      expect(await db().purchaseReceipt.count({ where: { purchaseOrderId: poisoned.id } })).toBe(0);
      expect(await db().branchInventory.count({ where: { variantId: B.variant.id } })).toBe(0);
    });

    it('el camino legítimo: recepción parcial y luego el resto completan la orden y dejan sus huellas', async () => {
      currentTenant = A.tenantId;
      const order = await sentOrder(A, [{ productId: A.product.id }]);
      const before = await stockOf(A.product.id);
      const supplierBefore = await db().supplier.findUniqueOrThrow({ where: { id: A.supplier.id } });

      await service().receive(order.id, { items: [{ productId: A.product.id, quantityReceived: 2 }], branchId: A.branch.id });
      expect(await stockOf(A.product.id)).toBe(before + 2);
      expect((await db().purchaseOrder.findUniqueOrThrow({ where: { id: order.id } })).status).not.toBe('COMPLETADA');

      await service().receive(order.id, { items: [{ productId: A.product.id, quantityReceived: 2 }], branchId: A.branch.id });
      expect(await stockOf(A.product.id)).toBe(before + 4);
      expect((await db().purchaseOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('COMPLETADA');

      expect(await db().purchaseReceipt.count({ where: { purchaseOrderId: order.id } })).toBe(2);
      expect(await db().inventoryMovement.count({ where: { tenantId: A.tenantId, referenceId: order.id } })).toBe(2);
      const inv = await db().branchInventory.findFirst({ where: { branchId: A.branch.id, productId: A.product.id } });
      expect(inv?.stock).toBe(4);
      expect(await db().accountPayable.count({ where: { purchaseOrderId: order.id } })).toBe(1);
      const supplierAfter = await db().supplier.findUniqueOrThrow({ where: { id: A.supplier.id } });
      expect(supplierAfter.totalOrders).toBe(supplierBefore.totalOrders + 2);
    });
  });
});
