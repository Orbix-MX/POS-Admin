import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DiningOrderStatus } from '@prisma/client';
import { getModulesForPlan, SystemModule } from '@orbix/types';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { OpenDiningOrderDto, AddDiningItemDto, UpdateDiningItemDto } from './dto/dining-order.dto';

// Allowed status transitions per operating model. The active map is chosen at
// runtime by whether the tenant has the KITCHEN module enabled.
const KITCHEN_FLOW: Record<string, DiningOrderStatus[]> = {
  OPEN: ['SENT_TO_KITCHEN', 'CANCELLED'],
  SENT_TO_KITCHEN: ['IN_PREPARATION', 'CANCELLED'],
  IN_PREPARATION: ['READY', 'CANCELLED'],
  READY: ['DELIVERED'],
  DELIVERED: ['PAID'],
};

const NO_KITCHEN_FLOW: Record<string, DiningOrderStatus[]> = {
  OPEN: ['READY_FOR_PAYMENT', 'CANCELLED'],
  READY_FOR_PAYMENT: ['PAID'],
};

const ITEM_SELECT = {
  id: true,
  productId: true,
  productName: true,
  unitPrice: true,
  quantity: true,
  notes: true,
  createdAt: true,
} as const;

const ORDER_SELECT = {
  id: true,
  serviceType: true,
  reference: true,
  status: true,
  openedAt: true,
  closedAt: true,
  tableId: true,
  branchId: true,
  table: { select: { id: true, name: true, capacity: true } },
  waiter: { select: { id: true, firstName: true, lastName: true } },
  items: { select: ITEM_SELECT, orderBy: { createdAt: 'asc' as const } },
} as const;

