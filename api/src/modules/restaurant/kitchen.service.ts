import { Injectable, BadRequestException } from '@nestjs/common';
import { DiningOrderStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { DiningOrdersService } from './dining-orders/dining-orders.service';

/**
 * KDS sobre DiningOrder — fuente única de verdad de cocina para Web y Mobile.
 * Ya no depende de Order.kitchenStatus: lee las DiningOrder activas en cocina y
 * delega las transiciones en DiningOrdersService.changeStatus (mismo flujo que
 * usa la app y la comanda web): SENT_TO_KITCHEN → IN_PREPARATION → READY →
 * DELIVERED.
 */

// Estados que la cocina ve como trabajo activo.
const KITCHEN_ACTIVE_STATUSES: DiningOrderStatus[] = [
  'SENT_TO_KITCHEN',
  'IN_PREPARATION',
  'READY',
];

// Producto con receta/combo para que el KDS muestre los insumos a preparar.
const KITCHEN_PRODUCT_SELECT = {
  id: true,
  name: true,
  type: true,
  recipe: {
    select: {
      id: true,
      items: {
        select: {
          id: true,
          quantity: true,
          unit: true,
          supply: { select: { id: true, name: true } },
          measurementUnit: { select: { id: true, name: true, symbol: true } },
        },
      },
    },
  },
  comboItems: {
    select: {
      id: true,
      quantity: true,
      child: {
        select: {
          id: true,
          name: true,
          type: true,
          recipe: {
            select: {
              id: true,
              items: {
                select: {
                  id: true,
                  quantity: true,
                  unit: true,
                  supply: { select: { id: true, name: true } },
                  measurementUnit: { select: { id: true, name: true, symbol: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class KitchenService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private diningOrders: DiningOrdersService,
  ) {}

  async getKitchenOrders() {
    const tenantId = this.tenantContext.requireTenantId();
    const branchId = this.tenantContext.getBranchId() ?? null;

    const orders = await this.prisma.diningOrder.findMany({
      where: {
        tenantId,
        ...(branchId != null && { branchId }),
        status: { in: KITCHEN_ACTIVE_STATUSES },
      },
      orderBy: { openedAt: 'asc' },
      select: {
        id: true,
        reference: true,
        status: true,
        serviceType: true,
        openedAt: true,
        table: { select: { id: true, name: true } },
        waiter: { select: { id: true, firstName: true, lastName: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            productId: true,
            productName: true,
            quantity: true,
            notes: true,
          },
        },
      },
    });

    // DiningOrderItem no tiene relación directa a Product; se resuelven aparte
    // los productos (receta/combo) para mostrar insumos sin migrar el esquema.
    const productIds = [
      ...new Set(
        orders.flatMap((o) => o.items.map((i) => i.productId).filter((id): id is string => id != null)),
      ),
    ];
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds }, tenantId },
          select: KITCHEN_PRODUCT_SELECT,
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    return orders.map((o) => ({
      ...o,
      items: o.items.map((i) => ({
        ...i,
        product: i.productId ? productMap.get(i.productId) ?? null : null,
      })),
    }));
  }

  async updateKitchenStatus(orderId: string, status: DiningOrderStatus) {
    const branchId = this.tenantContext.getBranchId() ?? null;
    if (!branchId) {
      throw new BadRequestException('No hay sucursal seleccionada para la cocina.');
    }
    // La validación de transición (SENT_TO_KITCHEN → IN_PREPARATION → READY →
    // DELIVERED) vive en DiningOrdersService.changeStatus (flujo de cocina).
    return this.diningOrders.changeStatus(branchId, orderId, status);
  }
}
