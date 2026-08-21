// Shared types between @orbix/api and @orbix/web

export interface ListResponse<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type Currency = 'MXN' | 'USD'

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' | 'OTHER'

export type CashMovementType =
  | 'SALE'
  | 'CXC_PAYMENT'
  | 'SUPPLIER_PAYMENT'
  | 'INCOME'
  | 'EXPENSE'

export type CashSessionStatus = 'ABIERTA' | 'CERRADA'

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'

export type KitchenOrderStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'READY'
  | 'REJECTED'
  | 'DELIVERED'

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED'

// ─── Business verticals & POS modes ──────────────────────────────────────────

export type BusinessVertical = 'RETAIL' | 'RESTAURANT' | 'GYM' | 'SERVICES'
export type PosOperationMode = 'QUICK_SALE' | 'TABLE_SERVICE'
export type TenantFeature =
  | 'TABLES'
  | 'KITCHEN'
  | 'DELIVERY'
  | 'MEMBERSHIPS'
  | 'ACCESS_CONTROL'
  | 'SERVICES'
  | 'APPOINTMENTS'

export const VERTICAL_DEFAULT_POS_MODE: Record<BusinessVertical, PosOperationMode> = {
  RETAIL:     'QUICK_SALE',
  RESTAURANT: 'TABLE_SERVICE',
  GYM:        'QUICK_SALE',
  SERVICES:   'QUICK_SALE',
}

export const VERTICAL_DEFAULT_FEATURES: Record<BusinessVertical, TenantFeature[]> = {
  RETAIL:     [],
  RESTAURANT: ['TABLES', 'KITCHEN'],
  GYM:        ['MEMBERSHIPS', 'ACCESS_CONTROL'],
  SERVICES:   ['SERVICES', 'APPOINTMENTS'],
}

// ─── Plan tiers ──────────────────────────────────────────────────────────────

export type TenantPlan = 'FREE' | 'STARTER' | 'PRO' | 'PLUS' | 'ENTERPRISE'

export const PLAN_ORDER: TenantPlan[] = ['FREE', 'STARTER', 'PRO', 'PLUS', 'ENTERPRISE']

// ─── System modules ───────────────────────────────────────────────────────────
// Each value matches the sidebar route key and the @RequireModule() decorator.

export enum SystemModule {
  DASHBOARD     = 'dashboard',
  POS           = 'pos',
  VENTAS        = 'ventas',
  INVENTARIO    = 'inventario',
  CLIENTES      = 'clientes',
  /** Pedidos enviados por WhatsApp desde la tienda en línea (sin pago en
   *  línea). Base del storefront público, igual de siempre disponible. */
  STORE_ORDERS  = 'store-orders',
  COMPRAS       = 'compras',
  PROVEEDORES   = 'proveedores',
  SERVICIOS     = 'servicios',
  COTIZACIONES      = 'cotizaciones',
  ORDENES_TRABAJO   = 'ordenes-trabajo',
  CXC           = 'cxc',
  CXP           = 'cxp',
  CAJA          = 'caja',
  REPORTES      = 'reportes',
  USUARIOS      = 'usuarios',
  ROLES         = 'roles',
  CONFIGURACION = 'configuracion',
  BRANCHES      = 'branches',
  EMPLEADOS     = 'empleados',
  COMANDA            = 'comanda',
  RESTAURANT_TABLES  = 'restaurant-tables',
  CAJA_RESTAURANTE   = 'caja-restaurante',
  INSUMOS            = 'insumos',
  DINING_AREAS       = 'dining-areas',
  /** Nodo de Caja: comandas completadas pasan a caja para cobro en vez de
   *  cobrarse directo en la comandera. Off → cobro inmediato (comportamiento
   *  histórico). Restaurant-only. */
  CAJA_NODE          = 'caja-nodo',
  // Future verticals
  GYM           = 'gym',
  KITCHEN       = 'kitchen',
  DELIVERY      = 'delivery',
  MEMBERSHIPS   = 'memberships',
  ACCESS_CONTROL = 'access-control',
  /** Editor de la tienda en línea (plantillas + secciones). No entra en
   *  ningún plan ni vertical por defecto — plataforma lo habilita por
   *  tenant a mano, igual que un addon. */
  TIENDA_ONLINE = 'tienda-online',
}

// Modules included per plan tier (cumulative — each tier adds to the previous).
// POS and COMANDA are NOT in the base plan: they are assigned as vertical-specific
// extras at provision time via VERTICAL_DEFAULT_EXTRAS.
const MODULES_BY_TIER: Array<{ plan: TenantPlan; modules: SystemModule[] }> = [
  {
    plan: 'FREE',
    modules: [
      SystemModule.DASHBOARD,
      SystemModule.VENTAS,
      // Selling anything requires a product catalog — INVENTARIO can't be a
      // paid upgrade while VENTAS is free, or FREE tenants could never create
      // a sellable product in the first place.
      SystemModule.INVENTARIO,
      SystemModule.CLIENTES,
      SystemModule.STORE_ORDERS,
      SystemModule.CAJA,
      SystemModule.USUARIOS,
      SystemModule.ROLES,
      SystemModule.CONFIGURACION,
      SystemModule.COMANDA,
      SystemModule.CAJA_RESTAURANTE,
    ],
  },
  {
    plan: 'STARTER',
    modules: [SystemModule.INSUMOS],
  },
  {
    plan: 'PRO',
    modules: [
      SystemModule.COMPRAS,
      SystemModule.PROVEEDORES,
      SystemModule.SERVICIOS,
      SystemModule.COTIZACIONES,
      SystemModule.ORDENES_TRABAJO,
      SystemModule.EMPLEADOS,
      SystemModule.REPORTES,
      SystemModule.BRANCHES,
    ],
  },
  {
    plan: 'PLUS',
    modules: [SystemModule.CXC, SystemModule.CXP],
  },
  {
    plan: 'ENTERPRISE',
    modules: [],
  },
]

