import { AlertCircle } from 'lucide-react'

export function WidgetError({ message }: { message?: string }) {
  return (
    <div className="bg-card border border-red-200 dark:border-red-900 rounded-xl p-4 h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-center">
        <AlertCircle className="w-5 h-5 text-red-400" />
        <p className="text-[12px] text-muted-foreground max-w-[180px] leading-snug">
          {message ?? 'Error al cargar el widget'}
        </p>
      </div>
    </div>
  )
}
