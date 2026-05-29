// Shared types between @ventasy/api and @ventasy/web

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

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED'

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
  COMANDA       = 'comanda',
  INSUMOS       = 'insumos',
  // Future verticals
  GYM           = 'gym',
}

// Modules included per plan tier (cumulative — each tier adds to the previous)
const MODULES_BY_TIER: Array<{ plan: TenantPlan; modules: SystemModule[] }> = [
  {
    plan: 'FREE',
    modules: [
      SystemModule.DASHBOARD,
      SystemModule.POS,
      SystemModule.VENTAS,
      SystemModule.CLIENTES,
      SystemModule.CAJA,
      SystemModule.USUARIOS,
      SystemModule.ROLES,
      SystemModule.CONFIGURACION,
      SystemModule.COMANDA,
    ],
  },
  {
    plan: 'STARTER',
    modules: [SystemModule.INVENTARIO, SystemModule.INSUMOS],
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
