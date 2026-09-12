/**
 * Every query key in one place.
 *
 * Hierarchical arrays so a partial key invalidates a whole subtree, e.g.
 * `invalidateQueries({ queryKey: queryKeys.auth.all })`.
 *
 * **Scope.** Cada clave de datos de negocio lleva `tenantId`, y las que
 * dependen de la sucursal llevan además `branchId`: precio, existencia, caja y
 * ventas son *de una sucursal*, así que sin él cambiar de sucursal seguiría
 * pintando los datos de la anterior hasta que expirara el `staleTime`.
 *
 * Las claves se escribían a mano en cada hook. Con el ciclo del día las
 * invalidaciones se cruzan —una venta ensucia productos *y* el corte de caja—
 * y una clave mal tecleada deja de invalidar en silencio.
 */

/** Ámbito de un tenant; `undefined` mientras no hay empresa elegida. */
type TenantScope = string | undefined;
/** Ámbito de sucursal; `undefined` hasta que el token la trae. */
type BranchScope = string | undefined;

export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    profile: () => [...queryKeys.auth.all, 'profile'] as const,
    capabilities: () => [...queryKeys.auth.all, 'capabilities'] as const,
  },

  catalogs: {
    all: ['catalogs'] as const,
    businessTypes: () => [...queryKeys.catalogs.all, 'business-types'] as const,
  },

  tenant: {
    all: ['tenant'] as const,
    branding: (tenantId: string) => [...queryKeys.tenant.all, 'branding', tenantId] as const,
    info: (tenantId: string) => [...queryKeys.tenant.all, 'info', tenantId] as const,
    settings: (tenantId: string) => [...queryKeys.tenant.all, 'settings', tenantId] as const,
  },

  branches: {
    all: ['branches'] as const,
    list: (tenantId: TenantScope) => [...queryKeys.branches.all, 'list', tenantId] as const,
  },

  dashboard: {
    all: ['dashboard'] as const,
    stats: (tenantId: TenantScope) => [...queryKeys.dashboard.all, 'stats', tenantId] as const,
  },

  products: {
    all: ['products'] as const,
    /** Raíz de las listas: invalida cualquier combinación de filtros. */
    lists: (tenantId: TenantScope, branchId: BranchScope) =>
      [...queryKeys.products.all, 'list', tenantId, branchId] as const,
    list: (tenantId: TenantScope, branchId: BranchScope, params: unknown) =>
      [...queryKeys.products.lists(tenantId, branchId), params] as const,
    details: (tenantId: TenantScope, branchId: BranchScope) =>
      [...queryKeys.products.all, 'detail', tenantId, branchId] as const,
    detail: (tenantId: TenantScope, branchId: BranchScope, id: string | undefined) =>
      [...queryKeys.products.details(tenantId, branchId), id] as const,
  },

  categories: {
    all: ['categories'] as const,
    list: (tenantId: TenantScope) => [...queryKeys.categories.all, 'list', tenantId] as const,
  },

  customers: {
    all: ['customers'] as const,
    lists: (tenantId: TenantScope) => [...queryKeys.customers.all, 'list', tenantId] as const,
    list: (tenantId: TenantScope, params: unknown) =>
      [...queryKeys.customers.lists(tenantId), params] as const,
    details: (tenantId: TenantScope) => [...queryKeys.customers.all, 'detail', tenantId] as const,
    detail: (tenantId: TenantScope, id: string | undefined) =>
      [...queryKeys.customers.details(tenantId), id] as const,
  },

  orders: {
    all: ['orders'] as const,
    lists: (tenantId: TenantScope, branchId: BranchScope) =>
      [...queryKeys.orders.all, 'list', tenantId, branchId] as const,
    list: (tenantId: TenantScope, branchId: BranchScope, params: unknown) =>
      [...queryKeys.orders.lists(tenantId, branchId), params] as const,
    details: (tenantId: TenantScope, branchId: BranchScope) =>
      [...queryKeys.orders.all, 'detail', tenantId, branchId] as const,
    detail: (tenantId: TenantScope, branchId: BranchScope, id: string | undefined) =>
      [...queryKeys.orders.details(tenantId, branchId), id] as const,
  },

  cash: {
    all: ['cash'] as const,
    /**
     * La sesión viva de la caja. Lleva `cashRegisterId` porque la caja
     * pertenece al puesto: dos terminales de la misma sucursal miran sesiones
     * distintas y no deben compartir entrada de caché.
     */
    active: (tenantId: TenantScope, branchId: BranchScope, cashRegisterId?: string) =>
      [...queryKeys.cash.all, 'active', tenantId, branchId, cashRegisterId] as const,
    sessions: (tenantId: TenantScope, branchId: BranchScope) =>
      [...queryKeys.cash.all, 'sessions', tenantId, branchId] as const,
    sessionList: (tenantId: TenantScope, branchId: BranchScope, params: unknown) =>
      [...queryKeys.cash.sessions(tenantId, branchId), 'list', params] as const,
    session: (tenantId: TenantScope, branchId: BranchScope, id: string | undefined) =>
      [...queryKeys.cash.sessions(tenantId, branchId), 'detail', id] as const,
    counts: (tenantId: TenantScope, branchId: BranchScope, sessionId: string | undefined) =>
      [...queryKeys.cash.sessions(tenantId, branchId), 'counts', sessionId] as const,
    registers: (tenantId: TenantScope, branchId: BranchScope) =>
      [...queryKeys.cash.all, 'registers', tenantId, branchId] as const,
    capacity: (tenantId: TenantScope, branchId: BranchScope) =>
      [...queryKeys.cash.all, 'capacity', tenantId, branchId] as const,
  },
} as const;
