import { api } from '@/lib/api-client'

export type WidgetType =
  | 'COUNTER' | 'BAR_CHART' | 'LINE_CHART' | 'AREA_CHART'
  | 'PIE_CHART' | 'DONUT_CHART' | 'TABLE' | 'RANKING'
  | 'TIMELINE' | 'HEATMAP' | 'FUNNEL' | 'GAUGE' | 'TEXT_CARD'

export interface WidgetMeta {
  currency?: string
  unit?: string
  period?: string
  comparison?: {
    previousValue: number
    changePercent: number
    trend: 'up' | 'down' | 'neutral'
    label: string
  }
  pagination?: { page: number; limit: number; total: number; totalPages: number }
  empty?: boolean
  emptyLabel?: string
}

export interface WidgetDisplayConfig {
  colors?: string[]
  showLegend?: boolean
  showGrid?: boolean
  stacked?: boolean
  animated?: boolean
  dateFormat?: string
  valueFormat?: 'currency' | 'percent' | 'number' | 'compact'
}

export interface WidgetResponse<TData = unknown> {
  success: boolean
  widgetType: WidgetType
  title: string
  subtitle?: string
  data: TData
  meta: WidgetMeta
  config: WidgetDisplayConfig
  error?: string
  lastUpdate: string
}

export interface WidgetConfig {
  id: string
  widgetType: WidgetType
  title: string
  subtitle?: string | null
  endpoint: string
  httpMethod: string
  defaultParams?: Record<string, string> | null
  config: WidgetDisplayConfig
  refreshSeconds?: number | null
  sortOrder: number
  colSpan: number
}

export interface GridItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  static?: boolean
}

export interface DashboardConfig {
  id: string
  name: string
  slug: string
  description?: string | null
  isDefault: boolean
  icon?: string | null
  widgets: WidgetConfig[]
  layouts: Record<string, GridItem[]>
}

export async function fetchActiveDashboard(): Promise<DashboardConfig> {
  const { data } = await api.get<DashboardConfig>('/dashboards/active')
  return data
}

export async function fetchWidgetData<T = unknown>(
  widgetId: string,
  params?: Record<string, string> | null,
): Promise<WidgetResponse<T>> {
  const { data } = await api.get<WidgetResponse<T>>(`/widgets/${widgetId}/data`, {
    params: params ?? undefined,
  })
  return data
}

export async function saveDashboardLayout(
  dashboardId: string,
  layouts: Record<string, GridItem[]>,
): Promise<void> {
  await api.patch(`/dashboards/${dashboardId}/layout`, { layouts })
}
