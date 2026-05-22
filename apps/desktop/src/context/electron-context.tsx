import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'

// Tipos del preload (sin importar el módulo de electron directamente)
declare global {
  interface Window {
    __ELECTRON__?: boolean
    electronAPI?: {
      app: { version(): Promise<string>; platform(): Promise<string> }
      storage: {
        set(key: string, value: string): Promise<void>
        get(key: string): Promise<string | null>
        delete(key: string): Promise<void>
      }
      db: {
        products: {
          get(): Promise<unknown[]>
          cache(products: unknown[]): Promise<{ ok: boolean }>
        }
        customers: {
          get(): Promise<unknown[]>
          cache(customers: unknown[]): Promise<{ ok: boolean }>
        }
        sales: {
          savePending(sale: unknown): Promise<{ ok: boolean }>
          getPending(): Promise<unknown[]>
          countPending(): Promise<number>
        }
        cash: {
          savePending(movement: unknown): Promise<{ ok: boolean }>
        }
      }
      sync: {
        run(opts: { apiBase: string; token: string }): Promise<{
          ok: boolean; synced?: number; errors?: number; cashSynced?: number; cashErrors?: number; error?: string
        }>
        lastTime(): Promise<number | null>
      }
      print: {
        ticket(data: unknown): Promise<{ ok: boolean; error?: string }>
        pdf(opts: { title: string; html: string }): Promise<{ ok: boolean; path?: string; error?: string }>
        printers(): Promise<unknown[]>
      }
      dialog: {
        save(opts: unknown): Promise<unknown>
      }
      updater: {
        check(): Promise<{ ok: boolean; error?: string }>
        download(): Promise<void>
        install(): Promise<void>
        onAvailable(cb: (info: unknown) => void): void
        onReady(cb: () => void): void
      }
    }
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'

interface ElectronContextValue {
  isElectron: boolean
  isOnline: boolean
  syncStatus: SyncStatus
  pendingCount: number
  appVersion: string
  triggerSync: () => Promise<void>
  printTicket: (data: unknown) => Promise<{ ok: boolean; error?: string }>
  saveOfflineSale: (sale: unknown) => Promise<{ ok: boolean }>
  saveOfflineCashMovement: (m: unknown) => Promise<{ ok: boolean }>
  getOfflineProducts: () => Promise<unknown[]>
  getOfflineCustomers: () => Promise<unknown[]>
  cacheProducts: (products: unknown[]) => Promise<void>
  cacheCustomers: (customers: unknown[]) => Promise<void>
}

const ElectronContext = createContext<ElectronContextValue>({
  isElectron: false,
  isOnline: true,
  syncStatus: 'idle',
  pendingCount: 0,
  appVersion: '',
  triggerSync: async () => {},
  printTicket: async () => ({ ok: false }),
  saveOfflineSale: async () => ({ ok: false }),
  saveOfflineCashMovement: async () => ({ ok: false }),
  getOfflineProducts: async () => [],
  getOfflineCustomers: async () => [],
  cacheProducts: async () => {},
  cacheCustomers: async () => {},
})

export function ElectronProvider({ children, apiBase, getToken }: {
  children: ReactNode
  apiBase: string
  getToken: () => string | null
}) {
  const isElectron = Boolean(window.__ELECTRON__)
  const api = window.electronAPI

  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [pendingCount, setPendingCount] = useState(0)
  const [appVersion, setAppVersion] = useState('')
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detectar online/offline
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // App version
  useEffect(() => {
    if (!isElectron || !api) return
    api.app.version().then(setAppVersion).catch(() => {})
  }, [isElectron, api])

  // Refrescar contador de pendientes
  const refreshPendingCount = useCallback(async () => {
    if (!isElectron || !api) return
    const n = await api.db.sales.countPending().catch(() => 0)
    setPendingCount(n)
  }, [isElectron, api])

  useEffect(() => {
    refreshPendingCount()
    const interval = setInterval(refreshPendingCount, 30_000)
    return () => clearInterval(interval)
  }, [refreshPendingCount])

  // Sincronización automática al volver online
  useEffect(() => {
    if (!isOnline || !isElectron || !api) return
    const timer = setTimeout(() => {
      triggerSync()
    }, 2000) // espera 2s para que la conexión estabilice
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  const triggerSync = useCallback(async () => {
    if (!isElectron || !api) return
    const token = getToken()
    if (!token || !isOnline) return

    setSyncStatus('syncing')
    try {
      const result = await api.sync.run({ apiBase, token })
      setSyncStatus(result.ok ? 'success' : 'error')
      await refreshPendingCount()
      // Vuelve a idle después de mostrar éxito/error
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      syncTimerRef.current = setTimeout(() => setSyncStatus('idle'), 4000)
    } catch {
      setSyncStatus('error')
    }
  }, [isElectron, api, apiBase, getToken, isOnline, refreshPendingCount])

  const printTicket = useCallback(async (data: unknown) => {
    if (!isElectron || !api) return { ok: false, error: 'Not in Electron' }
    return api.print.ticket(data)
  }, [isElectron, api])

  const saveOfflineSale = useCallback(async (sale: unknown) => {
    if (!isElectron || !api) return { ok: false }
    const result = await api.db.sales.savePending(sale)
    await refreshPendingCount()
    return result
  }, [isElectron, api, refreshPendingCount])

  const saveOfflineCashMovement = useCallback(async (m: unknown) => {
    if (!isElectron || !api) return { ok: false }
    return api.db.cash.savePending(m)
  }, [isElectron, api])

  const getOfflineProducts = useCallback(async () => {
    if (!isElectron || !api) return []
    return api.db.products.get()
  }, [isElectron, api])

  const getOfflineCustomers = useCallback(async () => {
    if (!isElectron || !api) return []
    return api.db.customers.get()
  }, [isElectron, api])

  const cacheProducts = useCallback(async (products: unknown[]) => {
    if (!isElectron || !api) return
    await api.db.products.cache(products)
  }, [isElectron, api])

  const cacheCustomers = useCallback(async (customers: unknown[]) => {
    if (!isElectron || !api) return
    await api.db.customers.cache(customers)
  }, [isElectron, api])

  return (
    <ElectronContext.Provider value={{
      isElectron,
      isOnline,
      syncStatus,
      pendingCount,
      appVersion,
      triggerSync,
      printTicket,
      saveOfflineSale,
      saveOfflineCashMovement,
      getOfflineProducts,
      getOfflineCustomers,
      cacheProducts,
      cacheCustomers,
    }}>
      {children}
    </ElectronContext.Provider>
  )
}

export function useElectron() {
  return useContext(ElectronContext)
}
