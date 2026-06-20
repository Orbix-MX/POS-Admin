import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DiningOrderStatus } from '@prisma/client';
import { getModulesForPlan, SystemModule } from '@orbix/types';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { OpenDiningOrderDto, AddDiningItemDto, UpdateDiningItemDto } from './dto/dining-order.dto';
import { CheckoutDiningOrderDto } from './dto/checkout-dining-order.dto';
import { InventoryConsumptionEngine } from '../../retail/inventory/inventory-consumption.engine';
import { OrderCheckoutEngine } from '../../retail/checkout/order-checkout.engine';
import { roundMoney } from '../../../common/utils/money.util';

// Allowed status transitions per operating model. The active map is chosen at
// runtime by whether the tenant has the KITCHEN module enabled. PAID is NOT a
// manual transition: it is reached only through checkout(), which produces the
// financial Order. The states below are the payable hand-off points.
const KITCHEN_FLOW: Record<string, DiningOrderStatus[]> = {
  OPEN: ['SENT_TO_KITCHEN', 'CANCELLED'],
  SENT_TO_KITCHEN: ['IN_PREPARATION', 'CANCELLED'],
  IN_PREPARATION: ['READY', 'CANCELLED'],
  // Cocina entrega directo a caja: READY → READY_FOR_PAYMENT (no pasa por DELIVERED).
  READY: ['READY_FOR_PAYMENT'],
  READY_FOR_PAYMENT: [],
};

const NO_KITCHEN_FLOW: Record<string, DiningOrderStatus[]> = {
  OPEN: ['READY_FOR_PAYMENT', 'CANCELLED'],
  READY_FOR_PAYMENT: [],
};

// Statuses from which a dining order may be charged.
const PAYABLE_STATUSES: DiningOrderStatus[] = ['DELIVERED', 'READY_FOR_PAYMENT'];

// Terminal: la cuenta ya no admite edición de productos.
const LOCKED_STATUSES: DiningOrderStatus[] = ['PAID', 'CANCELLED'];