export function getModulesForPlan(plan: TenantPlan): SystemModule[] {
  const tierIndex = PLAN_ORDER.indexOf(plan)
  return MODULES_BY_TIER.filter((_, i) => i <= tierIndex).flatMap((t) => t.modules)
}

// Extras assigned automatically at tenant provision based on vertical.
// These are stored in Tenant.enabledModules (additive on top of plan).
export const VERTICAL_DEFAULT_EXTRAS: Record<BusinessVertical, string[]> = {
  RETAIL:     [SystemModule.POS],
  RESTAURANT: [SystemModule.COMANDA, SystemModule.RESTAURANT_TABLES, SystemModule.KITCHEN, SystemModule.DINING_AREAS],
  GYM:        [],
  SERVICES:   [],
}

// ─── Vertical / module compatibility ─────────────────────────────────────────
// POS = quick-sale retail; COMANDA/KITCHEN = restaurant-only.
// Extend this map as new verticals are added — no other file needs to change.

export const VERTICAL_INCOMPATIBLE_MODULES: Partial<Record<BusinessVertical, SystemModule[]>> = {
  RETAIL:     [SystemModule.COMANDA, SystemModule.RESTAURANT_TABLES, SystemModule.KITCHEN, SystemModule.DINING_AREAS, SystemModule.CAJA_NODE],
  RESTAURANT: [SystemModule.POS],
}

export function isModuleCompatibleWithVertical(module: string, vertical: BusinessVertical): boolean {
  const incompatible = (VERTICAL_INCOMPATIBLE_MODULES[vertical] ?? []) as unknown as string[]
  return !incompatible.includes(module)
}

export function getAllowedModulesForVertical(modules: string[], vertical: BusinessVertical): string[] {
  return modules.filter(m => isModuleCompatibleWithVertical(m, vertical))
}

// ─── Per-tenant access state (lives on TenantMembership, NOT on the global User)
// ────────────────────────────────────────────────────────────────────────────

export type MembershipStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'INVITED'

// Only ACTIVE memberships consume a plan seat.
export const SEAT_CONSUMING_STATUS: MembershipStatus = 'ACTIVE'

// ─── User limits per plan tier ────────────────────────────────────────────────
// `null` means unlimited (ENTERPRISE). A non-null `Tenant.userLimitOverride`
// takes precedence over the plan default for ANY plan.

export const PLAN_USER_LIMITS: Record<TenantPlan, number | null> = {
  FREE: 1,
  STARTER: 5,
  PRO: 10,
  PLUS: 20,
  ENTERPRISE: null,
}

// ─── Branch limits per plan tier ─────────────────────────────────────────────

export const PLAN_BRANCH_LIMITS: Record<TenantPlan, number | null> = {
  FREE:       1,
  STARTER:    1,
  PRO:        3,
  PLUS:       10,
  ENTERPRISE: null,
}

// ─── Cash sessions open at once, per branch ──────────────────────────────────
//
// Tope de sesiones de caja simultáneas en una misma sucursal. No limita cuántas
// cajas físicas existen: limita cuántas pueden estar operando a la vez, que es
// lo que consume licencia y lo que hay que cuadrar al cierre del día.

export const PLAN_CASH_SESSION_LIMITS: Record<TenantPlan, number | null> = {
  // Dos es el default del producto: hasta el plan más chico opera dos cajas a
  // la vez. Restringir eso a una convertía el tope en un muro para el caso
  // normal —un mostrador con dos terminales— en lugar de un límite comercial.
  FREE:       2,
  STARTER:    2,
  PRO:        5,
  PLUS:       15,
  ENTERPRISE: null,
}

/**
 * Max cash sessions open simultaneously in one branch.
 * Returns `null` when unlimited. A positive `override` wins over the plan
 * default (unlike branches, where the extra stacks) — platform sets an absolute
 * number per tenant.
 */
export function getMaxCashSessionsForPlan(
  plan: TenantPlan,
  override?: number | null,
): number | null {
  if (override != null && override > 0) return override
  return PLAN_CASH_SESSION_LIMITS[plan]
}

/**
 * Max active branches allowed for a tenant.
 * Returns `null` when unlimited. A positive `extraBranchLimit` adds to the
 * plan default (not override — it stacks on top of the plan).
 * ENTERPRISE base is unlimited regardless of extra.
 */
export function getMaxBranchesForPlan(
  plan: TenantPlan,
  extraBranchLimit?: number | null,
): number | null {
  const base = PLAN_BRANCH_LIMITS[plan]
  if (base == null) return null // ENTERPRISE = unlimited regardless
  const extra = extraBranchLimit != null && extraBranchLimit > 0 ? extraBranchLimit : 0
  return base + extra
}

/**
 * Max active users allowed for a tenant.
 * Returns `null` when unlimited. A positive `override` wins over the plan default.
 */
export function getMaxUsersForPlan(
  plan: TenantPlan,
  override?: number | null,
): number | null {
  if (override != null && override > 0) return override
  return PLAN_USER_LIMITS[plan]
}

/** True when `activeUsers` is within the limit (unlimited => always true). */
export function isWithinUserLimit(
  activeUsers: number,
  maxUsers: number | null,
): boolean {
  return maxUsers == null || activeUsers <= maxUsers
}
