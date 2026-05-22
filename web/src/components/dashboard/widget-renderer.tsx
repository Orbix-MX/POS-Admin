import type { WidgetConfig, WidgetType } from '@/services/core/dashboards-service'
import { useWidgetData } from '@/hooks/core/use-dashboard'
import { WidgetCard } from './widget-card'
import { WidgetEmpty } from './widget-empty'
import { WidgetError } from './widget-error'
import { WidgetSkeleton } from './widget-skeleton'
import { BarChartWidget } from './widgets/bar-chart-widget'
import { CounterWidget } from './widgets/counter-widget'
import { LineChartWidget } from './widgets/line-chart-widget'
import { RankingWidget } from './widgets/ranking-widget'
import { TableWidget } from './widgets/table-widget'

type AnyWidgetProps = { data: unknown; meta: unknown; config: unknown }
type WidgetComponent = React.ComponentType<AnyWidgetProps>

const WIDGET_MAP: Partial<Record<WidgetType, WidgetComponent>> = {
  COUNTER:    CounterWidget as WidgetComponent,
  BAR_CHART:  BarChartWidget as WidgetComponent,
  LINE_CHART: LineChartWidget as WidgetComponent,
  RANKING:    RankingWidget as WidgetComponent,
  TABLE:      TableWidget as WidgetComponent,
}

export function WidgetRenderer({ widget, canEdit }: { widget: WidgetConfig; canEdit?: boolean }) {
  const { data, loading } = useWidgetData(widget)
  const Component = WIDGET_MAP[widget.widgetType]

  if (loading) return <WidgetSkeleton />

  if (!data?.success) {
    return <WidgetError message={data?.error} />
  }

  if (data.meta?.empty) {
    return (
      <WidgetCard title={data.title} subtitle={data.subtitle} lastUpdate={data.lastUpdate} canEdit={canEdit}>
        <WidgetEmpty label={data.meta.emptyLabel} />
      </WidgetCard>
    )
  }

  if (!Component) {
    return (
      <WidgetCard title={data.title} subtitle={data.subtitle} lastUpdate={data.lastUpdate} canEdit={canEdit}>
        <div className="flex items-center justify-center h-full">
          <p className="text-[12px] text-muted-foreground">
            Tipo{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">
              {widget.widgetType}
            </code>{' '}
            — próximamente
          </p>
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title={data.title} subtitle={data.subtitle} lastUpdate={data.lastUpdate} canEdit={canEdit}>
      <Component
        data={data.data as unknown}
        meta={data.meta as unknown}
        config={data.config as unknown}
      />
    </WidgetCard>
  )
}
