import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DiningOrderStatus, Prisma, RestaurantVisibilityMode } from '@prisma/client';
import { getModulesForPlan, SystemModule } from '@orbix/types';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { OpenDiningOrderDto, AddDiningItemDto, UpdateDiningItemDto, DiningOrderScope } from './dto/dining-order.dto';
import { CheckoutDiningOrderDto } from './dto/checkout-dining-order.dto';
import { InventoryConsumptionEngine } from '../../retail/inventory/inventory-consumption.engine';
import { OrderCheckoutEngine } from '../../retail/checkout/order-checkout.engine';
import { RestaurantVisibilityService } from '../visibility/restaurant-visibility.service';
import { roundMoney } from '../../../common/utils/money.util';
import { assertBranchBelongs } from '../../../common/helpers/assert-branch-belongs';

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

// Estados activos: una mesa con una cuenta en cualquiera de ellos NO admite otra.
// Espejo del índice único parcial de la BD (todos menos PAID/CLOSED/CANCELLED).
const ACTIVE_STATUSES: DiningOrderStatus[] = [
  'OPEN', 'SENT_TO_KITCHEN', 'IN_PREPARATION', 'READY', 'DELIVERED', 'READY_FOR_PAYMENT',
];

// Nombre del índice único parcial (una cuenta activa por mesa) — para traducir la
// violación P2002 a un mensaje de negocio claro.
const ACTIVE_TABLE_UNIQUE_INDEX = 'dining_orders_active_table_key';

