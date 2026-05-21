import type { WidgetDisplayConfig, WidgetMeta } from '@/services/core/dashboards-service'

interface RankingItem {
  rank:     number
  name:     string
  sku:      string | null
  quantity: number
  revenue:  number
}

interface Props {
  data:   RankingItem[]
  meta:   WidgetMeta
  config: WidgetDisplayConfig
}

const MEDAL: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: '#fef9c3', text: '#854d0e', label: '1' },
  2: { bg: '#f1f5f9', text: '#475569', label: '2' },
  3: { bg: '#fff7ed', text: '#9a3412', label: '3' },
}

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`
}

export function RankingWidget({ data, meta, config }: Props) {
  const sortBy = (config as { sortBy?: string }).sortBy ?? 'quantity'
  const maxVal  = data.length > 0
    ? Math.max(...data.map(d => sortBy === 'revenue' ? d.revenue : d.quantity))
    : 1

  const currency = meta.currency ?? 'MXN'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* header */}
      <div className="grid grid-cols-[28px_1fr_80px_72px] gap-x-3 px-3 pb-1.5 border-b border-border shrink-0">
        <span />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Producto</span>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Unidades</span>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">
          {currency}
        </span>
      </div>

      {/* rows */}
      <div className="flex-1 overflow-y-auto">
        {data.map(item => {
          const pct     = maxVal > 0 ? (sortBy === 'revenue' ? item.revenue : item.quantity) / maxVal : 0
          const medal   = MEDAL[item.rank]
          const barColor = item.rank === 1 ? '#6366f1' : item.rank === 2 ? '#8b5cf6' : '#a78bfa'

          return (
            <div
              key={item.rank}
              className="grid grid-cols-[28px_1fr_80px_72px] gap-x-3 px-3 py-2.5 items-center border-b border-border/50 hover:bg-muted/30 transition-colors"
            >
              {/* rank badge */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0"
                style={
                  medal
                    ? { background: medal.bg, color: medal.text }
                    : { background: 'var(--muted)', color: 'var(--muted-foreground)' }
                }
              >
                {item.rank}
              </div>

              {/* name + sku + bar */}
              <div className="min-w-0 flex flex-col gap-1">
                <span className="text-[12px] font-semibold text-foreground truncate leading-tight">
                  {item.name}
                </span>
                {item.sku && (
                  <span className="text-[10px] text-muted-foreground leading-none">{item.sku}</span>
                )}
                <div className="h-1 rounded-full bg-muted overflow-hidden mt-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(pct * 100).toFixed(1)}%`, background: barColor }}
                  />
                </div>
              </div>

              {/* quantity */}
              <div className="text-[12px] font-semibold text-foreground text-right tabular-nums">
                {item.quantity.toLocaleString('es-MX')}
              </div>

              {/* revenue */}
              <div className="text-[11px] text-muted-foreground text-right tabular-nums">
                {fmtCurrency(item.revenue)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