const ITEM_SELECT = {
  id: true,
  productId: true,
  productName: true,
  unitPrice: true,
  quantity: true,
  notes: true,
  sentToKitchenAt: true,
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
    private readonly inventory: InventoryConsumptionEngine,
    private readonly checkoutEngine: OrderCheckoutEngine,
  ) {}

  async findActive(branchId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    // Todas las cuentas vivas (no terminales): borradores, en cocina y por
    // cobrar. Incluir los estados de cocina permite reabrir una cuenta enviada
    // para capturar rondas adicionales.
    return this.prisma.diningOrder.findMany({
      where: { tenantId, branchId, status: { notIn: ['PAID', 'CLOSED', 'CANCELLED'] } },
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
    // Web (sesión usuario) envía el waiter explícito tras autorizarlo por PIN;
    // la app móvil (token operator) lo deriva de la identidad del token.
    const waiterId = dto.waiterId ?? this.auditContext.getUserId();
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

  /**
   * Carga una orden que admite edición de productos: cualquiera que NO esté en
   * estado terminal (PAID/CANCELLED). Habilita rondas adicionales sobre cuentas
   * ya enviadas a cocina (SENT_TO_KITCHEN/IN_PREPARATION/READY/READY_FOR_PAYMENT).
   */
  private async requireEditableOrder(tenantId: string, branchId: string, orderId: string) {
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId, status: { notIn: LOCKED_STATUSES } },
      select: { id: true, status: true },
    });
    if (!order) throw new NotFoundException('Orden activa no encontrada o ya cerrada.');
    return order;
  }

  async addItem(branchId: string, orderId: string, dto: AddDiningItemDto) {
    const tenantId = this.tenantContext.requireTenantId();
    await this.requireEditableOrder(tenantId, branchId, orderId);

    // Captura offline: la línea trae un id de cliente. Se crea con ese id sin
    // fusionar e idempotente — si ya existe (reintento de sync), se devuelve tal
    // cual para no duplicar. Permite update/remove por id antes de sincronizar.
    if (dto.id) {
      const existing = await this.prisma.diningOrderItem.findUnique({
        where: { id: dto.id },
        select: ITEM_SELECT,
      });
      if (existing) return existing;
      return this.prisma.diningOrderItem.create({
        data: {
          id: dto.id,
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

    // Solo se fusiona con una línea PENDIENTE (no enviada) del mismo producto y
    // nota. Las líneas ya enviadas a cocina nunca se tocan (no se re-prepara lo
    // hecho); un producto repetido en otra ronda es una línea pendiente nueva.
    if (dto.productId) {
      const existing = await this.prisma.diningOrderItem.findFirst({
        where: { orderId, productId: dto.productId, notes: dto.notes ?? null, sentToKitchenAt: null },
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
        // Nueva línea = pendiente de envío (sentToKitchenAt null por defecto).
      },
      select: ITEM_SELECT,
    });
  }

  async updateItem(branchId: string, orderId: string, itemId: string, dto: UpdateDiningItemDto) {
    const tenantId = this.tenantContext.requireTenantId();
    await this.requireEditableOrder(tenantId, branchId, orderId);

    const item = await this.prisma.diningOrderItem.findFirst({
      where: { id: itemId, orderId },
      select: { id: true, sentToKitchenAt: true },
    });
    if (!item) throw new NotFoundException('Ítem no encontrado.');
    // No se modifica lo ya enviado a cocina (puede estar en preparación).
    if (item.sentToKitchenAt) {
      throw new ConflictException('El producto ya fue enviado a cocina; no se puede modificar.');
    }

    return this.prisma.diningOrderItem.update({
      where: { id: itemId },
      data: {
        ...(dto.quantity != null && { quantity: dto.quantity }),
        ...(dto.notes !== undefined && { notes: dto.notes.trim() || null }),
      },
      select: ITEM_SELECT,
    });
  }

  async removeItem(branchId: string, orderId: string, itemId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    await this.requireEditableOrder(tenantId, branchId, orderId);

    const item = await this.prisma.diningOrderItem.findFirst({
      where: { id: itemId, orderId },
      select: { id: true, sentToKitchenAt: true },
    });
    if (!item) throw new NotFoundException('Ítem no encontrado.');
    // No se elimina lo ya enviado a cocina.
    if (item.sentToKitchenAt) {
      throw new ConflictException('El producto ya fue enviado a cocina; no se puede eliminar.');
    }

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

  /**
   * Enviar una ronda: marca como enviados SOLO los ítems pendientes
   * (sentToKitchenAt null) y lleva la cuenta al estado de envío correspondiente.
   * Soporta rondas múltiples sobre la misma cuenta sin duplicar DiningOrder y
   * sin re-enviar lo ya preparado. Con cocina → SENT_TO_KITCHEN (la cuenta
   * vuelve a la cola del KDS con la ronda nueva); sin cocina → READY_FOR_PAYMENT.
   */
  async fireRound(branchId: string, orderId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.requireEditableOrder(tenantId, branchId, orderId);

    const pending = await this.prisma.diningOrderItem.count({
      where: { orderId, sentToKitchenAt: null },
    });
    if (pending === 0) {
      throw new BadRequestException('No hay productos pendientes de enviar.');
    }

    const kitchenEnabled = await this.isKitchenEnabled(tenantId);
    const target: DiningOrderStatus = kitchenEnabled ? 'SENT_TO_KITCHEN' : 'READY_FOR_PAYMENT';

    const [, updated] = await this.prisma.$transaction([
      this.prisma.diningOrderItem.updateMany({
        where: { orderId, sentToKitchenAt: null },
        data: { sentToKitchenAt: new Date() },
      }),
      this.prisma.diningOrder.update({
        where: { id: orderId },
        data: { status: target },
        select: ORDER_SELECT,
      }),
    ]);
    return updated;
  }

  /**
   * Charge a dining order: convert it into a financial Order, consume inventory,
   * record Payment + CashMovement, link the dining order (orderId) and close it,
   * releasing the table. Atomic and idempotent — a dining order that already
   * carries an orderId (or is concurrently charged) is rejected. This is the only
   * path that takes a dining order to PAID and the one that makes mobile comandas
   * produce the same financial footprint as POS and Restaurant Web.
   */
  async checkout(branchId: string, orderId: string, dto: CheckoutDiningOrderDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId() ?? null;

    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId },
      select: {
        id: true,
        status: true,
        orderId: true,
        tableId: true,
        reference: true,
        table: { select: { name: true } },
        waiter: { select: { firstName: true, lastName: true } },
        items: {
          select: { productId: true, productName: true, unitPrice: true, quantity: true, notes: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    if (order.orderId) throw new ConflictException('La cuenta ya fue cobrada.');
    if (!PAYABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException('La orden no está lista para cobro.');
    }
    if (order.items.length === 0) {
      throw new BadRequestException('La orden no tiene productos; no se puede cobrar.');
    }

    // Optional customer for billing / CxC on the generated Order.
    let customerId: string | null = null;
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId },
        select: { id: true },
      });
      if (!customer) throw new NotFoundException('Cliente no encontrado.');
      customerId = customer.id;
    }

    const total = roundMoney(
      order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0),
    );
    const totalPaid = roundMoney(dto.payments.reduce((s, p) => s + p.amount, 0));
    if (totalPaid < total) {
      throw new BadRequestException(`Pago insuficiente. Total: $${total}, pagado: $${totalPaid}`);
    }

    const session = await this.checkoutEngine.resolveActiveCashSession(tenantId, branchId);
    const waiterName = `${order.waiter.firstName} ${order.waiter.lastName}`.trim();
    const orderNumber = `C-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      // Optimistic idempotency lock: only proceed if still unlinked.
      const linked = await tx.diningOrder.updateMany({
        where: { id: orderId, orderId: null },
        data: { status: 'PAID', closedAt: new Date() },
      });
      if (linked.count === 0) throw new ConflictException('La cuenta ya fue cobrada.');

      // 1. Financial Order header.
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          tenantId,
          orderOrigin: 'RESTAURANT_COMANDA',
          subtotal: total,
          tax: 0,
          shippingCost: 0,
          discount: 0,
          total,
          status: 'DELIVERED',
          paymentStatus: 'PAID',
          tableNumber: order.table?.name ?? null,
          employeeNumber: waiterName || null,
          notes: order.reference ?? null,
          ...(branchId != null && { branchId }),
          ...(customerId != null && { customerId }),
          ...(userId != null && { createdById: userId }),
        },
      });

      // 2. OrderItems mapped from dining items.
      for (const it of order.items) {
        const isProduct = it.productId != null;
        const line = roundMoney(Number(it.unitPrice) * it.quantity);
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            itemType: isProduct ? 'PRODUCT' : 'SERVICE',
            ...(isProduct && { productId: it.productId }),
            name: it.productName,
            description: it.notes ?? null,
            sku: null,
            quantity: it.quantity,
            price: it.unitPrice,
            discount: 0,
            tax: 0,
            subtotal: line,
            total: line,
          },
        });
      }

      // 3. Inventory consumption (SIMPLE / RECIPE / COMBO).
      await this.inventory.consume(
        tx,
        order.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          itemType: i.productId != null ? 'PRODUCT' : 'SERVICE',
        })),
        { tenantId, branchId, userId, referenceId: newOrder.id, referenceType: 'ORDER' },
      );

      // 4. Shared financial footprint: Payment + CashMovement.
      await this.checkoutEngine.createPayments(tx, { orderId: newOrder.id, payments: dto.payments, userId });
      await this.checkoutEngine.createCashMovements(tx, {
        tenantId,
        sessionId: session.id,
        orderId: newOrder.id,
        payments: dto.payments,
        userId,
      });

      // 5. Link the dining order to its financial Order.
      await tx.diningOrder.update({
        where: { id: orderId },
        data: { orderId: newOrder.id },
      });

      // 6. Release the table.
      if (order.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE' },
        });
      }

      return tx.order.findUnique({
        where: { id: newOrder.id },
        include: { items: true, payments: true },
      });
    });
  }
}