@Injectable()
export class DiningOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly auditContext: AuditContextService,
  ) {}

  async findActive(branchId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.diningOrder.findMany({
      where: { tenantId, branchId, status: 'OPEN' },
      orderBy: { openedAt: 'asc' },
      select: ORDER_SELECT,
    });
  }

  async findForTable(branchId: string, tableId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.diningOrder.findFirst({
      where: { tenantId, branchId, tableId, status: 'OPEN' },
      select: ORDER_SELECT,
    });
    return order ?? null;
  }

  async open(branchId: string, dto: OpenDiningOrderDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const waiterId = this.auditContext.getUserId();
    const serviceType = dto.serviceType ?? 'DINE_IN';

    if (!waiterId) throw new ConflictException('No se pudo identificar al mesero.');

    // Validate waiter belongs to tenant
    const waiter = await this.prisma.employee.findFirst({
      where: { id: waiterId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!waiter) throw new NotFoundException('Mesero no encontrado.');

    if (serviceType === 'DINE_IN') {
      return this.openDineIn(tenantId, branchId, waiterId, dto.tableId!);
    }
    return this.openCounter(tenantId, branchId, waiterId, dto.reference);
  }

  private async openDineIn(tenantId: string, branchId: string, waiterId: string, tableId: string) {
    if (!tableId) throw new BadRequestException('tableId es requerido para órdenes DINE_IN.');

    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, tenantId, branchId, isActive: true },
      select: { id: true, name: true, status: true },
    });
    if (!table) throw new NotFoundException('Mesa no encontrada.');

    const existing = await this.prisma.diningOrder.findFirst({
      where: { tableId, status: 'OPEN' },
      select: { id: true },
    });
    if (existing) throw new ConflictException('La mesa ya tiene una cuenta abierta.');

    const [order] = await this.prisma.$transaction([
      this.prisma.diningOrder.create({
        // reference se genera automáticamente desde el nombre de la mesa.
        data: { tenantId, branchId, tableId, waiterId, serviceType: 'DINE_IN', reference: table.name },
        select: ORDER_SELECT,
      }),
      this.prisma.restaurantTable.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' },
      }),
    ]);
    return order;
  }

  private async openCounter(tenantId: string, branchId: string, waiterId: string, reference?: string) {
    // Sin mesa: la referencia se captura manualmente (Mostrador, Para Llevar, Cliente Juan).
    const trimmed = reference?.trim();
    return this.prisma.diningOrder.create({
      data: {
        tenantId,
        branchId,
        waiterId,
        serviceType: 'COUNTER',
        reference: trimmed ? trimmed : null,
      },
      select: ORDER_SELECT,
    });
  }

  async findOne(branchId: string, orderId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId },
      select: ORDER_SELECT,
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    return order;
  }

  async addItem(branchId: string, orderId: string, dto: AddDiningItemDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId, status: 'OPEN' },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Orden activa no encontrada.');

    if (dto.productId) {
      const existing = await this.prisma.diningOrderItem.findFirst({
        where: { orderId, productId: dto.productId },
        select: { id: true, quantity: true },
      });
      if (existing) {
        return this.prisma.diningOrderItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + dto.quantity },
          select: ITEM_SELECT,
        });
      }
    }

    return this.prisma.diningOrderItem.create({
      data: {
        orderId,
        productId: dto.productId ?? null,
        productName: dto.productName,
        unitPrice: dto.unitPrice,
        quantity: dto.quantity,
        notes: dto.notes ?? null,
      },
      select: ITEM_SELECT,
    });
  }

  async updateItem(branchId: string, orderId: string, itemId: string, dto: UpdateDiningItemDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId, status: 'OPEN' },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Orden activa no encontrada.');

    const item = await this.prisma.diningOrderItem.findFirst({
      where: { id: itemId, orderId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Ítem no encontrado.');

    return this.prisma.diningOrderItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
      select: ITEM_SELECT,
    });
  }

  async removeItem(branchId: string, orderId: string, itemId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId, status: 'OPEN' },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Orden activa no encontrada.');

    const item = await this.prisma.diningOrderItem.findFirst({
      where: { id: itemId, orderId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Ítem no encontrado.');

    await this.prisma.diningOrderItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  /**
   * Discard an OPEN order that has no items (abandoned capture). Releases the
   * table if any. Refuses to touch orders that already carry items or that left
   * the OPEN state — those must go through the normal lifecycle. Idempotent:
   * a missing order resolves as { discarded: false }.
   */
  async discardIfEmpty(branchId: string, orderId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId },
      select: { id: true, status: true, tableId: true, _count: { select: { items: true } } },
    });
    if (!order) return { discarded: false as const };

    if (order.status !== 'OPEN') {
      throw new ConflictException('Solo se pueden descartar órdenes en borrador (OPEN).');
    }
    if (order._count.items > 0) {
      throw new ConflictException('La orden tiene productos; no se puede descartar.');
    }

    await this.deleteOrderReleasingTable(order.id, order.tableId);
    return { discarded: true as const };
  }

  /**
   * Maintenance: remove abandoned empty OPEN orders (no items) older than
   * `olderThanMinutes`. Releases their tables. Returns how many were cleaned.
   * Reusable entry point for a future scheduled cleanup job and for manual
   * admin cleanup. Scoped to the current tenant; `branchId` narrows further.
   */
  async cleanupEmptyOrders(branchId: string | undefined, olderThanMinutes = 120) {
    const tenantId = this.tenantContext.requireTenantId();
    const threshold = new Date(Date.now() - olderThanMinutes * 60_000);

    const stale = await this.prisma.diningOrder.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        status: 'OPEN',
        openedAt: { lt: threshold },
        items: { none: {} },
      },
      select: { id: true, tableId: true },
    });

    for (const order of stale) {
      await this.deleteOrderReleasingTable(order.id, order.tableId);
    }
    return { cleaned: stale.length };
  }

  /** Delete an order (items cascade) and free its table if it held one. */
  private async deleteOrderReleasingTable(orderId: string, tableId: string | null) {
    if (tableId) {
      await this.prisma.$transaction([
        this.prisma.diningOrder.delete({ where: { id: orderId } }),
        this.prisma.restaurantTable.update({ where: { id: tableId }, data: { status: 'AVAILABLE' } }),
      ]);
    } else {
      await this.prisma.diningOrder.delete({ where: { id: orderId } });
    }
  }

  /** True when the tenant's effective modules include KITCHEN. */
  private async isKitchenEnabled(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, enabledModules: true },
    });
    if (!tenant) return false;
    const planModules = getModulesForPlan(tenant.plan) as unknown as string[];
    const effective = new Set([...planModules, ...tenant.enabledModules]);
    return effective.has(SystemModule.KITCHEN);
  }

  /**
   * Advance a dining order along its lifecycle. The valid graph depends on the
   * KITCHEN module: with kitchen the order routes through preparation states;
   * without it the order jumps straight to READY_FOR_PAYMENT.
   * PAID/CANCELLED are terminal and release the table if any.
   */
  async changeStatus(branchId: string, orderId: string, target: DiningOrderStatus) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId },
      select: { id: true, status: true, tableId: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');

    const kitchenEnabled = await this.isKitchenEnabled(tenantId);
    const flow = kitchenEnabled ? KITCHEN_FLOW : NO_KITCHEN_FLOW;
    const allowed = flow[order.status] ?? [];

    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Transición inválida: ${order.status} → ${target}${kitchenEnabled ? '' : ' (cocina deshabilitada)'}.`,
      );
    }

    const releasesTable = (target === 'PAID' || target === 'CANCELLED') && order.tableId;

    if (releasesTable) {
      const [updated] = await this.prisma.$transaction([
        this.prisma.diningOrder.update({
          where: { id: orderId },
          data: { status: target, closedAt: new Date() },
          select: ORDER_SELECT,
        }),
        this.prisma.restaurantTable.update({
          where: { id: order.tableId! },
          data: { status: 'AVAILABLE' },
        }),
      ]);
      return updated;
    }

    return this.prisma.diningOrder.update({
      where: { id: orderId },
      data: { status: target },
      select: ORDER_SELECT,
    });
  }
}
