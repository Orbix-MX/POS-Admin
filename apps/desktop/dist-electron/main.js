import { app, dialog, BrowserWindow, ipcMain, safeStorage, nativeTheme, shell } from "electron";
import pkg from "electron-updater";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "fs";
let db;
function getDb() {
  if (!db)
    throw new Error("DB not initialized — call initDb() first");
  return db;
}
function initDb() {
  const dbPath = path.join(app.getPath("userData"), "orbix-pos.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySchema(db);
}
function applySchema(db2) {
  db2.exec(`
    -- KV store para tokens seguros y configuración local
    CREATE TABLE IF NOT EXISTS kv_store (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Cache de productos (refresco desde API)
    CREATE TABLE IF NOT EXISTS products_cache (
      id              TEXT PRIMARY KEY,
      sku             TEXT NOT NULL,
      name            TEXT NOT NULL,
      price           REAL NOT NULL,
      cost_price      REAL NOT NULL DEFAULT 0,
      stock           INTEGER NOT NULL DEFAULT 0,
      category_id     TEXT,
      category_name   TEXT,
      status          TEXT NOT NULL DEFAULT 'ACTIVE',
      track_inventory INTEGER NOT NULL DEFAULT 1,
      low_stock_alert INTEGER NOT NULL DEFAULT 10,
      tax_rate        REAL NOT NULL DEFAULT 0,
      tax_code        TEXT NOT NULL DEFAULT '',
      image_url       TEXT,
      synced_at       INTEGER NOT NULL DEFAULT 0
    );

    -- Cache de clientes
    CREATE TABLE IF NOT EXISTS customers_cache (
      id         TEXT PRIMARY KEY,
      email      TEXT,
      first_name TEXT NOT NULL,
      last_name  TEXT NOT NULL,
      phone      TEXT,
      status     TEXT NOT NULL DEFAULT 'ACTIVE',
      type       TEXT NOT NULL DEFAULT 'NEW',
      synced_at  INTEGER NOT NULL DEFAULT 0
    );

    -- Cola de ventas pendientes de sincronizar
    CREATE TABLE IF NOT EXISTS pending_sales (
      id             TEXT PRIMARY KEY,
      tenant_id      TEXT NOT NULL,
      branch_id      TEXT,
      user_id        TEXT NOT NULL,
      client_id      TEXT,
      items          TEXT NOT NULL,
      subtotal       REAL NOT NULL,
      discount       REAL NOT NULL DEFAULT 0,
      tax            REAL NOT NULL DEFAULT 0,
      total          REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_amount REAL NOT NULL,
      change_amount  REAL NOT NULL DEFAULT 0,
      notes          TEXT,
      created_at     INTEGER NOT NULL,
      synced_at      INTEGER,
      sync_error     TEXT,
      status         TEXT NOT NULL DEFAULT 'pending'
    );

    -- Cola de movimientos de caja pendientes
    CREATE TABLE IF NOT EXISTS pending_cash_movements (
      id         TEXT PRIMARY KEY,
      tenant_id  TEXT NOT NULL,
      branch_id  TEXT NOT NULL,
      session_id TEXT NOT NULL,
      type       TEXT NOT NULL,
      amount     REAL NOT NULL,
      concept    TEXT NOT NULL,
      notes      TEXT,
      user_id    TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      synced_at  INTEGER,
      sync_error TEXT,
      status     TEXT NOT NULL DEFAULT 'pending'
    );

    -- Metadatos de sincronización
    CREATE TABLE IF NOT EXISTS sync_meta (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}
function markSaleSynced(db2, id) {
  db2.prepare("UPDATE pending_sales SET status = 'synced', synced_at = ? WHERE id = ?").run(Date.now(), id);
}
function markSaleError(db2, id, error) {
  db2.prepare("UPDATE pending_sales SET status = 'error', sync_error = ? WHERE id = ?").run(error, id);
}
function markCashMovementSynced(db2, id) {
  db2.prepare("UPDATE pending_cash_movements SET status = 'synced', synced_at = ? WHERE id = ?").run(Date.now(), id);
}
function markCashMovementError(db2, id, error) {
  db2.prepare("UPDATE pending_cash_movements SET status = 'error', sync_error = ? WHERE id = ?").run(error, id);
}
function cacheProducts(db2, products) {
  const upsert = db2.prepare(`
    INSERT OR REPLACE INTO products_cache
      (id, sku, name, price, cost_price, stock, category_id, category_name, status,
       track_inventory, low_stock_alert, tax_rate, tax_code, image_url, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  const insertMany = db2.transaction((rows) => {
    for (const p of rows) {
      const images = Array.isArray(p.images) ? p.images : [];
      const primaryImage = images.find((i) => i.isPrimary) ?? images[0];
      upsert.run(p.id, p.sku, p.name, p.price, p.costPrice ?? 0, p.stock ?? 0, p.categoryId ?? null, typeof p.category === "object" && p.category !== null ? p.category.name : null, p.status ?? "ACTIVE", p.trackInventory ? 1 : 0, p.lowStockAlert ?? 10, p.taxRate ?? 0, p.taxCode ?? "", (primaryImage == null ? void 0 : primaryImage.url) ?? null, now);
    }
  });
  insertMany(products);
}
function cacheCustomers(db2, customers) {
  const upsert = db2.prepare(`
    INSERT OR REPLACE INTO customers_cache
      (id, email, first_name, last_name, phone, status, type, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  const insertMany = db2.transaction((rows) => {
    for (const c of rows) {
      upsert.run(c.id, c.email ?? null, c.firstName, c.lastName, c.phone ?? null, c.status ?? "ACTIVE", c.type ?? "NEW", now);
    }
  });
  insertMany(customers);
}
async function syncPendingSales(db2, apiBase, token) {
  const pending = db2.prepare("SELECT * FROM pending_sales WHERE status = 'pending' ORDER BY created_at ASC").all();
  let synced = 0;
  let errors = 0;
  for (const sale of pending) {
    try {
      db2.prepare("UPDATE pending_sales SET status = 'syncing' WHERE id = ?").run(sale.id);
      const items = JSON.parse(sale.items);
      const body = {
        offlineId: sale.id,
        clienteId: sale.client_id ?? null,
        items,
        subtotal: sale.subtotal,
        descuentos: sale.discount,
        tax: sale.tax,
        total: sale.total,
        metodoPago: sale.payment_method,
        pagoCon: sale.payment_amount,
        cambio: sale.change_amount,
        notas: sale.notes ?? null
      };
      const res = await fetch(`${apiBase}/pos/ventas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15e3)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      markSaleSynced(db2, sale.id);
      synced++;
    } catch (err) {
      markSaleError(db2, sale.id, String(err));
      errors++;
    }
  }
  return { synced, errors };
}
async function syncPendingCashMovements(db2, apiBase, token) {
  const pending = db2.prepare("SELECT * FROM pending_cash_movements WHERE status = 'pending' ORDER BY created_at ASC").all();
  let synced = 0;
  let errors = 0;
  for (const m of pending) {
    try {
      db2.prepare("UPDATE pending_cash_movements SET status = 'syncing' WHERE id = ?").run(m.id);
      const res = await fetch(`${apiBase}/cash-sessions/${m.session_id}/movements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          offlineId: m.id,
          type: m.type,
          amount: m.amount,
          concept: m.concept,
          notes: m.notes ?? null
        }),
        signal: AbortSignal.timeout(1e4)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      markCashMovementSynced(db2, m.id);
      synced++;
    } catch (err) {
      markCashMovementError(db2, m.id, String(err));
      errors++;
    }
  }
  return { synced, errors };
}
async function printTicket(win, data) {
  const html = buildTicketHtml(data);
  return new Promise((resolve, reject) => {
    const { BrowserWindow: BW } = require("electron");
    const printWin = new BW({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    printWin.webContents.once("did-finish-load", () => {
      printWin.webContents.print({
        silent: true,
        printBackground: true,
        margins: { marginType: "none" }
      }, (success, errorType) => {
        printWin.close();
        if (success)
          resolve();
        else
          reject(new Error(errorType ?? "Print failed"));
      });
    });
  });
}
async function printPdf(win, opts) {
  const { filePath } = await dialog.showSaveDialog(win, {
    title: "Guardar PDF",
    defaultPath: path.join(app.getPath("documents"), `${opts.title}.pdf`),
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (!filePath)
    throw new Error("Cancelled");
  const { BrowserWindow: BW } = require("electron");
  const pdfWin = new BW({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(opts.html)}`);
  const pdfData = await pdfWin.webContents.printToPDF({
    printBackground: true,
    pageSize: "A4"
  });
  pdfWin.close();
  fs.writeFileSync(filePath, pdfData);
  return filePath;
}
function fmt(n) {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function buildTicketHtml(d) {
  const itemRows = d.items.map((i) => `
    <tr>
      <td>${escHtml(i.nombre)}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">$${fmt(i.precio)}</td>
      <td style="text-align:right">$${fmt(i.total)}</td>
    </tr>`).join("");
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 80mm; padding: 4mm; }
  h1 { text-align: center; font-size: 14px; margin-bottom: 2mm; }
  .center { text-align: center; }
  .divider { border-top: 1px dashed #000; margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; }
  th { border-bottom: 1px solid #000; text-align: left; padding-bottom: 1mm; }
  td { padding: 0.5mm 0; vertical-align: top; }
  .totals td { font-weight: bold; }
  .totals .label { text-align: right; padding-right: 2mm; }
  .totals .value { text-align: right; }
  .grand-total { font-size: 13px; }
</style>
</head>
<body>
  <h1>${escHtml(d.sucursal)}</h1>
  <p class="center">Folio: ${escHtml(d.folio)}</p>
  <p class="center">${escHtml(d.fecha)}</p>
  <p class="center">Cajero: ${escHtml(d.cajero)}</p>
  ${d.cliente ? `<p class="center">Cliente: ${escHtml(d.cliente)}</p>` : ""}
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th>Artículo</th><th style="text-align:center">Cant</th>
        <th style="text-align:right">Precio</th><th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="divider"></div>
  <table class="totals">
    <tr><td class="label">Subtotal</td><td class="value">$${fmt(d.subtotal)}</td></tr>
    ${d.descuento > 0 ? `<tr><td class="label">Descuento</td><td class="value">-$${fmt(d.descuento)}</td></tr>` : ""}
    ${d.impuesto > 0 ? `<tr><td class="label">Impuesto</td><td class="value">$${fmt(d.impuesto)}</td></tr>` : ""}
    <tr class="grand-total">
      <td class="label">TOTAL</td><td class="value">$${fmt(d.total)}</td>
    </tr>
    <tr><td class="label">Pago (${escHtml(d.metodoPago)})</td><td class="value">$${fmt(d.cambio + d.total)}</td></tr>
    ${d.cambio > 0 ? `<tr><td class="label">Cambio</td><td class="value">$${fmt(d.cambio)}</td></tr>` : ""}
  </table>
  <div class="divider"></div>
  <p class="center">¡Gracias por su compra!</p>
</body>
</html>`;
}
function escHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const { autoUpdater } = pkg;
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
let mainWindow = null;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hidden" : "default",
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#09090b" : "#ffffff",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });
  if (process.env["VITE_DEV_SERVER_URL"]) {
    mainWindow.loadURL(process.env["VITE_DEV_SERVER_URL"]);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.webContents.openDevTools();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.whenReady().then(() => {
  initDb();
  createWindow();
  setupIpcHandlers();
  setupAutoUpdater();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
function setupIpcHandlers() {
  const db2 = getDb();
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("app:platform", () => process.platform);
  ipcMain.handle("storage:set", (_e, key, value) => {
    if (!safeStorage.isEncryptionAvailable()) {
      db2.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").run(key, value);
      return;
    }
    const encrypted = safeStorage.encryptString(value).toString("base64");
    db2.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").run(key, encrypted);
  });
  ipcMain.handle("storage:get", (_e, key) => {
    const row = db2.prepare("SELECT value FROM kv_store WHERE key = ?").get(key);
    if (!row) return null;
    if (!safeStorage.isEncryptionAvailable()) return row.value;
    try {
      return safeStorage.decryptString(Buffer.from(row.value, "base64"));
    } catch {
      return row.value;
    }
  });
  ipcMain.handle("storage:delete", (_e, key) => {
    db2.prepare("DELETE FROM kv_store WHERE key = ?").run(key);
  });
  ipcMain.handle("db:products:get", () => {
    return db2.prepare("SELECT * FROM products_cache WHERE status = ? ORDER BY name ASC").all("ACTIVE");
  });
  ipcMain.handle("db:products:cache", (_e, products) => {
    cacheProducts(db2, products);
    return { ok: true };
  });
  ipcMain.handle("db:customers:get", () => {
    return db2.prepare("SELECT * FROM customers_cache ORDER BY first_name ASC").all();
  });
  ipcMain.handle("db:customers:cache", (_e, customers) => {
    cacheCustomers(db2, customers);
    return { ok: true };
  });
  ipcMain.handle("db:sales:save-pending", (_e, sale) => {
    const s = sale;
    db2.prepare(`
      INSERT INTO pending_sales
        (id, tenant_id, branch_id, user_id, client_id, items, subtotal, discount, tax, total,
         payment_method, payment_amount, change_amount, notes, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      s.id,
      s.tenantId,
      s.branchId,
      s.userId,
      s.clientId,
      JSON.stringify(s.items),
      s.subtotal,
      s.discount,
      s.tax,
      s.total,
      s.paymentMethod,
      s.paymentAmount,
      s.changeAmount,
      s.notes,
      Date.now()
    );
    return { ok: true };
  });
  ipcMain.handle("db:sales:get-pending", () => {
    return db2.prepare("SELECT * FROM pending_sales WHERE status = 'pending' ORDER BY created_at ASC").all();
  });
  ipcMain.handle("db:sales:count-pending", () => {
    const row = db2.prepare("SELECT COUNT(*) as n FROM pending_sales WHERE status = 'pending'").get();
    return row.n;
  });
  ipcMain.handle("db:cash:save-pending", (_e, movement) => {
    const m = movement;
    db2.prepare(`
      INSERT INTO pending_cash_movements
        (id, tenant_id, branch_id, session_id, type, amount, concept, notes, user_id, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(m.id, m.tenantId, m.branchId, m.sessionId, m.type, m.amount, m.concept, m.notes, m.userId, Date.now());
    return { ok: true };
  });
  ipcMain.handle("sync:run", async (_e, opts) => {
    const { apiBase, token } = opts;
    try {
      const salesResult = await syncPendingSales(db2, apiBase, token);
      const cashResult = await syncPendingCashMovements(db2, apiBase, token);
      const now = Date.now();
      db2.prepare("INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES (?, ?, ?)").run("last_sync", now.toString(), now);
      return { ok: true, ...salesResult, cashSynced: cashResult.synced, cashErrors: cashResult.errors };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("sync:last-time", () => {
    const row = db2.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'").get();
    return row ? parseInt(row.value) : null;
  });
  ipcMain.handle("print:ticket", async (_e, data) => {
    try {
      await printTicket(mainWindow, data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("print:pdf", async (_e, opts) => {
    try {
      const pdfPath = await printPdf(mainWindow, opts);
      return { ok: true, path: pdfPath };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("print:printers", async () => {
    if (!mainWindow) return [];
    return mainWindow.webContents.getPrintersAsync();
  });
  ipcMain.handle("dialog:save", async (_e, opts) => {
    const result = await dialog.showSaveDialog(mainWindow, opts);
    return result;
  });
}
function setupAutoUpdater() {
  if (process.env.NODE_ENV === "development") return;
  autoUpdater.autoDownload = false;
  autoUpdater.logger = null;
  autoUpdater.on("update-available", (info) => {
    mainWindow == null ? void 0 : mainWindow.webContents.send("updater:available", info);
  });
  autoUpdater.on("download-progress", (progress) => {
    mainWindow == null ? void 0 : mainWindow.webContents.send("updater:progress", progress);
  });
  autoUpdater.on("update-downloaded", () => {
    mainWindow == null ? void 0 : mainWindow.webContents.send("updater:ready");
  });
  ipcMain.handle("updater:check", async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("updater:download", () => {
    autoUpdater.downloadUpdate();
  });
  ipcMain.handle("updater:install", () => {
    autoUpdater.quitAndInstall();
  });
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {
  }), 1e4);
}
//# sourceMappingURL=main.js.map
