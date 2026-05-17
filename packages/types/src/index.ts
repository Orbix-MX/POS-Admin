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
    ],
  },
  {
    plan: 'STARTER',
    modules: [SystemModule.INVENTARIO],
  },
  {
    plan: 'PRO',
    modules: [
      SystemModule.COMPRAS,
      SystemModule.PROVEEDORES,
      SystemModule.SERVICIOS,
      SystemModule.COTIZACIONES,
      SystemModule.ORDENES_TRABAJO,
      SystemModule.REPORTES,
    ],
  },
  {
    plan: 'PLUS',
    modules: [SystemModule.CXC, SystemModule.CXP],
  },
  {
    plan: 'ENTERPRISE',
    modules: [SystemModule.BRANCHES],
  },
]

export function getModulesForPlan(plan: TenantPlan): SystemModule[] {
  const tierIndex = PLAN_ORDER.indexOf(plan)
  return MODULES_BY_TIER.filter((_, i) => i <= tierIndex).flatMap((t) => t.modules)
}
