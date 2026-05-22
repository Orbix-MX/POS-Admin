import { useElectron } from '~/context/electron-context'
import { WifiOff, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export function OfflineBanner() {
  const { isOnline, syncStatus, pendingCount, triggerSync } = useElectron()

  if (isOnline && syncStatus === 'idle' && pendingCount === 0) return null

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-700 dark:text-amber-400 text-[11px] font-medium">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>Sin conexión — modo offline</span>
        {pendingCount > 0 && (
          <span className="ml-auto bg-amber-500/20 rounded px-1.5 py-0.5">
            {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    )
  }

  if (syncStatus === 'syncing') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border-b border-blue-500/20 text-blue-700 dark:text-blue-400 text-[11px] font-medium">
        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
        <span>Sincronizando {pendingCount} registro{pendingCount !== 1 ? 's' : ''}...</span>
      </div>
    )
  }

  if (syncStatus === 'success') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border-b border-green-500/20 text-green-700 dark:text-green-400 text-[11px] font-medium">
        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Datos sincronizados</span>
      </div>
    )
  }

  if (syncStatus === 'error') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-700 dark:text-red-400 text-[11px] font-medium">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Error al sincronizar</span>
        <button
          onClick={triggerSync}
          className="ml-auto flex items-center gap-1 underline underline-offset-2"
        >
          <RefreshCw className="w-3 h-3" />
          Reintentar
        </button>
      </div>
    )
  }

  // Online con pendientes sin sincronizar
  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border-b border-orange-500/20 text-orange-700 dark:text-orange-400 text-[11px] font-medium">
        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
        <span>{pendingCount} venta{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de sincronizar</span>
        <button
          onClick={triggerSync}
          className="ml-auto underline underline-offset-2"
        >
          Sincronizar ahora
        </button>
      </div>
    )
  }

  return null
}
