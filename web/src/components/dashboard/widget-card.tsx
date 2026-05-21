import { GripVertical, RefreshCw } from 'lucide-react'

interface WidgetCardProps {
  title: string
  subtitle?: string | null
  lastUpdate?: string
  children: React.ReactNode
  onRefresh?: () => void
  canEdit?: boolean
}

export function WidgetCard({ title, subtitle, lastUpdate, children, onRefresh, canEdit }: WidgetCardProps) {
  const updatedAt = lastUpdate
    ? new Date(lastUpdate).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="bg-card border border-border rounded-xl flex flex-col h-full overflow-hidden">
      <div
        className={`flex items-start justify-between px-4 pt-4 pb-3 shrink-0 select-none${canEdit ? ' drag-handle cursor-grab active:cursor-grabbing' : ''}`}
      >
        {canEdit && (
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5 mr-1" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-foreground leading-tight truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {updatedAt && <span className="text-[10px] text-muted-foreground">{updatedAt}</span>}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer border-none bg-transparent"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 px-4 pb-4 min-h-0">{children}</div>
    </div>
  )
}
