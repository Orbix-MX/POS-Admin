import { contextBridge, ipcRenderer } from 'electron';
// ── API expuesta al renderer ──────────────────────────────────────────────────
const electronAPI = {
    app: {
        version: () => ipcRenderer.invoke('app:version'),
        platform: () => ipcRenderer.invoke('app:platform'),
    },
    storage: {
        set: (key, value) => ipcRenderer.invoke('storage:set', key, value),
        get: (key) => ipcRenderer.invoke('storage:get', key),
        delete: (key) => ipcRenderer.invoke('storage:delete', key),
    },
    db: {
        products: {
            get: () => ipcRenderer.invoke('db:products:get'),
            cache: (products) => ipcRenderer.invoke('db:products:cache', products),
        },
        customers: {
            get: () => ipcRenderer.invoke('db:customers:get'),
            cache: (customers) => ipcRenderer.invoke('db:customers:cache', customers),
        },
        sales: {
            savePending: (sale) => ipcRenderer.invoke('db:sales:save-pending', sale),
            getPending: () => ipcRenderer.invoke('db:sales:get-pending'),
            countPending: () => ipcRenderer.invoke('db:sales:count-pending'),
        },
        cash: {
            savePending: (movement) => ipcRenderer.invoke('db:cash:save-pending', movement),
        },
    },
    sync: {
        run: (opts) => ipcRenderer.invoke('sync:run', opts),
        lastTime: () => ipcRenderer.invoke('sync:last-time'),
    },
    print: {
        ticket: (data) => ipcRenderer.invoke('print:ticket', data),
        pdf: (opts) => ipcRenderer.invoke('print:pdf', opts),
        printers: () => ipcRenderer.invoke('print:printers'),
    },
    dialog: {
        save: (opts) => ipcRenderer.invoke('dialog:save', opts),
    },
    updater: {
        check: () => ipcRenderer.invoke('updater:check'),
        download: () => ipcRenderer.invoke('updater:download'),
        install: () => ipcRenderer.invoke('updater:install'),
        onAvailable: (cb) => ipcRenderer.on('updater:available', (_e, info) => cb(info)),
        onProgress: (cb) => ipcRenderer.on('updater:progress', (_e, p) => cb(p)),
        onReady: (cb) => ipcRenderer.on('updater:ready', () => cb()),
    },
};
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
// Permite detectar si estamos en Electron desde el renderer
contextBridge.exposeInMainWorld('__ELECTRON__', true);
