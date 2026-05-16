import { RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RefreshButtonProps {
  loading: boolean
  onClick: () => void
  className?: string
  'aria-label'?: string
}

export function RefreshButton({
  loading,
  onClick,
  className,
  'aria-label': ariaLabel = 'Actualizar',
}: RefreshButtonProps) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 bg-muted rounded-lg text-xs font-medium hover:bg-muted/50',
        'disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer',
        className
      )}
      aria-busy={loading}
      aria-label={ariaLabel}
    >
      <RefreshCcw
        className={cn('w-3.5 h-3.5 text-muted-foreground', loading && 'animate-spin')}
        aria-hidden
      />
    </button>
  )
}
