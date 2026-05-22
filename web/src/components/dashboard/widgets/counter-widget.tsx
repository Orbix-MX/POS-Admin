import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { WidgetDisplayConfig, WidgetMeta } from '@/services/core/dashboards-service'

interface CounterData {
  value: number
  formatted?: string
  icon?: string
  color?: string
  sparkline?: number[]
}

interface Props {
  data: CounterData
  meta: WidgetMeta
  config: WidgetDisplayConfig
}

function formatValue(value: number, config: WidgetDisplayConfig): string {
  if (config.valueFormat === 'currency')
    return `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
  if (config.valueFormat === 'percent') return `${value}%`
  if (config.valueFormat === 'compact') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  }
  return value.toLocaleString('es-MX')
}

function SparkLine({ values, trend }: { values: number[]; trend?: string }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const W = 72
  const H = 24
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W
      const y = H - ((v - min) / range) * H
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const stroke = trend === 'up' ? '#16a34a' : trend === 'down' ? '#dc2626' : '#6366f1'
  return (
    <svg width={W} height={H} className="opacity-70">
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CounterWidget({ data, meta, config }: Props) {
  const trend = meta.comparison?.trend
  const change = meta.comparison?.changePercent
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendCls =
    trend === 'up'
      ? 'text-green-600'
      : trend === 'down'
        ? 'text-red-500'
        : 'text-muted-foreground'

  const display = data.formatted ?? formatValue(data.value, config)

  return (
    <div className="flex flex-col gap-2 h-full justify-center">
      <div
        className="text-[28px] font-extrabold tracking-tight leading-none"
        style={{ color: data.color ?? 'var(--foreground)' }}
      >
        {display}
      </div>

      {meta.comparison && (
        <div className={`flex items-center gap-1.5 ${trendCls}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          <span className="text-[12px] font-semibold">
            {change !== undefined
              ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
              : ''}
            {meta.comparison.label && (
              <span className="font-normal text-muted-foreground ml-1">
                {meta.comparison.label}
              </span>
            )}
          </span>
        </div>
      )}

      {data.sparkline && data.sparkline.length > 1 && (
        <SparkLine values={data.sparkline} trend={trend} />
      )}

      {meta.unit && !meta.comparison && (
        <div className="text-[11px] text-muted-foreground">{meta.unit}</div>
      )}
    </div>
  )
}
