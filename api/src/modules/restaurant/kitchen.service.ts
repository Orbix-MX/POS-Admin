import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DiningOrderStatus, KitchenRoundStatus } from '@prisma/client';
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
        kitchenRounds: {
          // Solo rondas activas (no marcadas como DONE por la cocina).
          where: { status: { not: 'DONE' } },
          orderBy: { roundNumber: 'asc' },
          select: {
            id: true,
            roundNumber: true,
            sentAt: true,
            status: true,
            items: {
              select: {
                id: true,
                productId: true,
                productName: true,
                quantity: true,
                notes: true,
                sentToKitchenAt: true,
              },
            },
          },
        },
      },
    });

    // Resolve products (recipe/combo) for ingredient display.
    const productIds = [
      ...new Set(
        orders.flatMap((o) =>
          o.kitchenRounds.flatMap((r) =>
            r.items.map((i) => i.productId).filter((id): id is string => id != null),
          ),
        ),
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
      rounds: o.kitchenRounds.map((r) => ({
        ...r,
        items: r.items.map((i) => ({
          ...i,
          product: i.productId ? (productMap.get(i.productId) ?? null) : null,
        })),
      })),
    }));
  }

  async updateKitchenStatus(orderId: string, status: DiningOrderStatus) {
    const branchId = this.tenantContext.getBranchId() ?? null;
    if (!branchId) {
      throw new BadRequestException('No hay sucursal seleccionada para la cocina.');
    }
    return this.diningOrders.changeStatus(branchId, orderId, status);
  }

  async updateRoundStatus(roundId: string, status: KitchenRoundStatus) {
    const tenantId = this.tenantContext.requireTenantId();
    const round = await this.prisma.kitchenRound.findFirst({
      where: { id: roundId, order: { tenantId } },
      select: { id: true },
    });
    if (!round) throw new NotFoundException('Ronda no encontrada.');
    return this.prisma.kitchenRound.update({
      where: { id: roundId },
      data: { status },
      select: { id: true, roundNumber: true, sentAt: true, status: true },
    });
  }
}
