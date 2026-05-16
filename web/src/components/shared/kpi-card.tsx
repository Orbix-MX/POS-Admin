import { TrendingUp, TrendingDown } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string
  change: string
  up: boolean
}

export function KPICard({ label, value, change, up }: KPICardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex-1">
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
        {label}
      </div>
      <div className="text-[26px] font-bold text-foreground mb-2 tracking-tight">
        {value}
      </div>
      <div className="flex items-center gap-1 text-xs">
        <span className={`flex items-center gap-1 font-semibold ${up ? 'text-green-600' : 'text-red-600'}`}>
          {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change}
        </span>
        <span className="text-muted-foreground">vs. mes anterior</span>
      </div>
    </div>
  )
}
