import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WidgetDisplayConfig, WidgetMeta } from '@/services/core/dashboards-service'

interface BarDataset {
  id: string
  label: string
  values: number[]
  color?: string
  dashed?: boolean
}

interface BarData {
  labels: string[]
  datasets: BarDataset[]
}

interface Props {
  data: BarData
  meta: WidgetMeta
  config: WidgetDisplayConfig
}

const PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']

function fmt(v: number, config: WidgetDisplayConfig): string {
  if (config.valueFormat === 'currency') {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
    return `$${v.toLocaleString('es-MX')}`
  }
  if (config.valueFormat === 'percent') return `${v}%`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return v.toLocaleString('es-MX')
}

export function BarChartWidget({ data, meta: _meta, config }: Props) {
  const colors = config.colors ?? PALETTE

  const chartData = data.labels.map((label, i) => {
    const entry: Record<string, string | number> = { label }
    for (const ds of data.datasets) {
      entry[ds.id] = ds.values[i] ?? 0
    }
    return entry
  })

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} barCategoryGap="30%" barGap={2}>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => fmt(v, config)}
          width={52}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            config.valueFormat === 'currency'
              ? `$${(value as number).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
              : (value as number).toLocaleString('es-MX'),
            name,
          ] as [string, string]}
        />
        {config.showLegend !== false && data.datasets.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11 }} />
        )}
        {data.datasets.map((ds, i) => (
          <Bar
            key={ds.id}
            dataKey={ds.id}
            name={ds.label}
            fill={ds.color ?? colors[i % colors.length]}
            radius={[3, 3, 0, 0]}
            maxBarSize={48}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
