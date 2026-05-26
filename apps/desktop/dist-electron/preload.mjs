"use strict";
const electron = require("electron");
const electronAPI = {
  app: {
    version: () => electron.ipcRenderer.invoke("app:version"),
    platform: () => electron.ipcRenderer.invoke("app:platform")
  },
  storage: {
    set: (key, value) => electron.ipcRenderer.invoke("storage:set", key, value),
    get: (key) => electron.ipcRenderer.invoke("storage:get", key),
    delete: (key) => electron.ipcRenderer.invoke("storage:delete", key)
  },
  db: {
    products: {
      get: () => electron.ipcRenderer.invoke("db:products:get"),
      cache: (products) => electron.ipcRenderer.invoke("db:products:cache", products)
    },
    customers: {
      get: () => electron.ipcRenderer.invoke("db:customers:get"),
      cache: (customers) => electron.ipcRenderer.invoke("db:customers:cache", customers)
    },
    sales: {
      savePending: (sale) => electron.ipcRenderer.invoke("db:sales:save-pending", sale),
      getPending: () => electron.ipcRenderer.invoke("db:sales:get-pending"),
      countPending: () => electron.ipcRenderer.invoke("db:sales:count-pending")
    },
    cash: {
      savePending: (movement) => electron.ipcRenderer.invoke("db:cash:save-pending", movement)
    }
  },
  sync: {
    run: (opts) => electron.ipcRenderer.invoke("sync:run", opts),
    lastTime: () => electron.ipcRenderer.invoke("sync:last-time")
  },
  print: {
    ticket: (data) => electron.ipcRenderer.invoke("print:ticket", data),
    pdf: (opts) => electron.ipcRenderer.invoke("print:pdf", opts),
    printers: () => electron.ipcRenderer.invoke("print:printers")
  },
  dialog: {
    save: (opts) => electron.ipcRenderer.invoke("dialog:save", opts)
  },
  updater: {
    check: () => electron.ipcRenderer.invoke("updater:check"),
    download: () => electron.ipcRenderer.invoke("updater:download"),
    install: () => electron.ipcRenderer.invoke("updater:install"),
    onAvailable: (cb) => electron.ipcRenderer.on("updater:available", (_e, info) => cb(info)),
    onProgress: (cb) => electron.ipcRenderer.on("updater:progress", (_e, p) => cb(p)),
    onReady: (cb) => electron.ipcRenderer.on("updater:ready", () => cb())
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
electron.contextBridge.exposeInMainWorld("__ELECTRON__", true);
//# sourceMappingURL=preload.mjs.map
