import { BarChart2 } from 'lucide-react'

export function WidgetEmpty({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
      <BarChart2 className="w-7 h-7 text-muted-foreground/40" />
      <p className="text-[12px] text-muted-foreground">{label ?? 'Sin datos disponibles'}</p>
    </div>
  )
}
