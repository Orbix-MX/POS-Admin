import { platformApi } from '@/lib/platform-api-client'

export type WidgetType =
  | 'COUNTER' | 'BAR_CHART' | 'LINE_CHART' | 'AREA_CHART'
  | 'PIE_CHART' | 'DONUT_CHART' | 'TABLE' | 'RANKING'
  | 'TIMELINE' | 'HEATMAP' | 'FUNNEL' | 'GAUGE' | 'TEXT_CARD'

// ── Tenant-level widget (library item) ────────────────────────────────────────

export interface PlatformWidget {
  id: string
  tenantId: string
  widgetType: WidgetType
  title: string
  subtitle: string | null
  endpoint: string
  httpMethod: string
  defaultParams: Record<string, unknown> | null
  config: Record<string, unknown>
  refreshSeconds: number | null
  isActive: boolean
  createdAt: string
}

// ── Dashboard↔Widget join record ──────────────────────────────────────────────

export interface DashboardWidgetLink {
  id: string
  dashboardId: string
  widgetId: string
  isActive: boolean
  sortOrder: number
  colSpan: number
  widget: PlatformWidget
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardRole {
  dashboardId: string
  roleId: string
  canView: boolean
  canEdit: boolean
  role: { id: string; name: string; color: string | null }
}

export interface PlatformDashboard {
  id: string
  tenantId: string
  name: string
  slug: string
  description: string | null
  isDefault: boolean
  isActive: boolean
  icon: string | null
  createdAt: string
  _count?: { dashboardWidgets: number }
  roles: DashboardRole[]
  dashboardWidgets?: DashboardWidgetLink[]
}

export interface TenantRole {
  id: string
  name: string
  color: string | null
  isSystem: boolean
}

// ── Dashboard CRUD ────────────────────────────────────────────────────────────

export async function listDashboards(tenantId: string): Promise<PlatformDashboard[]> {
  const { data } = await platformApi.get<PlatformDashboard[]>(`/platform/tenants/${tenantId}/dashboards`)
  return data
}

export async function getDashboard(tenantId: string, dashboardId: string): Promise<PlatformDashboard> {
  const { data } = await platformApi.get<PlatformDashboard>(`/platform/tenants/${tenantId}/dashboards/${dashboardId}`)
  return data
}

export async function createDashboard(
  tenantId: string,
  dto: { name: string; slug: string; description?: string; isDefault?: boolean; icon?: string },
): Promise<PlatformDashboard> {
  const { data } = await platformApi.post<PlatformDashboard>(`/platform/tenants/${tenantId}/dashboards`, dto)
  return data
}

export async function updateDashboard(
  tenantId: string,
  dashboardId: string,
  dto: Partial<{ name: string; slug: string; description: string; isDefault: boolean; icon: string; isActive: boolean }>,
): Promise<PlatformDashboard> {
  const { data } = await platformApi.patch<PlatformDashboard>(`/platform/tenants/${tenantId}/dashboards/${dashboardId}`, dto)
  return data
}

export async function deleteDashboard(tenantId: string, dashboardId: string): Promise<void> {
  await platformApi.delete(`/platform/tenants/${tenantId}/dashboards/${dashboardId}`)
}

// ── Widget library (tenant-scoped) ────────────────────────────────────────────

export async function listWidgets(tenantId: string): Promise<PlatformWidget[]> {
  const { data } = await platformApi.get<PlatformWidget[]>(`/platform/tenants/${tenantId}/widgets`)
  return data
}

export async function createWidget(
  tenantId: string,
  dto: {
    widgetType: WidgetType
    title: string
    subtitle?: string
    endpoint: string
    httpMethod?: string
    refreshSeconds?: number
    config?: Record<string, unknown>
  },
): Promise<PlatformWidget> {
  const { data } = await platformApi.post<PlatformWidget>(`/platform/tenants/${tenantId}/widgets`, dto)
  return data
}

export async function updateWidget(
  tenantId: string,
  widgetId: string,
  dto: Partial<{
    widgetType: WidgetType
    title: string
    subtitle: string
    endpoint: string
    httpMethod: string
    refreshSeconds: number
    config: Record<string, unknown>
  }>,
): Promise<PlatformWidget> {
  const { data } = await platformApi.patch<PlatformWidget>(`/platform/tenants/${tenantId}/widgets/${widgetId}`, dto)
  return data
}

export async function deleteWidget(tenantId: string, widgetId: string): Promise<void> {
  await platformApi.delete(`/platform/tenants/${tenantId}/widgets/${widgetId}`)
}

// ── Dashboard↔Widget links ────────────────────────────────────────────────────

export async function listDashboardWidgets(tenantId: string, dashboardId: string): Promise<DashboardWidgetLink[]> {
  const { data } = await platformApi.get<DashboardWidgetLink[]>(`/platform/tenants/${tenantId}/dashboards/${dashboardId}/widgets`)
  return data
}

export async function addWidgetToDashboard(
  tenantId: string,
  dashboardId: string,
  widgetId: string,
  dto: { sortOrder?: number; colSpan?: number },
): Promise<DashboardWidgetLink> {
  const { data } = await platformApi.post<DashboardWidgetLink>(
    `/platform/tenants/${tenantId}/dashboards/${dashboardId}/widgets/${widgetId}`,
    dto,
  )
  return data
}

export async function updateDashboardWidget(
  tenantId: string,
  dashboardId: string,
  widgetId: string,
  dto: Partial<{ sortOrder: number; colSpan: number; isActive: boolean }>,
): Promise<DashboardWidgetLink> {
  const { data } = await platformApi.patch<DashboardWidgetLink>(
    `/platform/tenants/${tenantId}/dashboards/${dashboardId}/widgets/${widgetId}`,
    dto,
  )
  return data
}

export async function removeWidgetFromDashboard(
  tenantId: string,
  dashboardId: string,
  widgetId: string,
): Promise<void> {
  await platformApi.delete(`/platform/tenants/${tenantId}/dashboards/${dashboardId}/widgets/${widgetId}`)
}

export async function reorderDashboardWidgets(
  tenantId: string,
  dashboardId: string,
  widgetIds: string[],
): Promise<DashboardWidgetLink[]> {
  const { data } = await platformApi.put<DashboardWidgetLink[]>(
    `/platform/tenants/${tenantId}/dashboards/${dashboardId}/widgets/reorder`,
    { widgetIds },
  )
  return data
}

// ── Roles ─────────────────────────────────────────────────────────────────────

export async function listTenantRoles(tenantId: string): Promise<TenantRole[]> {
  const { data } = await platformApi.get<TenantRole[]>(`/platform/tenants/${tenantId}/roles`)
  return data
}

export async function assignDashboardRole(
  tenantId: string,
  dashboardId: string,
  roleId: string,
  canView = true,
  canEdit = false,
): Promise<void> {
  await platformApi.post(`/platform/tenants/${tenantId}/dashboards/${dashboardId}/roles`, { roleId, canView, canEdit })
}

export async function removeDashboardRole(tenantId: string, dashboardId: string, roleId: string): Promise<void> {
  await platformApi.delete(`/platform/tenants/${tenantId}/dashboards/${dashboardId}/roles/${roleId}`)
}
