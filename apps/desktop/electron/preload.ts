import { contextBridge, ipcRenderer } from 'electron'

// Tipos compartidos entre main y renderer
export interface PendingSale {
  id: string
  tenantId: string
  branchId?: string | null
  userId: string
  clientId?: string | null
  items: unknown[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: string
  paymentAmount: number
  changeAmount: number
  notes?: string | null
}

export interface PendingCashMovement {
  id: string
  tenantId: string
  branchId: string
  sessionId: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
  concept: string
  notes?: string | null
  userId: string
}

export interface SyncResult {
  ok: boolean
  synced?: number
  errors?: number
  cashSynced?: number
  cashErrors?: number
  error?: string
}

export interface PrintTicketData {
  folio: string
  fecha: string
  cliente?: string
  items: Array<{ nombre: string; qty: number; precio: number; total: number }>
  subtotal: number
  descuento: number
  impuesto: number
  total: number
  metodoPago: string
  cambio: number
  cajero: string
  sucursal: string
}

// ── API expuesta al renderer ──────────────────────────────────────────────────

const electronAPI = {
  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    platform: (): Promise<string> => ipcRenderer.invoke('app:platform'),
  },

  storage: {
    set: (key: string, value: string): Promise<void> => ipcRenderer.invoke('storage:set', key, value),
    get: (key: string): Promise<string | null> => ipcRenderer.invoke('storage:get', key),
    delete: (key: string): Promise<void> => ipcRenderer.invoke('storage:delete', key),
  },

  db: {
    products: {
      get: (): Promise<unknown[]> => ipcRenderer.invoke('db:products:get'),
      cache: (products: unknown[]): Promise<{ ok: boolean }> => ipcRenderer.invoke('db:products:cache', products),
    },
    customers: {
      get: (): Promise<unknown[]> => ipcRenderer.invoke('db:customers:get'),
      cache: (customers: unknown[]): Promise<{ ok: boolean }> => ipcRenderer.invoke('db:customers:cache', customers),
    },
    sales: {
      savePending: (sale: PendingSale): Promise<{ ok: boolean }> => ipcRenderer.invoke('db:sales:save-pending', sale),
      getPending: (): Promise<PendingSale[]> => ipcRenderer.invoke('db:sales:get-pending'),
      countPending: (): Promise<number> => ipcRenderer.invoke('db:sales:count-pending'),
    },
    cash: {
      savePending: (movement: PendingCashMovement): Promise<{ ok: boolean }> =>
        ipcRenderer.invoke('db:cash:save-pending', movement),
    },
  },

  sync: {
    run: (opts: { apiBase: string; token: string }): Promise<SyncResult> =>
      ipcRenderer.invoke('sync:run', opts),
    lastTime: (): Promise<number | null> => ipcRenderer.invoke('sync:last-time'),
  },

  print: {
    ticket: (data: PrintTicketData): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('print:ticket', data),
    pdf: (opts: { title: string; html: string }): Promise<{ ok: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('print:pdf', opts),
    printers: (): Promise<Electron.PrinterInfo[]> => ipcRenderer.invoke('print:printers'),
  },

  dialog: {
    save: (opts: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> =>
      ipcRenderer.invoke('dialog:save', opts),
  },

  updater: {
    check: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('updater:check'),
    download: (): Promise<void> => ipcRenderer.invoke('updater:download'),
    install: (): Promise<void> => ipcRenderer.invoke('updater:install'),
    onAvailable: (cb: (info: unknown) => void) => ipcRenderer.on('updater:available', (_e, info) => cb(info)),
    onProgress: (cb: (p: unknown) => void) => ipcRenderer.on('updater:progress', (_e, p) => cb(p)),
    onReady: (cb: () => void) => ipcRenderer.on('updater:ready', () => cb()),
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Permite detectar si estamos en Electron desde el renderer
contextBridge.exposeInMainWorld('__ELECTRON__', true)

export type ElectronAPI = typeof electronAPI