const ITEM_SELECT = {
  id: true,
  productId: true,
  productName: true,
  unitPrice: true,
  quantity: true,
  notes: true,
  sentToKitchenAt: true,
  kitchenRoundId: true,
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
    private readonly visibility: RestaurantVisibilityService,
  ) {}

  async findActive(branchId: string, scope: DiningOrderScope = 'all') {
    const tenantId = this.tenantContext.requireTenantId();
    await assertBranchBelongs(this.prisma, tenantId, branchId);
    // Todas las cuentas vivas (no terminales): borradores, en cocina y por
    // cobrar. Incluir los estados de cocina permite reabrir una cuenta enviada
    // para capturar rondas adicionales.
    //
    // `scope` declara la intención del solicitante (caja vs operador). Hoy ambos
    // ven todo; el filtro de visibilidad se resuelve en un único punto para que
    // OWN_ONLY (futuro) restrinja solo a 'own' sin afectar nunca a la caja.
    const visibilityWhere = await this.resolveVisibilityWhere(tenantId, branchId, scope);
    return this.prisma.diningOrder.findMany({
      where: {
        tenantId,
        branchId,
        status: { notIn: ['PAID', 'CLOSED', 'CANCELLED'] },
        ...visibilityWhere,
      },
      orderBy: { openedAt: 'asc' },
      select: ORDER_SELECT,
    });
  }

  /**
   * Punto de extensión para `restaurantVisibilityMode` (Opción A). Resuelve el
   * modo configurado por sucursal y, en el futuro, devolverá el filtro de
   * DiningOrder correspondiente. HOY NO FILTRA: devuelve `{}` en todos los casos
   * y para todos los modos — solo fija el contrato.
   *
   * Reglas (Opción A — aprobadas):
   *  - 'all' (caja): SIEMPRE `{}`. La caja ve todas las cuentas en cualquier
   *    modo. Se retorna antes de mirar el modo: inmune por construcción.
   *  - 'own' (operador): aquí entrará el filtro según el modo:
   *      · SHARED              → `{}` (sin filtro; comportamiento actual).
   *      · OWN_ONLY            → FUTURO `{ waiterId: this.auditContext.getUserId() }`
   *                              (identidad de confianza: proviene del token operador).
   *      · OWN_WITH_SUPERVISOR → FUTURO `{ OR: [ {waiterId: yo}, {<supervisores>} ] }`.
   *
   * Mesas, Kitchen y Caja NO se filtran aquí ni en ningún otro punto: este es el
   * ÚNICO lugar donde el modo afectará la visibilidad, y solo para scope 'own'.
   */
  private async resolveVisibilityWhere(
    tenantId: string,
    branchId: string,
    scope: DiningOrderScope,
  ): Promise<Prisma.DiningOrderWhereInput> {
    // Caja: inmune al modo. Se decide antes de resolverlo.
    if (scope === 'all') return {};

    // Operador: el modo gobernará el filtro futuro. Hoy se resuelve pero NO se
    // aplica — todos los modos devuelven `{}` para preservar el comportamiento.
    const mode = await this.visibility.resolveRestaurantVisibilityMode(tenantId, branchId);
    switch (mode) {
      case RestaurantVisibilityMode.OWN_ONLY:
        // FUTURO: return { waiterId: this.auditContext.getUserId() };
        return {};
      case RestaurantVisibilityMode.OWN_WITH_SUPERVISOR:
        // FUTURO: return { OR: [{ waiterId: this.auditContext.getUserId() }, /* supervisores */] };
        return {};
      case RestaurantVisibilityMode.SHARED:
      default:
        return {};
    }
  }

  async findForTable(branchId: string, tableId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    await assertBranchBelongs(this.prisma, tenantId, branchId);
    // La cuenta viva de la mesa puede estar en cualquier estado activo (en cocina,
    // por cobrar…), no solo OPEN. El índice único garantiza que haya a lo sumo una.
    const order = await this.prisma.diningOrder.findFirst({
      where: { tenantId, branchId, tableId, status: { in: ACTIVE_STATUSES } },
      select: ORDER_SELECT,
    });
    if (!order) return null;
    // La mesa sigue siendo global (su ocupación se ve vía /tables). Lo que se
    // protege aquí es el DETALLE de la cuenta: bajo modos restrictivos, abrir la
    // cuenta de una mesa atendida por otro operador se trata como inexistente.
    await this.visibility.assertCanAccessOrder({ waiterId: order.waiter.id, branchId });
    return order;
  }

  async open(branchId: string, dto: OpenDiningOrderDto) {
    const tenantId = this.tenantContext.requireTenantId();
    await assertBranchBelongs(this.prisma, tenantId, branchId);
    // Identidad del mesero, fuente única según el principal:
    //  - Token operador (mobile + web operator-login): SIEMPRE el empleado del
    //    token. Se IGNORA cualquier `dto.waiterId` del cliente — el operador
    //    autenticado no puede atribuir una cuenta a otro empleado.
    //  - Sesión de usuario (sin operador): el cliente envía el waiter explícito
    //    (web legacy tras verificar PIN); cae al usuario solo como último recurso.
    const waiterId = this.auditContext.isOperator()
      ? this.auditContext.getUserId()
      : (dto.waiterId ?? this.auditContext.getUserId());
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

    // Pre-chequeo amigable (cualquier estado activo, no solo OPEN). No es la
    // garantía: dos requests concurrentes pueden cruzarlo antes de insertar. La
    // garantía real es el índice único parcial de la BD, cuya violación se traduce
    // abajo a un ConflictException. Check + índice = mensaje claro y cero duplicados.
    const existing = await this.prisma.diningOrder.findFirst({
      where: { tableId, status: { in: ACTIVE_STATUSES } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('La mesa ya tiene una cuenta activa.');

    try {
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
    } catch (e) {
      // P2002 sobre el índice parcial = otra request ganó la carrera y ya abrió
      // la cuenta activa de esta mesa. Se reporta como conflicto de negocio.
      if (this.isActiveTableUniqueViolation(e)) {
        throw new ConflictException('La mesa ya tiene una cuenta activa.');
      }
      throw e;
    }
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

  /**
   * True cuando el error es una violación del índice único parcial que protege
   * "una sola cuenta activa por mesa" (Prisma P2002). El target del error trae el
   * nombre del índice, así no se confunde con otros uniques de la tabla.
   */
  private isActiveTableUniqueViolation(e: unknown): boolean {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') {
      return false;
    }
    const target = e.meta?.target;
    if (typeof target === 'string') return target.includes(ACTIVE_TABLE_UNIQUE_INDEX);
    if (Array.isArray(target)) return target.includes(ACTIVE_TABLE_UNIQUE_INDEX) || target.includes('tableId');
    // Sin metadata del target: ante un P2002 en este flujo, asumir el índice de mesa.
    return true;
  }

  async findOne(branchId: string, orderId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    await assertBranchBelongs(this.prisma, tenantId, branchId);
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId },
      select: ORDER_SELECT,
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    // Autorización por recurso (lectura por id): no revelar comandas ajenas.
    await this.visibility.assertCanAccessOrder({ waiterId: order.waiter.id, branchId });
    return order;
  }

  /**
   * Carga una orden que admite edición de productos: cualquiera que NO esté en
   * estado terminal (PAID/CANCELLED). Habilita rondas adicionales sobre cuentas
   * ya enviadas a cocina (SENT_TO_KITCHEN/IN_PREPARATION/READY/READY_FOR_PAYMENT).
   */
  private async requireEditableOrder(tenantId: string, branchId: string, orderId: string) {
    await assertBranchBelongs(this.prisma, tenantId, branchId);
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId, status: { notIn: LOCKED_STATUSES } },
      select: { id: true, status: true, waiterId: true },
    });
    if (!order) throw new NotFoundException('Orden activa no encontrada o ya cerrada.');
    // Autorización por recurso: bajo modos restrictivos, un operador no edita
    // (addItem/updateItem/removeItem/fireRound) comandas ajenas conociendo su id.
    await this.visibility.assertCanAccessOrder({ waiterId: order.waiterId, branchId });
    return order;
  }

  async addItem(branchId: string, orderId: string, dto: AddDiningItemDto) {
    const tenantId = this.tenantContext.requireTenantId();
    await this.requireEditableOrder(tenantId, branchId, orderId);

    // `productId` viaja en el body: sin esta comprobación un id de otra
    // organización quedaba persistido en la línea y, al cobrar la comanda,
    // `InventoryConsumptionEngine` descontaba el stock de esa organización.
    if (dto.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId, tenantId },
        select: { id: true },
      });
      if (!product) throw new NotFoundException('Producto no encontrado en esta empresa');
    }

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
    await assertBranchBelongs(this.prisma, tenantId, branchId);
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId },
      select: { id: true, status: true, tableId: true, waiterId: true, _count: { select: { items: true } } },
    });
    if (!order) return { discarded: false as const };
    // Autorización por recurso: no descartar la comanda en borrador de otro operador.
    await this.visibility.assertCanAccessOrder({ waiterId: order.waiterId, branchId });

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
    if (branchId) await assertBranchBelongs(this.prisma, tenantId, branchId);
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

  /** True when the tenant's effective modules include CAJA_NODE (Nodo de Caja). */
  private async isCajaNodeEnabled(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, enabledModules: true },
    });
    if (!tenant) return false;
    const planModules = getModulesForPlan(tenant.plan) as unknown as string[];
    const effective = new Set([...planModules, ...tenant.enabledModules]);
    return effective.has(SystemModule.CAJA_NODE);
  }

  /** Effective permission keys for a web User (role assignments ∪ grants, minus revokes). */
  private async getEffectivePermissions(userId: string, tenantId: string): Promise<string[]> {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, tenantId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const keys = new Set<string>();
    for (const a of assignments) {
      for (const rp of a.role.permissions) keys.add(rp.permission.key);
    }
    const grants = await this.prisma.userPermissionGrant.findMany({
      where: { userId, tenantId },
      include: { permission: true },
    });
    for (const g of grants) {
      if (g.granted) keys.add(g.permission.key);
      else keys.delete(g.permission.key);
    }
    return [...keys];
  }

  /**
   * Nodo de Caja activo → cobrar requiere el permiso dedicado `caja:charge`
   * (estación de Caja), no basta con `orders:create` (el permiso del mesero).
   * Módulo inactivo → sin restricción adicional (comportamiento histórico).
   */
  private async assertCanCharge(
    tenantId: string,
    actor: { id?: string; role?: string; tenantId?: string; permissions?: string[] } | undefined,
  ): Promise<void> {
    if (!(await this.isCajaNodeEnabled(tenantId))) return;
    if (!actor?.id) throw new ForbiddenException('No se pudo identificar al usuario.');
    if (actor.role === 'SUPER_ADMIN') return;

    const permissions = actor.role === 'DEVICE_OPERATOR'
      ? (actor.permissions ?? [])
      : await this.getEffectivePermissions(actor.id, tenantId);

    if (!permissions.includes('caja:charge')) {
      throw new ForbiddenException(
        'Esta cuenta debe cobrarse desde la estación de Caja (Nodo de Caja activo).',
      );
    }
  }

  /**
   * Advance a dining order along its lifecycle. The valid graph depends on the
   * KITCHEN module: with kitchen the order routes through preparation states;
   * without it the order jumps straight to READY_FOR_PAYMENT.
   * PAID/CANCELLED are terminal and release the table if any.
   */
  async changeStatus(branchId: string, orderId: string, target: DiningOrderStatus) {
    const tenantId = this.tenantContext.requireTenantId();
    await assertBranchBelongs(this.prisma, tenantId, branchId);
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId },
      select: { id: true, status: true, tableId: true, waiterId: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    // Autorización por recurso: no avanzar el ciclo de una comanda ajena por id.
    await this.visibility.assertCanAccessOrder({ waiterId: order.waiterId, branchId });

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
    await this.requireEditableOrder(tenantId, branchId, orderId);

    const pendingCount = await this.prisma.diningOrderItem.count({
      where: { orderId, sentToKitchenAt: null },
    });
    if (pendingCount === 0) {
      throw new BadRequestException('No hay productos pendientes de enviar.');
    }

    const kitchenEnabled = await this.isKitchenEnabled(tenantId);
    const target: DiningOrderStatus = kitchenEnabled ? 'SENT_TO_KITCHEN' : 'READY_FOR_PAYMENT';

    return this.prisma.$transaction(async (tx) => {
      // Determine the next round number for this order.
      const lastRound = await tx.kitchenRound.findFirst({
        where: { orderId },
        orderBy: { roundNumber: 'desc' },
        select: { roundNumber: true },
      });
      const nextRoundNumber = (lastRound?.roundNumber ?? 0) + 1;
      const now = new Date();

      // Create the round record.
      const round = await tx.kitchenRound.create({
        data: { orderId, roundNumber: nextRoundNumber, sentAt: now },
      });

      // Stamp pending items with this round's id and timestamp.
      await tx.diningOrderItem.updateMany({
        where: { orderId, sentToKitchenAt: null },
        data: { sentToKitchenAt: now, kitchenRoundId: round.id },
      });

      return tx.diningOrder.update({
        where: { id: orderId },
        data: { status: target },
        select: ORDER_SELECT,
      });
    });
  }

  /**
   * Charge a dining order: convert it into a financial Order, consume inventory,
   * record Payment + CashMovement, link the dining order (orderId) and close it,
   * releasing the table. Atomic and idempotent — a dining order that already
   * carries an orderId (or is concurrently charged) is rejected. This is the only
   * path that takes a dining order to PAID and the one that makes mobile comandas
   * produce the same financial footprint as POS and Restaurant Web.
   */
  async checkout(
    branchId: string,
    orderId: string,
    dto: CheckoutDiningOrderDto,
    actor?: { id?: string; role?: string; tenantId?: string; permissions?: string[] },
  ) {
    const tenantId = this.tenantContext.requireTenantId();
    await assertBranchBelongs(this.prisma, tenantId, branchId);
    const userId = this.auditContext.getUserId() ?? null;
    await this.assertCanCharge(tenantId, actor);

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
          select: { productId: true, productName: true, unitPrice: true, quantity: true, notes: true, sentToKitchenAt: true },
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

    // Con cocina habilitada: bloquear checkout si existen ítems capturados pero nunca enviados.
    // Sin cocina: no aplica porque fireRound no forma parte del flujo.
    const kitchenEnabled = await this.isKitchenEnabled(tenantId);
    if (kitchenEnabled) {
      const pendingItems = order.items.filter(i => i.sentToKitchenAt === null);
      if (pendingItems.length > 0) {
        throw new BadRequestException(
          'Existen productos pendientes por enviar a cocina. Envía la ronda antes de cobrar.',
        );
      }
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
