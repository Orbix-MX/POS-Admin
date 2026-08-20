import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Estado de conexión.
 *
 * El backend actual no soporta operación offline, así que esto **no** es una
 * cola de sincronización: solo informa al cajero de que el equipo perdió la red
 * para que sepa por qué falla un cobro. El tipo `SyncStatus` deja el hueco
 * modelado para cuando exista soporte real en el servidor; hoy nunca sale de
 * `'synced'`.
 */

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed'

interface NetworkStatus {
  online: boolean
  sync: SyncStatus
}

const NetworkStatusContext = createContext<NetworkStatus>({ online: true, sync: 'synced' })

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const value = useMemo<NetworkStatus>(() => ({ online, sync: 'synced' }), [online])

  return <NetworkStatusContext.Provider value={value}>{children}</NetworkStatusContext.Provider>
}

export const useNetworkStatus = (): NetworkStatus => useContext(NetworkStatusContext)
