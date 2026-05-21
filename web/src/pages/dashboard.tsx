import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LayoutDashboard, Loader2 } from 'lucide-react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import { KPICard } from '@/components/shared/kpi-card'
import { useDashboard } from '@/hooks/core/use-dashboard'
import { WidgetRenderer } from '@/components/dashboard/widget-renderer'
import type { WidgetConfig, WidgetType, GridItem } from '@/services/core/dashboards-service'
import { saveDashboardLayout } from '@/services/core/dashboards-service'
import { useERPStore } from '@/store/erp-store'
import { useAuthStore } from '@/store/auth-store'

const ResponsiveGridLayout = WidthProvider(Responsive)

const CHART_H = 5

const WIDGET_DIMS: Partial<Record<WidgetType, { w: number; h: number }>> = {
  COUNTER:    { w: 3,  h: 2       },
  BAR_CHART:  { w: 6,  h: CHART_H },
  LINE_CHART: { w: 6,  h: CHART_H },
  AREA_CHART: { w: 6,  h: CHART_H },
  PIE_CHART:  { w: 4,  h: CHART_H },
  DONUT_CHART:{ w: 4,  h: CHART_H },
  TABLE:      { w: 12, h: CHART_H },
  RANKING:    { w: 4,  h: CHART_H },
  TIMELINE:   { w: 12, h: CHART_H },
  HEATMAP:    { w: 12, h: CHART_H },
  FUNNEL:     { w: 6,  h: CHART_H },
  GAUGE:      { w: 3,  h: CHART_H },
  TEXT_CARD:  { w: 4,  h: CHART_H },
}

function buildDefaultLayouts(widgets: WidgetConfig[]): Record<string, GridItem[]> {
  const items: GridItem[] = []
  let curX = 0, curY = 0, rowMaxH = 0

  for (const widget of widgets) {
    const { h } = WIDGET_DIMS[widget.widgetType] ?? { w: 6, h: 4 }
    const w = widget.colSpan ?? (WIDGET_DIMS[widget.widgetType]?.w ?? 6)
    if (curX + w > 12) {
      curY += rowMaxH
      curX = 0
      rowMaxH = 0
    }
    items.push({ i: widget.id, x: curX, y: curY, w, h, minW: 2, minH: 2 })
    curX += w
    if (h > rowMaxH) rowMaxH = h
  }

  return { lg: items }
}

function toGridItems(layout: Layout): GridItem[] {
  return layout.map(item => ({ ...item }))
}

function DynamicDashboard({
  name,
  widgets,
  dashboardId,
  layouts: savedLayouts,
}: {
  name: string
  widgets: WidgetConfig[]
  dashboardId: string
  layouts: Record<string, GridItem[]>
}) {
  const permissions = useAuthStore(s => s.permissions)
  const canEdit = permissions.includes('dashboard:edit') || permissions.includes('dashboard:manage')

  const [layouts, setLayouts] = useState<Record<string, GridItem[]>>(
    () => (Object.keys(savedLayouts).length > 0 ? savedLayouts : buildDefaultLayouts(widgets)),
  )
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLayoutChange = useCallback(
    (_currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      if (!canEdit) return
      const normalized: Record<string, GridItem[]> = {}
      for (const [bp, items] of Object.entries(allLayouts)) {
        if (items != null) normalized[bp] = toGridItems(items)
      }
      setLayouts(normalized)

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true)
        try {
          await saveDashboardLayout(dashboardId, normalized)
        } finally {
          setSaving(false)
        }
      }, 1500)
    },
    [canEdit, dashboardId],
  )

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    },
    [],
  )

  return (
    <div className="px-7 pt-7 pb-4 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground font-medium">{name}</span>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Arrastra para reorganizar</span>
            {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </div>
        )}
      </div>
      <ResponsiveGridLayout
        layouts={layouts as ResponsiveLayouts}
        breakpoints={{ lg: 1200, md: 768, sm: 480, xs: 0 }}
        cols={{ lg: 12, md: 6, sm: 2, xs: 2 }}
        rowHeight={60}
        margin={[16, 16]}
        isDraggable={canEdit}
        isResizable={canEdit}
        draggableHandle=".drag-handle"
        onLayoutChange={handleLayoutChange}
      >
        {widgets.map(widget => (
          <div key={widget.id} className="h-full">
            <WidgetRenderer widget={widget} canEdit={canEdit} />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  )
}

function StaticDashboard() {
  const { dashboard: d } = useERPStore()
  const activityIcon: Record<string, string> = {
    venta: '💰',
    compra: '🛒',
    stock: '📦',
    pago: '✅',
  }

  return (
    <div className="p-7 flex flex-col gap-6">
      <div className="flex gap-4">
        {d.kpis.map((k, i) => (
          <KPICard key={i} label={k.label} value={k.value} change={k.change} up={k.up} />
        ))}
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[13px] font-bold text-foreground">Ventas vs Compras 2026</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Comparativa mensual</div>
            </div>
            <select className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-card text-foreground cursor-pointer">
              <option>Anual 2026</option>
              <option>Trimestral</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={d.ventasMensuales}>
              <defs>
                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCompras" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v / 1000}K`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={value => [`$${Number(value).toLocaleString()}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="ventas"
                name="Ventas"
                stroke="#6366f1"
                fill="url(#colorVentas)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="compras"
                name="Compras"
                stroke="#f59e0b"
                fill="url(#colorCompras)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
          <div className="text-[13px] font-bold text-foreground mb-4">Actividad Reciente</div>
          <div className="flex flex-col gap-3.5 flex-1">
            {d.actividadReciente.map((a, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm shrink-0">
                  {activityIcon[a.tipo] ?? '•'}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-foreground leading-snug">{a.desc}</div>
                  <div className="flex justify-between mt-0.5">
                    {a.monto && (
                      <span className="text-[11px] font-bold text-primary">{a.monto}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{a.tiempo}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="text-[13px] font-bold text-foreground mb-4">Productos Más Vendidos</div>
        <div className="flex flex-col">
          {d.topProductos.map((p, i) => {
            const maxV = d.topProductos[0].vendidos
            const pct = (p.vendidos / maxV) * 100
            return (
              <div
                key={i}
                className={`flex items-center gap-3.5 py-2.5 ${i < d.topProductos.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="w-[22px] h-[22px] rounded-md bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-foreground mb-1.5">{p.nombre}</div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-foreground">{p.ingreso}</div>
                  <div className="text-[10px] text-muted-foreground">{p.vendidos} uds.</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { dashboard, loading } = useDashboard()

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando dashboard…</span>
        </div>
      </div>
    )
  }

  if (dashboard && dashboard.widgets.length > 0) {
    return (
      <DynamicDashboard
        name={dashboard.name}
        widgets={dashboard.widgets}
        dashboardId={dashboard.id}
        layouts={dashboard.layouts}
      />
    )
  }

  return <StaticDashboard />
}
