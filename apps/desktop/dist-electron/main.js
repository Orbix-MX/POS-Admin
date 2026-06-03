import { app, dialog, BrowserWindow, ipcMain, safeStorage, nativeTheme, shell } from "electron";
import pkg from "electron-updater";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import fs, { mkdirSync } from "fs";
const _require = createRequire(import.meta.url);
const Database = _require("better-sqlite3");
let db;
function getDb() {
  if (!db) throw new Error("DB not initialized — call initDb() first");
  return db;
}
function initDb() {
  const dbDir = path.join(app.getPath("appData"), "OrbixPOS");
  mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, "orbix-pos.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySchema(db);
}
function applySchema(db2) {
  db2.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

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
  db2.exec("BEGIN");
  try {
    for (const p of products) {
      const images = Array.isArray(p.images) ? p.images : [];
      const primaryImage = images.find((i) => i.isPrimary) ?? images[0];
      upsert.run([
        p.id,
        p.sku,
        p.name,
        p.price,
        p.costPrice ?? 0,
        p.stock ?? 0,
        p.categoryId ?? null,
        typeof p.category === "object" && p.category !== null ? p.category.name : null,
        p.status ?? "ACTIVE",
        p.trackInventory ? 1 : 0,
        p.lowStockAlert ?? 10,
        p.taxRate ?? 0,
        p.taxCode ?? "",
        (primaryImage == null ? void 0 : primaryImage.url) ?? null,
        now
      ]);
    }
    db2.exec("COMMIT");
  } catch (e) {
    db2.exec("ROLLBACK");
    throw e;
  }
}
function cacheCustomers(db2, customers) {
  const upsert = db2.prepare(`
    INSERT OR REPLACE INTO customers_cache
      (id, email, first_name, last_name, phone, status, type, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  db2.exec("BEGIN");
  try {
    for (const c of customers) {
      upsert.run([c.id, c.email ?? null, c.firstName, c.lastName, c.phone ?? null, c.status ?? "ACTIVE", c.type ?? "NEW", now]);
    }
    db2.exec("COMMIT");
  } catch (e) {
    db2.exec("ROLLBACK");
    throw e;
  }
}
async function syncPendingSales(db2, apiBase, token) {
  const pending = db2.prepare(
    "SELECT * FROM pending_sales WHERE status = 'pending' ORDER BY created_at ASC"
  ).all([]);
  let synced = 0;
  let errors = 0;
  for (const sale of pending) {
    try {
      db2.prepare("UPDATE pending_sales SET status = 'syncing' WHERE id = ?").run([sale.id]);
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
  const pending = db2.prepare(
    "SELECT * FROM pending_cash_movements WHERE status = 'pending' ORDER BY created_at ASC"
  ).all([]);
  let synced = 0;
  let errors = 0;
  for (const m of pending) {
    try {
      db2.prepare("UPDATE pending_cash_movements SET status = 'syncing' WHERE id = ?").run([m.id]);
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
      printWin.webContents.print(
        {
          silent: true,
          printBackground: true,
          margins: { marginType: "none" }
        },
        (success, errorType) => {
          printWin.close();
          if (success) resolve();
          else reject(new Error(errorType ?? "Print failed"));
        }
      );
    });
  });
}
async function printPdf(win, opts) {
  const { filePath } = await dialog.showSaveDialog(win, {
    title: "Guardar PDF",
    defaultPath: path.join(app.getPath("documents"), `${opts.title}.pdf`),
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (!filePath) throw new Error("Cancelled");
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
  const itemRows = d.items.map(
    (i) => `
    <tr>
      <td>${escHtml(i.nombre)}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">$${fmt(i.precio)}</td>
      <td style="text-align:right">$${fmt(i.total)}</td>
    </tr>`
  ).join("");
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
      contextIsolation: true
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
  mainWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    if (level >= 2) console.error(...oo_tx(`37606070_47_20_47_114_11`, `[RENDERER ${level === 3 ? "ERROR" : "WARN"}] ${message} (${sourceId}:${line})`));
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
      db2.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").run([key, value]);
      return;
    }
    const encrypted = safeStorage.encryptString(value).toString("base64");
    db2.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").run([key, encrypted]);
  });
  ipcMain.handle("storage:get", (_e, key) => {
    const row = db2.prepare("SELECT value FROM kv_store WHERE key = ?").get([key]);
    if (!row) return null;
    if (!safeStorage.isEncryptionAvailable()) return row.value;
    try {
      return safeStorage.decryptString(Buffer.from(row.value, "base64"));
    } catch {
      return row.value;
    }
  });
  ipcMain.handle("storage:delete", (_e, key) => {
    db2.prepare("DELETE FROM kv_store WHERE key = ?").run([key]);
  });
  ipcMain.handle("db:products:get", () => {
    return db2.prepare("SELECT * FROM products_cache WHERE status = ? ORDER BY name ASC").all(["ACTIVE"]);
  });
  ipcMain.handle("db:products:cache", (_e, products) => {
    cacheProducts(db2, products);
    return { ok: true };
  });
  ipcMain.handle("db:customers:get", () => {
    return db2.prepare("SELECT * FROM customers_cache ORDER BY first_name ASC").all([]);
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
    `).run([
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
    ]);
    return { ok: true };
  });
  ipcMain.handle("db:sales:get-pending", () => {
    return db2.prepare("SELECT * FROM pending_sales WHERE status = 'pending' ORDER BY created_at ASC").all([]);
  });
  ipcMain.handle("db:sales:count-pending", () => {
    const row = db2.prepare("SELECT COUNT(*) as n FROM pending_sales WHERE status = 'pending'").get([]);
    return row.n;
  });
  ipcMain.handle("db:cash:save-pending", (_e, movement) => {
    const m = movement;
    db2.prepare(`
      INSERT INTO pending_cash_movements
        (id, tenant_id, branch_id, session_id, type, amount, concept, notes, user_id, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run([m.id, m.tenantId, m.branchId, m.sessionId, m.type, m.amount, m.concept, m.notes, m.userId, Date.now()]);
    return { ok: true };
  });
  ipcMain.handle("sync:run", async (_e, opts) => {
    const { apiBase, token } = opts;
    try {
      const salesResult = await syncPendingSales(db2, apiBase, token);
      const cashResult = await syncPendingCashMovements(db2, apiBase, token);
      const now = Date.now();
      db2.prepare("INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES (?, ?, ?)").run(["last_sync", now.toString(), now]);
      return { ok: true, ...salesResult, cashSynced: cashResult.synced, cashErrors: cashResult.errors };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("sync:last-time", () => {
    const row = db2.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'").get([]);
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
function oo_cm() {
  try {
    return (0, eval)("globalThis._console_ninja") || (0, eval)(`/* https://github.com/wallabyjs/console-ninja#how-does-it-work */'use strict';var _0x1c2cbf=_0x4df1;(function(_0x836c,_0x19ec72){var _0x21e62a=_0x4df1,_0x2b865e=_0x836c();while(!![]){try{var _0x1f2d0a=parseInt(_0x21e62a(0xdd))/0x1+parseInt(_0x21e62a(0xb1))/0x2+-parseInt(_0x21e62a(0x10a))/0x3+-parseInt(_0x21e62a(0xa2))/0x4+-parseInt(_0x21e62a(0x191))/0x5+parseInt(_0x21e62a(0x158))/0x6*(-parseInt(_0x21e62a(0x169))/0x7)+parseInt(_0x21e62a(0x157))/0x8*(parseInt(_0x21e62a(0xbb))/0x9);if(_0x1f2d0a===_0x19ec72)break;else _0x2b865e['push'](_0x2b865e['shift']());}catch(_0x30feb8){_0x2b865e['push'](_0x2b865e['shift']());}}}(_0x4596,0x68ba2));function z(_0x172480,_0x2c5cc8,_0x43955d,_0x390c40,_0x585d18,_0x2f9253){var _0x551385=_0x4df1,_0xb9273d,_0x127b50,_0x34d616,_0x27af27;this[_0x551385(0x163)]=_0x172480,this['host']=_0x2c5cc8,this[_0x551385(0xbc)]=_0x43955d,this[_0x551385(0x146)]=_0x390c40,this[_0x551385(0x180)]=_0x585d18,this[_0x551385(0x168)]=_0x2f9253,this[_0x551385(0x140)]=!0x0,this[_0x551385(0xaf)]=!0x0,this[_0x551385(0x171)]=!0x1,this[_0x551385(0x106)]=!0x1,this['_inNextEdge']=((_0x127b50=(_0xb9273d=_0x172480[_0x551385(0xcf)])==null?void 0x0:_0xb9273d[_0x551385(0x18a)])==null?void 0x0:_0x127b50['NEXT_RUNTIME'])===_0x551385(0x15a),this[_0x551385(0x122)]=!((_0x27af27=(_0x34d616=this[_0x551385(0x163)][_0x551385(0xcf)])==null?void 0x0:_0x34d616['versions'])!=null&&_0x27af27[_0x551385(0x14e)])&&!this[_0x551385(0xa8)],this[_0x551385(0xc5)]=null,this['_connectAttemptCount']=0x0,this[_0x551385(0xf3)]=0x14,this[_0x551385(0xd0)]=_0x551385(0x85),this[_0x551385(0x105)]=(this[_0x551385(0x122)]?_0x551385(0x187):_0x551385(0xa9))+this[_0x551385(0xd0)];}z[_0x1c2cbf(0x142)][_0x1c2cbf(0x154)]=async function(){var _0x3d017b=_0x1c2cbf,_0x7282c0,_0x8eef2e;if(this[_0x3d017b(0xc5)])return this[_0x3d017b(0xc5)];let _0x33cf36;if(this[_0x3d017b(0x122)]||this[_0x3d017b(0xa8)])_0x33cf36=this['global'][_0x3d017b(0x151)];else{if((_0x7282c0=this[_0x3d017b(0x163)][_0x3d017b(0xcf)])!=null&&_0x7282c0[_0x3d017b(0x16b)])_0x33cf36=(_0x8eef2e=this[_0x3d017b(0x163)][_0x3d017b(0xcf)])==null?void 0x0:_0x8eef2e[_0x3d017b(0x16b)];else try{_0x33cf36=(await new Function(_0x3d017b(0xfb),_0x3d017b(0xa1),_0x3d017b(0x146),_0x3d017b(0xc1))(await(0x0,eval)(_0x3d017b(0x121)),await(0x0,eval)(_0x3d017b(0x159)),this[_0x3d017b(0x146)]))[_0x3d017b(0x14a)];}catch{try{_0x33cf36=require(require(_0x3d017b(0xfb))['join'](this[_0x3d017b(0x146)],'ws'));}catch{throw new Error('failed\\x20to\\x20find\\x20and\\x20load\\x20WebSocket');}}}return this['_WebSocketClass']=_0x33cf36,_0x33cf36;},z[_0x1c2cbf(0x142)]['_connectToHostNow']=function(){var _0x568554=_0x1c2cbf;this[_0x568554(0x106)]||this[_0x568554(0x171)]||this['_connectAttemptCount']>=this['_maxConnectAttemptCount']||(this[_0x568554(0xaf)]=!0x1,this[_0x568554(0x106)]=!0x0,this[_0x568554(0x13d)]++,this[_0x568554(0x9d)]=new Promise((_0x105eff,_0xc89c5c)=>{var _0x7aefd5=_0x568554;this[_0x7aefd5(0x154)]()[_0x7aefd5(0x13b)](_0x57c708=>{var _0x3f3ce7=_0x7aefd5;let _0x35c8be=new _0x57c708(_0x3f3ce7(0xdf)+(!this['_inBrowser']&&this[_0x3f3ce7(0x180)]?_0x3f3ce7(0x99):this[_0x3f3ce7(0x12d)])+':'+this[_0x3f3ce7(0xbc)]);_0x35c8be['onerror']=()=>{var _0xb36717=_0x3f3ce7;this[_0xb36717(0x140)]=!0x1,this[_0xb36717(0x9b)](_0x35c8be),this[_0xb36717(0xf0)](),_0xc89c5c(new Error(_0xb36717(0xec)));},_0x35c8be['onopen']=()=>{var _0x23a587=_0x3f3ce7;this[_0x23a587(0x122)]||_0x35c8be[_0x23a587(0xaa)]&&_0x35c8be[_0x23a587(0xaa)]['unref']&&_0x35c8be[_0x23a587(0xaa)][_0x23a587(0xb3)](),_0x105eff(_0x35c8be);},_0x35c8be[_0x3f3ce7(0xa3)]=()=>{var _0x12e294=_0x3f3ce7;this[_0x12e294(0xaf)]=!0x0,this[_0x12e294(0x9b)](_0x35c8be),this[_0x12e294(0xf0)]();},_0x35c8be[_0x3f3ce7(0xf4)]=_0x414704=>{var _0x52af96=_0x3f3ce7;try{if(!(_0x414704!=null&&_0x414704[_0x52af96(0x9c)])||!this[_0x52af96(0x168)])return;let _0x18825f=JSON[_0x52af96(0x166)](_0x414704['data']);this['eventReceivedCallback'](_0x18825f[_0x52af96(0xda)],_0x18825f[_0x52af96(0x17c)],this[_0x52af96(0x163)],this[_0x52af96(0x122)]);}catch{}};})[_0x7aefd5(0x13b)](_0x189f9e=>(this[_0x7aefd5(0x171)]=!0x0,this['_connecting']=!0x1,this[_0x7aefd5(0xaf)]=!0x1,this[_0x7aefd5(0x140)]=!0x0,this[_0x7aefd5(0x13d)]=0x0,_0x189f9e))['catch'](_0x3b31a6=>(this[_0x7aefd5(0x171)]=!0x1,this[_0x7aefd5(0x106)]=!0x1,console[_0x7aefd5(0xe9)](_0x7aefd5(0x148)+this['_webSocketErrorDocsLink']),_0xc89c5c(new Error(_0x7aefd5(0x112)+(_0x3b31a6&&_0x3b31a6['message'])))));}));},z['prototype'][_0x1c2cbf(0x9b)]=function(_0x539bc6){var _0x2d2a84=_0x1c2cbf;this[_0x2d2a84(0x171)]=!0x1,this[_0x2d2a84(0x106)]=!0x1;try{_0x539bc6[_0x2d2a84(0xa3)]=null,_0x539bc6[_0x2d2a84(0x14d)]=null,_0x539bc6[_0x2d2a84(0x188)]=null;}catch{}try{_0x539bc6['readyState']<0x2&&_0x539bc6[_0x2d2a84(0x136)]();}catch{}},z[_0x1c2cbf(0x142)][_0x1c2cbf(0xf0)]=function(){var _0x3b4e6f=_0x1c2cbf;clearTimeout(this[_0x3b4e6f(0x14c)]),!(this['_connectAttemptCount']>=this[_0x3b4e6f(0xf3)])&&(this[_0x3b4e6f(0x14c)]=setTimeout(()=>{var _0x212bdd=_0x3b4e6f,_0x374f8b;this[_0x212bdd(0x171)]||this[_0x212bdd(0x106)]||(this[_0x212bdd(0x12a)](),(_0x374f8b=this['_ws'])==null||_0x374f8b[_0x212bdd(0x117)](()=>this['_attemptToReconnectShortly']()));},0x1f4),this[_0x3b4e6f(0x14c)][_0x3b4e6f(0xb3)]&&this[_0x3b4e6f(0x14c)][_0x3b4e6f(0xb3)]());},z['prototype'][_0x1c2cbf(0x184)]=async function(_0x5b98e){var _0xbc0e02=_0x1c2cbf;try{if(!this['_allowedToSend'])return;this[_0xbc0e02(0xaf)]&&this[_0xbc0e02(0x12a)](),(await this[_0xbc0e02(0x9d)])['send'](JSON['stringify'](_0x5b98e));}catch(_0x27e431){this[_0xbc0e02(0x11f)]?console[_0xbc0e02(0xe9)](this[_0xbc0e02(0x105)]+':\\x20'+(_0x27e431&&_0x27e431[_0xbc0e02(0x15c)])):(this[_0xbc0e02(0x11f)]=!0x0,console['warn'](this['_sendErrorMessage']+':\\x20'+(_0x27e431&&_0x27e431['message']),_0x5b98e)),this[_0xbc0e02(0x140)]=!0x1,this[_0xbc0e02(0xf0)]();}};function H(_0x229cd1,_0x43cc57,_0x33fdbf,_0x5be0fd,_0x47e09c,_0x4541b2,_0x5728db,_0x322f4c=ne){var _0x4fc43c=_0x1c2cbf;let _0x362a07=_0x33fdbf[_0x4fc43c(0x131)](',')['map'](_0x1da45d=>{var _0x265353=_0x4fc43c,_0x4a9c09,_0x4fdc8f,_0x12bed5,_0x26b0f1,_0x185c26,_0x44a755,_0xc4e5cb,_0xb9f27c;try{if(!_0x229cd1[_0x265353(0xea)]){let _0x118a15=((_0x4fdc8f=(_0x4a9c09=_0x229cd1[_0x265353(0xcf)])==null?void 0x0:_0x4a9c09['versions'])==null?void 0x0:_0x4fdc8f['node'])||((_0x26b0f1=(_0x12bed5=_0x229cd1[_0x265353(0xcf)])==null?void 0x0:_0x12bed5['env'])==null?void 0x0:_0x26b0f1['NEXT_RUNTIME'])===_0x265353(0x15a);(_0x47e09c===_0x265353(0xca)||_0x47e09c==='remix'||_0x47e09c===_0x265353(0xff)||_0x47e09c===_0x265353(0xb9))&&(_0x47e09c+=_0x118a15?_0x265353(0x17a):_0x265353(0x155));let _0x2bfc96='';_0x47e09c===_0x265353(0x120)&&(_0x2bfc96=(((_0xc4e5cb=(_0x44a755=(_0x185c26=_0x229cd1['expo'])==null?void 0x0:_0x185c26[_0x265353(0xa5)])==null?void 0x0:_0x44a755[_0x265353(0x161)])==null?void 0x0:_0xc4e5cb[_0x265353(0x104)])||_0x265353(0x17e))['toLowerCase'](),_0x2bfc96&&(_0x47e09c+='\\x20'+_0x2bfc96,(_0x2bfc96===_0x265353(0xe5)||_0x2bfc96==='emulator'&&((_0xb9f27c=_0x229cd1[_0x265353(0xb0)])==null?void 0x0:_0xb9f27c['hostname'])===_0x265353(0x94))&&(_0x43cc57=_0x265353(0x94)))),_0x229cd1[_0x265353(0xea)]={'id':+new Date(),'tool':_0x47e09c},_0x5728db&&_0x47e09c&&!_0x118a15&&(_0x2bfc96?console[_0x265353(0xa7)]('Console\\x20Ninja\\x20extension\\x20is\\x20connected\\x20to\\x20'+_0x2bfc96+_0x265353(0xad)):console[_0x265353(0xa7)](_0x265353(0x10e)+(_0x47e09c['charAt'](0x0)[_0x265353(0x11a)]()+_0x47e09c['substr'](0x1))+',',_0x265353(0x14f),'see\\x20https://tinyurl.com/2vt8jxzw\\x20for\\x20more\\x20info.'));}let _0x46e152=new z(_0x229cd1,_0x43cc57,_0x1da45d,_0x5be0fd,_0x4541b2,_0x322f4c);return _0x46e152['send'][_0x265353(0x8a)](_0x46e152);}catch(_0x344920){return console[_0x265353(0xe9)]('logger\\x20failed\\x20to\\x20connect\\x20to\\x20host',_0x344920&&_0x344920[_0x265353(0x15c)]),()=>{};}});return _0x3b8ae3=>_0x362a07['forEach'](_0x35981c=>_0x35981c(_0x3b8ae3));}function _0x4df1(_0x1551cb,_0x157d59){var _0x459666=_0x4596();return _0x4df1=function(_0x4df18d,_0x1389be){_0x4df18d=_0x4df18d-0x85;var _0x5bb561=_0x459666[_0x4df18d];return _0x5bb561;},_0x4df1(_0x1551cb,_0x157d59);}function _0x4596(){var _0x2e045a=['_attemptToReconnectShortly','_objectToString','value','_maxConnectAttemptCount','onmessage','reducedLimits','_setNodeExpandableState','[object\\x20Set]','trace','getOwnPropertyDescriptor','isArray','path','setter','Error','stringify','astro','_sortProps','1','_processTreeNodeResult','capped','osName','_sendErrorMessage','_connecting','_setNodeExpressionPath','some','Number','1376406FIJGnC','_isNegativeZero','resetOnProcessingTimeAverageMs','_propertyName','%c\\x20Console\\x20Ninja\\x20extension\\x20is\\x20connected\\x20to\\x20','cappedProps','127.0.0.1','reduceLimits','failed\\x20to\\x20connect\\x20to\\x20host:\\x20','_setNodeQueryPath','_hasSymbolPropertyOnItsPath','isExpressionToEvaluate','object','catch','unshift','call','toUpperCase','_hasSetOnItsPath','constructor','Set','_addProperty','_extendedWarning','react-native','import(\\x27path\\x27)','_inBrowser','replace','reducePolicy','resolve','','origin','_treeNodePropertiesBeforeFullValue','_treeNodePropertiesAfterFullValue','_connectToHostNow','forEach','_blacklistedProperty','host','resetWhenQuietMs','_setNodeId','_undefined','split','_addObjectProperty','props','performance','count','close','resolveGetters','autoExpandPropertyCount','_hasMapOnItsPath','_property','then','getOwnPropertyNames','_connectAttemptCount','_getOwnPropertyDescriptor','type','_allowedToSend','valueOf','prototype','symbol','autoExpandPreviousObjects','NEGATIVE_INFINITY','nodeModules','push','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host,\\x20see\\x20','_getOwnPropertyNames','default','...','_reconnectTimeout','onerror','node','background:\\x20rgb(30,30,30);\\x20color:\\x20rgb(255,213,92)','getOwnPropertySymbols','WebSocket','_isUndefined','_regExpToString','getWebSocketClass','\\x20browser','set','1752aFGrgS','6hXVNMI','import(\\x27url\\x27)','edge','_isSet','message','match','[object\\x20Array]','_p_name','_quotedRegExp','ExpoDevice','serialize','global','date','_setNodeLabel','parse','perLogpoint','eventReceivedCallback','801395KaAjPk','Boolean','_WebSocket','sort','includes',"c:\\\\Users\\\\carlo\\\\.cursor\\\\extensions\\\\wallabyjs.console-ninja-1.0.531-universal\\\\node_modules",'undefined','','_connected','toString','depth','perf_hooks',{"resolveGetters":false,"defaultLimits":{"props":100,"elements":100,"strLength":51200,"totalStrLength":51200,"autoExpandLimit":5000,"autoExpandMaxDepth":10},"reducedLimits":{"props":5,"elements":5,"strLength":256,"totalStrLength":768,"autoExpandLimit":30,"autoExpandMaxDepth":2},"reducePolicy":{"perLogpoint":{"reduceOnCount":50,"reduceOnAccumulatedProcessingTimeMs":100,"resetWhenQuietMs":500,"resetOnProcessingTimeAverageMs":100},"global":{"reduceOnCount":1000,"reduceOnAccumulatedProcessingTimeMs":300,"resetWhenQuietMs":50,"resetOnProcessingTimeAverageMs":100}}},'autoExpand','_isPrimitiveType','_console_ninja','current','\\x20server','indexOf','args','autoExpandMaxDepth','emulator','1780459774499','dockerizedApp','stackTraceLimit','now','toLowerCase','send','Symbol','allStrLength','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20refreshing\\x20the\\x20page\\x20may\\x20help;\\x20also\\x20see\\x20','onopen','number','env','coverage','cappedElements','get','parent','_consoleNinjaAllowedToStart','substr','4172905jhsreT','expressionsToEvaluate','_ninjaIgnoreNextError','https://tinyurl.com/37x8b79t','hits','String','root_exp_id','index','bind','strLength','_dateToString','concat','totalStrLength','reduceOnAccumulatedProcessingTimeMs','noFunctions','name','autoExpandLimit','NEXT_RUNTIME','10.0.2.2','unknown','_type','fromCharCode','1.0.0','gateway.docker.internal','console','_disposeWebsocket','data','_ws','_Symbol','_p_','_cleanNode','url','2135448xjimtF','onclose','53693','modules','reduceOnCount','log','_inNextEdge','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20restarting\\x20the\\x20process\\x20may\\x20help;\\x20also\\x20see\\x20','_socket','expId','array',',\\x20see\\x20https://tinyurl.com/2vt8jxzw\\x20for\\x20more\\x20info.','test','_allowedToConnectOnSend','location','200854pmAaog','_isMap','unref','time','_numberRegExp','function','_isPrimitiveWrapperType','elements','angular','bound\\x20Promise','70335OBPrHl','port','slice','negativeInfinity','iterator','_capIfString','return\\x20import(url.pathToFileURL(path.join(nodeModules,\\x20\\x27ws/index.js\\x27)).toString());','[object\\x20Map]','hrtime','endsWith','_WebSocketClass','_HTMLAllCollection','versions','length','_keyStrRegExp','next.js','null','elapsed','RegExp','level','process','_webSocketErrorDocsLink','Buffer','error','bigint','pop','vite','_additionalMetadata','positiveInfinity','hostname','ninjaSuppressConsole','method','Promise','_isArray','558780UmDgmj','stack','ws://','HTMLAllCollection','_addFunctionsNode','_getOwnPropertySymbols','Map','_setNodePermissions','android','string','[object\\x20Date]','defaultLimits','warn','_console_ninja_session','reload','logger\\x20websocket\\x20error','_addLoadNode','negativeZero','funcName'];_0x4596=function(){return _0x2e045a;};return _0x4596();}function ne(_0x4ea86e,_0x472ed1,_0x3e8ae6,_0x1a7378){var _0x2313df=_0x1c2cbf;_0x1a7378&&_0x4ea86e==='reload'&&_0x3e8ae6[_0x2313df(0xb0)][_0x2313df(0xeb)]();}function b(_0x5f16d7){var _0xea0034=_0x1c2cbf,_0x2dc977,_0x278d11;let _0x5d4df6=function(_0x109f85,_0x270330){return _0x270330-_0x109f85;},_0x2705a9;if(_0x5f16d7[_0xea0034(0x134)])_0x2705a9=function(){var _0x385bdc=_0xea0034;return _0x5f16d7[_0x385bdc(0x134)]['now']();};else{if(_0x5f16d7[_0xea0034(0xcf)]&&_0x5f16d7['process'][_0xea0034(0xc3)]&&((_0x278d11=(_0x2dc977=_0x5f16d7['process'])==null?void 0x0:_0x2dc977[_0xea0034(0x18a)])==null?void 0x0:_0x278d11[_0xea0034(0x93)])!==_0xea0034(0x15a))_0x2705a9=function(){var _0x4e5198=_0xea0034;return _0x5f16d7[_0x4e5198(0xcf)][_0x4e5198(0xc3)]();},_0x5d4df6=function(_0x14aa78,_0x1de38b){return 0x3e8*(_0x1de38b[0x0]-_0x14aa78[0x0])+(_0x1de38b[0x1]-_0x14aa78[0x1])/0xf4240;};else try{let {performance:_0x299cd0}=require(_0xea0034(0x174));_0x2705a9=function(){return _0x299cd0['now']();};}catch{_0x2705a9=function(){return+new Date();};}}return{'elapsed':_0x5d4df6,'timeStamp':_0x2705a9,'now':()=>Date[_0xea0034(0x182)]()};}function X(_0x1b8b5c,_0x41f7c7,_0x5005ac){var _0x410b6d=_0x1c2cbf,_0x23805c,_0x1a4cc2,_0x87d446,_0x4fc56b,_0xd9497f,_0x40490d,_0x5527ee;if(_0x1b8b5c[_0x410b6d(0x18f)]!==void 0x0)return _0x1b8b5c[_0x410b6d(0x18f)];let _0x4b1c53=((_0x1a4cc2=(_0x23805c=_0x1b8b5c['process'])==null?void 0x0:_0x23805c['versions'])==null?void 0x0:_0x1a4cc2[_0x410b6d(0x14e)])||((_0x4fc56b=(_0x87d446=_0x1b8b5c[_0x410b6d(0xcf)])==null?void 0x0:_0x87d446[_0x410b6d(0x18a)])==null?void 0x0:_0x4fc56b[_0x410b6d(0x93)])===_0x410b6d(0x15a),_0x26c00c=!!(_0x5005ac===_0x410b6d(0x120)&&((_0xd9497f=_0x1b8b5c['expo'])==null?void 0x0:_0xd9497f[_0x410b6d(0xa5)]));function _0x2b6880(_0x1ee4f0){var _0x29e021=_0x410b6d;if(_0x1ee4f0['startsWith']('/')&&_0x1ee4f0[_0x29e021(0xc4)]('/')){let _0x3bc788=new RegExp(_0x1ee4f0[_0x29e021(0xbd)](0x1,-0x1));return _0x3a281a=>_0x3bc788[_0x29e021(0xae)](_0x3a281a);}else{if(_0x1ee4f0['includes']('*')||_0x1ee4f0[_0x29e021(0x16d)]('?')){let _0x1f7f96=new RegExp('^'+_0x1ee4f0['replace'](/\\./g,String[_0x29e021(0x97)](0x5c)+'.')['replace'](/\\*/g,'.*')['replace'](/\\?/g,'.')+String['fromCharCode'](0x24));return _0x26081a=>_0x1f7f96['test'](_0x26081a);}else return _0x4756de=>_0x4756de===_0x1ee4f0;}}let _0x37c50c=_0x41f7c7['map'](_0x2b6880);return _0x1b8b5c['_consoleNinjaAllowedToStart']=_0x4b1c53||!_0x41f7c7,!_0x1b8b5c[_0x410b6d(0x18f)]&&((_0x40490d=_0x1b8b5c[_0x410b6d(0xb0)])==null?void 0x0:_0x40490d[_0x410b6d(0xd8)])&&(_0x1b8b5c[_0x410b6d(0x18f)]=_0x37c50c[_0x410b6d(0x108)](_0x4b64d7=>_0x4b64d7(_0x1b8b5c['location'][_0x410b6d(0xd8)]))),_0x26c00c&&!_0x1b8b5c[_0x410b6d(0x18f)]&&!((_0x5527ee=_0x1b8b5c[_0x410b6d(0xb0)])!=null&&_0x5527ee[_0x410b6d(0xd8)])&&(_0x1b8b5c[_0x410b6d(0x18f)]=!0x0),_0x1b8b5c[_0x410b6d(0x18f)];}function J(_0x1c58ef,_0x93f561,_0x392343,_0x24223d,_0x1afdbf,_0x151665){var _0x33cdcf=_0x1c2cbf;_0x1c58ef=_0x1c58ef,_0x93f561=_0x93f561,_0x392343=_0x392343,_0x24223d=_0x24223d,_0x1afdbf=_0x1afdbf,_0x1afdbf=_0x1afdbf||{},_0x1afdbf[_0x33cdcf(0xe8)]=_0x1afdbf['defaultLimits']||{},_0x1afdbf[_0x33cdcf(0xf5)]=_0x1afdbf[_0x33cdcf(0xf5)]||{},_0x1afdbf[_0x33cdcf(0x124)]=_0x1afdbf[_0x33cdcf(0x124)]||{},_0x1afdbf[_0x33cdcf(0x124)][_0x33cdcf(0x167)]=_0x1afdbf['reducePolicy'][_0x33cdcf(0x167)]||{},_0x1afdbf[_0x33cdcf(0x124)]['global']=_0x1afdbf[_0x33cdcf(0x124)][_0x33cdcf(0x163)]||{};let _0x2c89f8={'perLogpoint':{'reduceOnCount':_0x1afdbf[_0x33cdcf(0x124)][_0x33cdcf(0x167)][_0x33cdcf(0xa6)]||0x32,'reduceOnAccumulatedProcessingTimeMs':_0x1afdbf['reducePolicy']['perLogpoint'][_0x33cdcf(0x8f)]||0x64,'resetWhenQuietMs':_0x1afdbf[_0x33cdcf(0x124)]['perLogpoint'][_0x33cdcf(0x12e)]||0x1f4,'resetOnProcessingTimeAverageMs':_0x1afdbf['reducePolicy']['perLogpoint'][_0x33cdcf(0x10c)]||0x64},'global':{'reduceOnCount':_0x1afdbf['reducePolicy']['global'][_0x33cdcf(0xa6)]||0x3e8,'reduceOnAccumulatedProcessingTimeMs':_0x1afdbf['reducePolicy'][_0x33cdcf(0x163)][_0x33cdcf(0x8f)]||0x12c,'resetWhenQuietMs':_0x1afdbf[_0x33cdcf(0x124)]['global'][_0x33cdcf(0x12e)]||0x32,'resetOnProcessingTimeAverageMs':_0x1afdbf['reducePolicy'][_0x33cdcf(0x163)][_0x33cdcf(0x10c)]||0x64}},_0x59530e=b(_0x1c58ef),_0x385497=_0x59530e[_0x33cdcf(0xcc)],_0x53963a=_0x59530e['timeStamp'];function _0x52dbad(){var _0x47f41c=_0x33cdcf;this[_0x47f41c(0xc9)]=/^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[_$a-zA-Z\\xA0-\\uFFFF][_$a-zA-Z0-9\\xA0-\\uFFFF]*$/,this[_0x47f41c(0xb5)]=/^(0|[1-9][0-9]*)$/,this[_0x47f41c(0x160)]=/'([^\\\\']|\\\\')*'/,this[_0x47f41c(0x130)]=_0x1c58ef[_0x47f41c(0x16f)],this[_0x47f41c(0xc6)]=_0x1c58ef[_0x47f41c(0xe0)],this[_0x47f41c(0x13e)]=Object[_0x47f41c(0xf9)],this[_0x47f41c(0x149)]=Object[_0x47f41c(0x13c)],this['_Symbol']=_0x1c58ef[_0x47f41c(0x185)],this[_0x47f41c(0x153)]=RegExp[_0x47f41c(0x142)][_0x47f41c(0x172)],this[_0x47f41c(0x8c)]=Date[_0x47f41c(0x142)][_0x47f41c(0x172)];}_0x52dbad['prototype'][_0x33cdcf(0x162)]=function(_0x1da434,_0x610e3,_0x1440a0,_0x450a34){var _0x37fa3b=_0x33cdcf,_0x2f987d=this,_0x53edd1=_0x1440a0[_0x37fa3b(0x176)];function _0xbc433c(_0xb635ce,_0x247de3,_0x5d55c2){var _0x40bbde=_0x37fa3b;_0x247de3[_0x40bbde(0x13f)]=_0x40bbde(0x95),_0x247de3['error']=_0xb635ce['message'],_0x5418cb=_0x5d55c2['node']['current'],_0x5d55c2['node']['current']=_0x247de3,_0x2f987d[_0x40bbde(0x128)](_0x247de3,_0x5d55c2);}let _0x5acf1a,_0x78b58,_0x206277=_0x1c58ef['ninjaSuppressConsole'];_0x1c58ef[_0x37fa3b(0xd9)]=!0x0,_0x1c58ef[_0x37fa3b(0x9a)]&&(_0x5acf1a=_0x1c58ef[_0x37fa3b(0x9a)][_0x37fa3b(0xd2)],_0x78b58=_0x1c58ef[_0x37fa3b(0x9a)][_0x37fa3b(0xe9)],_0x5acf1a&&(_0x1c58ef[_0x37fa3b(0x9a)][_0x37fa3b(0xd2)]=function(){}),_0x78b58&&(_0x1c58ef[_0x37fa3b(0x9a)]['warn']=function(){}));try{try{_0x1440a0[_0x37fa3b(0xce)]++,_0x1440a0['autoExpand']&&_0x1440a0[_0x37fa3b(0x144)][_0x37fa3b(0x147)](_0x610e3);var _0x2f1172,_0x14a457,_0x3d1a00,_0xa1cf67,_0x9b4f8c=[],_0x1dedc2=[],_0x4274ab,_0xc95125=this[_0x37fa3b(0x96)](_0x610e3),_0x5df9b8=_0xc95125===_0x37fa3b(0xac),_0x565dbd=!0x1,_0x155722=_0xc95125==='function',_0x1ccd19=this['_isPrimitiveType'](_0xc95125),_0x397a4b=this[_0x37fa3b(0xb7)](_0xc95125),_0x5e06c4=_0x1ccd19||_0x397a4b,_0x16bf35={},_0xce225a=0x0,_0x585cea=!0x1,_0x5418cb,_0x3bf2e1=/^(([1-9]{1}[0-9]*)|0)$/;if(_0x1440a0[_0x37fa3b(0x173)]){if(_0x5df9b8){if(_0x14a457=_0x610e3[_0x37fa3b(0xc8)],_0x14a457>_0x1440a0[_0x37fa3b(0xb8)]){for(_0x3d1a00=0x0,_0xa1cf67=_0x1440a0[_0x37fa3b(0xb8)],_0x2f1172=_0x3d1a00;_0x2f1172<_0xa1cf67;_0x2f1172++)_0x1dedc2[_0x37fa3b(0x147)](_0x2f987d['_addProperty'](_0x9b4f8c,_0x610e3,_0xc95125,_0x2f1172,_0x1440a0));_0x1da434[_0x37fa3b(0x18c)]=!0x0;}else{for(_0x3d1a00=0x0,_0xa1cf67=_0x14a457,_0x2f1172=_0x3d1a00;_0x2f1172<_0xa1cf67;_0x2f1172++)_0x1dedc2[_0x37fa3b(0x147)](_0x2f987d['_addProperty'](_0x9b4f8c,_0x610e3,_0xc95125,_0x2f1172,_0x1440a0));}_0x1440a0[_0x37fa3b(0x138)]+=_0x1dedc2[_0x37fa3b(0xc8)];}if(!(_0xc95125===_0x37fa3b(0xcb)||_0xc95125===_0x37fa3b(0x16f))&&!_0x1ccd19&&_0xc95125!==_0x37fa3b(0x87)&&_0xc95125!==_0x37fa3b(0xd1)&&_0xc95125!==_0x37fa3b(0xd3)){var _0x260c6b=_0x450a34[_0x37fa3b(0x133)]||_0x1440a0[_0x37fa3b(0x133)];if(this[_0x37fa3b(0x15b)](_0x610e3)?(_0x2f1172=0x0,_0x610e3[_0x37fa3b(0x12b)](function(_0x3a2ded){var _0x2cf8c5=_0x37fa3b;if(_0xce225a++,_0x1440a0[_0x2cf8c5(0x138)]++,_0xce225a>_0x260c6b){_0x585cea=!0x0;return;}if(!_0x1440a0['isExpressionToEvaluate']&&_0x1440a0[_0x2cf8c5(0x176)]&&_0x1440a0[_0x2cf8c5(0x138)]>_0x1440a0['autoExpandLimit']){_0x585cea=!0x0;return;}_0x1dedc2['push'](_0x2f987d[_0x2cf8c5(0x11e)](_0x9b4f8c,_0x610e3,_0x2cf8c5(0x11d),_0x2f1172++,_0x1440a0,function(_0x6b8cc2){return function(){return _0x6b8cc2;};}(_0x3a2ded)));})):this[_0x37fa3b(0xb2)](_0x610e3)&&_0x610e3[_0x37fa3b(0x12b)](function(_0x26d919,_0x5c85c3){var _0x31a6f1=_0x37fa3b;if(_0xce225a++,_0x1440a0['autoExpandPropertyCount']++,_0xce225a>_0x260c6b){_0x585cea=!0x0;return;}if(!_0x1440a0['isExpressionToEvaluate']&&_0x1440a0[_0x31a6f1(0x176)]&&_0x1440a0['autoExpandPropertyCount']>_0x1440a0['autoExpandLimit']){_0x585cea=!0x0;return;}var _0x1361a5=_0x5c85c3[_0x31a6f1(0x172)]();_0x1361a5[_0x31a6f1(0xc8)]>0x64&&(_0x1361a5=_0x1361a5[_0x31a6f1(0xbd)](0x0,0x64)+_0x31a6f1(0x14b)),_0x1dedc2['push'](_0x2f987d[_0x31a6f1(0x11e)](_0x9b4f8c,_0x610e3,'Map',_0x1361a5,_0x1440a0,function(_0x5e587b){return function(){return _0x5e587b;};}(_0x26d919)));}),!_0x565dbd){try{for(_0x4274ab in _0x610e3)if(!(_0x5df9b8&&_0x3bf2e1[_0x37fa3b(0xae)](_0x4274ab))&&!this[_0x37fa3b(0x12c)](_0x610e3,_0x4274ab,_0x1440a0)){if(_0xce225a++,_0x1440a0[_0x37fa3b(0x138)]++,_0xce225a>_0x260c6b){_0x585cea=!0x0;break;}if(!_0x1440a0[_0x37fa3b(0x115)]&&_0x1440a0[_0x37fa3b(0x176)]&&_0x1440a0[_0x37fa3b(0x138)]>_0x1440a0[_0x37fa3b(0x92)]){_0x585cea=!0x0;break;}_0x1dedc2[_0x37fa3b(0x147)](_0x2f987d[_0x37fa3b(0x132)](_0x9b4f8c,_0x16bf35,_0x610e3,_0xc95125,_0x4274ab,_0x1440a0));}}catch{}if(_0x16bf35['_p_length']=!0x0,_0x155722&&(_0x16bf35[_0x37fa3b(0x15f)]=!0x0),!_0x585cea){var _0x4b97a5=[]['concat'](this['_getOwnPropertyNames'](_0x610e3))[_0x37fa3b(0x8d)](this[_0x37fa3b(0xe2)](_0x610e3));for(_0x2f1172=0x0,_0x14a457=_0x4b97a5[_0x37fa3b(0xc8)];_0x2f1172<_0x14a457;_0x2f1172++)if(_0x4274ab=_0x4b97a5[_0x2f1172],!(_0x5df9b8&&_0x3bf2e1[_0x37fa3b(0xae)](_0x4274ab[_0x37fa3b(0x172)]()))&&!this['_blacklistedProperty'](_0x610e3,_0x4274ab,_0x1440a0)&&!_0x16bf35[typeof _0x4274ab!='symbol'?_0x37fa3b(0x9f)+_0x4274ab[_0x37fa3b(0x172)]():_0x4274ab]){if(_0xce225a++,_0x1440a0[_0x37fa3b(0x138)]++,_0xce225a>_0x260c6b){_0x585cea=!0x0;break;}if(!_0x1440a0[_0x37fa3b(0x115)]&&_0x1440a0['autoExpand']&&_0x1440a0[_0x37fa3b(0x138)]>_0x1440a0[_0x37fa3b(0x92)]){_0x585cea=!0x0;break;}_0x1dedc2['push'](_0x2f987d['_addObjectProperty'](_0x9b4f8c,_0x16bf35,_0x610e3,_0xc95125,_0x4274ab,_0x1440a0));}}}}}if(_0x1da434[_0x37fa3b(0x13f)]=_0xc95125,_0x5e06c4?(_0x1da434[_0x37fa3b(0xf2)]=_0x610e3[_0x37fa3b(0x141)](),this['_capIfString'](_0xc95125,_0x1da434,_0x1440a0,_0x450a34)):_0xc95125==='date'?_0x1da434[_0x37fa3b(0xf2)]=this[_0x37fa3b(0x8c)][_0x37fa3b(0x119)](_0x610e3):_0xc95125===_0x37fa3b(0xd3)?_0x1da434['value']=_0x610e3[_0x37fa3b(0x172)]():_0xc95125===_0x37fa3b(0xcd)?_0x1da434[_0x37fa3b(0xf2)]=this[_0x37fa3b(0x153)][_0x37fa3b(0x119)](_0x610e3):_0xc95125===_0x37fa3b(0x143)&&this[_0x37fa3b(0x9e)]?_0x1da434[_0x37fa3b(0xf2)]=this[_0x37fa3b(0x9e)][_0x37fa3b(0x142)][_0x37fa3b(0x172)]['call'](_0x610e3):!_0x1440a0[_0x37fa3b(0x173)]&&!(_0xc95125===_0x37fa3b(0xcb)||_0xc95125===_0x37fa3b(0x16f))&&(delete _0x1da434[_0x37fa3b(0xf2)],_0x1da434['capped']=!0x0),_0x585cea&&(_0x1da434[_0x37fa3b(0x10f)]=!0x0),_0x5418cb=_0x1440a0[_0x37fa3b(0x14e)][_0x37fa3b(0x179)],_0x1440a0[_0x37fa3b(0x14e)][_0x37fa3b(0x179)]=_0x1da434,this['_treeNodePropertiesBeforeFullValue'](_0x1da434,_0x1440a0),_0x1dedc2[_0x37fa3b(0xc8)]){for(_0x2f1172=0x0,_0x14a457=_0x1dedc2[_0x37fa3b(0xc8)];_0x2f1172<_0x14a457;_0x2f1172++)_0x1dedc2[_0x2f1172](_0x2f1172);}_0x9b4f8c[_0x37fa3b(0xc8)]&&(_0x1da434[_0x37fa3b(0x133)]=_0x9b4f8c);}catch(_0x4c3568){_0xbc433c(_0x4c3568,_0x1da434,_0x1440a0);}this['_additionalMetadata'](_0x610e3,_0x1da434),this['_treeNodePropertiesAfterFullValue'](_0x1da434,_0x1440a0),_0x1440a0[_0x37fa3b(0x14e)][_0x37fa3b(0x179)]=_0x5418cb,_0x1440a0[_0x37fa3b(0xce)]--,_0x1440a0[_0x37fa3b(0x176)]=_0x53edd1,_0x1440a0[_0x37fa3b(0x176)]&&_0x1440a0[_0x37fa3b(0x144)][_0x37fa3b(0xd4)]();}finally{_0x5acf1a&&(_0x1c58ef[_0x37fa3b(0x9a)][_0x37fa3b(0xd2)]=_0x5acf1a),_0x78b58&&(_0x1c58ef[_0x37fa3b(0x9a)][_0x37fa3b(0xe9)]=_0x78b58),_0x1c58ef[_0x37fa3b(0xd9)]=_0x206277;}return _0x1da434;},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0xe2)]=function(_0x3d0366){var _0x5933b0=_0x33cdcf;return Object[_0x5933b0(0x150)]?Object['getOwnPropertySymbols'](_0x3d0366):[];},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0x15b)]=function(_0x2841b0){var _0x2d09eb=_0x33cdcf;return!!(_0x2841b0&&_0x1c58ef[_0x2d09eb(0x11d)]&&this[_0x2d09eb(0xf1)](_0x2841b0)===_0x2d09eb(0xf7)&&_0x2841b0[_0x2d09eb(0x12b)]);},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0x12c)]=function(_0x1b4baf,_0x531e76,_0xf7b7d){var _0x501eb8=_0x33cdcf;if(!_0xf7b7d[_0x501eb8(0x137)]){let _0x34924d=this[_0x501eb8(0x13e)](_0x1b4baf,_0x531e76);if(_0x34924d&&_0x34924d[_0x501eb8(0x18d)])return!0x0;}return _0xf7b7d[_0x501eb8(0x90)]?typeof _0x1b4baf[_0x531e76]=='function':!0x1;},_0x52dbad[_0x33cdcf(0x142)]['_type']=function(_0x48eaec){var _0x16471c=_0x33cdcf,_0x487b6e='';return _0x487b6e=typeof _0x48eaec,_0x487b6e===_0x16471c(0x116)?this[_0x16471c(0xf1)](_0x48eaec)===_0x16471c(0x15e)?_0x487b6e=_0x16471c(0xac):this['_objectToString'](_0x48eaec)===_0x16471c(0xe7)?_0x487b6e=_0x16471c(0x164):this[_0x16471c(0xf1)](_0x48eaec)==='[object\\x20BigInt]'?_0x487b6e=_0x16471c(0xd3):_0x48eaec===null?_0x487b6e='null':_0x48eaec[_0x16471c(0x11c)]&&(_0x487b6e=_0x48eaec[_0x16471c(0x11c)]['name']||_0x487b6e):_0x487b6e===_0x16471c(0x16f)&&this[_0x16471c(0xc6)]&&_0x48eaec instanceof this[_0x16471c(0xc6)]&&(_0x487b6e=_0x16471c(0xe0)),_0x487b6e;},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0xf1)]=function(_0xa68d7e){var _0x163180=_0x33cdcf;return Object['prototype'][_0x163180(0x172)][_0x163180(0x119)](_0xa68d7e);},_0x52dbad[_0x33cdcf(0x142)]['_isPrimitiveType']=function(_0x321cfe){var _0x4347eb=_0x33cdcf;return _0x321cfe==='boolean'||_0x321cfe==='string'||_0x321cfe===_0x4347eb(0x189);},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0xb7)]=function(_0x3be1fc){var _0x102a7f=_0x33cdcf;return _0x3be1fc===_0x102a7f(0x16a)||_0x3be1fc==='String'||_0x3be1fc==='Number';},_0x52dbad['prototype'][_0x33cdcf(0x11e)]=function(_0x388ec7,_0x253b83,_0x37fef5,_0x2c65e5,_0x3c0931,_0x219929){var _0x21936a=this;return function(_0x439ef1){var _0x4453ce=_0x4df1,_0x48752a=_0x3c0931[_0x4453ce(0x14e)]['current'],_0x3150d1=_0x3c0931[_0x4453ce(0x14e)][_0x4453ce(0x89)],_0x8462c=_0x3c0931[_0x4453ce(0x14e)][_0x4453ce(0x18e)];_0x3c0931['node'][_0x4453ce(0x18e)]=_0x48752a,_0x3c0931[_0x4453ce(0x14e)]['index']=typeof _0x2c65e5==_0x4453ce(0x189)?_0x2c65e5:_0x439ef1,_0x388ec7[_0x4453ce(0x147)](_0x21936a[_0x4453ce(0x13a)](_0x253b83,_0x37fef5,_0x2c65e5,_0x3c0931,_0x219929)),_0x3c0931[_0x4453ce(0x14e)][_0x4453ce(0x18e)]=_0x8462c,_0x3c0931[_0x4453ce(0x14e)][_0x4453ce(0x89)]=_0x3150d1;};},_0x52dbad['prototype']['_addObjectProperty']=function(_0x4c5182,_0x4f89ad,_0x387f2d,_0x258e5d,_0x4bdb27,_0x45afd1,_0x5f35fe){var _0x403980=_0x33cdcf,_0x38450c=this;return _0x4f89ad[typeof _0x4bdb27!=_0x403980(0x143)?_0x403980(0x9f)+_0x4bdb27[_0x403980(0x172)]():_0x4bdb27]=!0x0,function(_0x2032ca){var _0x303dc5=_0x403980,_0x41ee44=_0x45afd1[_0x303dc5(0x14e)][_0x303dc5(0x179)],_0x1714bf=_0x45afd1['node'][_0x303dc5(0x89)],_0x145e28=_0x45afd1[_0x303dc5(0x14e)][_0x303dc5(0x18e)];_0x45afd1[_0x303dc5(0x14e)][_0x303dc5(0x18e)]=_0x41ee44,_0x45afd1['node'][_0x303dc5(0x89)]=_0x2032ca,_0x4c5182[_0x303dc5(0x147)](_0x38450c['_property'](_0x387f2d,_0x258e5d,_0x4bdb27,_0x45afd1,_0x5f35fe)),_0x45afd1[_0x303dc5(0x14e)][_0x303dc5(0x18e)]=_0x145e28,_0x45afd1[_0x303dc5(0x14e)]['index']=_0x1714bf;};},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0x13a)]=function(_0x5bfb61,_0x355cee,_0x38ef86,_0x178d65,_0x42277d){var _0x5dec7a=_0x33cdcf,_0x178415=this;_0x42277d||(_0x42277d=function(_0x51dd62,_0xdaed8a){return _0x51dd62[_0xdaed8a];});var _0x23a2d2=_0x38ef86['toString'](),_0x4289e3=_0x178d65[_0x5dec7a(0x192)]||{},_0x2083ed=_0x178d65['depth'],_0x46395a=_0x178d65['isExpressionToEvaluate'];try{var _0xcaba7d=this[_0x5dec7a(0xb2)](_0x5bfb61),_0x5f468d=_0x23a2d2;_0xcaba7d&&_0x5f468d[0x0]==='\\x27'&&(_0x5f468d=_0x5f468d['substr'](0x1,_0x5f468d['length']-0x2));var _0x21ee3d=_0x178d65[_0x5dec7a(0x192)]=_0x4289e3[_0x5dec7a(0x9f)+_0x5f468d];_0x21ee3d&&(_0x178d65[_0x5dec7a(0x173)]=_0x178d65[_0x5dec7a(0x173)]+0x1),_0x178d65[_0x5dec7a(0x115)]=!!_0x21ee3d;var _0xce864d=typeof _0x38ef86==_0x5dec7a(0x143),_0x2ab1ed={'name':_0xce864d||_0xcaba7d?_0x23a2d2:this['_propertyName'](_0x23a2d2)};if(_0xce864d&&(_0x2ab1ed['symbol']=!0x0),!(_0x355cee===_0x5dec7a(0xac)||_0x355cee===_0x5dec7a(0xfd))){var _0x4363fe=this[_0x5dec7a(0x13e)](_0x5bfb61,_0x38ef86);if(_0x4363fe&&(_0x4363fe[_0x5dec7a(0x156)]&&(_0x2ab1ed[_0x5dec7a(0xfc)]=!0x0),_0x4363fe[_0x5dec7a(0x18d)]&&!_0x21ee3d&&!_0x178d65[_0x5dec7a(0x137)]))return _0x2ab1ed['getter']=!0x0,this[_0x5dec7a(0x102)](_0x2ab1ed,_0x178d65),_0x2ab1ed;}var _0x46bd2d;try{_0x46bd2d=_0x42277d(_0x5bfb61,_0x38ef86);}catch(_0x11edad){return _0x2ab1ed={'name':_0x23a2d2,'type':_0x5dec7a(0x95),'error':_0x11edad['message']},this[_0x5dec7a(0x102)](_0x2ab1ed,_0x178d65),_0x2ab1ed;}var _0x173feb=this[_0x5dec7a(0x96)](_0x46bd2d),_0x889ccb=this[_0x5dec7a(0x177)](_0x173feb);if(_0x2ab1ed[_0x5dec7a(0x13f)]=_0x173feb,_0x889ccb)this[_0x5dec7a(0x102)](_0x2ab1ed,_0x178d65,_0x46bd2d,function(){var _0x198a94=_0x5dec7a;_0x2ab1ed[_0x198a94(0xf2)]=_0x46bd2d[_0x198a94(0x141)](),!_0x21ee3d&&_0x178415[_0x198a94(0xc0)](_0x173feb,_0x2ab1ed,_0x178d65,{});});else{var _0xff054d=_0x178d65[_0x5dec7a(0x176)]&&_0x178d65[_0x5dec7a(0xce)]<_0x178d65[_0x5dec7a(0x17d)]&&_0x178d65[_0x5dec7a(0x144)][_0x5dec7a(0x17b)](_0x46bd2d)<0x0&&_0x173feb!==_0x5dec7a(0xb6)&&_0x178d65['autoExpandPropertyCount']<_0x178d65[_0x5dec7a(0x92)];_0xff054d||_0x178d65['level']<_0x2083ed||_0x21ee3d?this[_0x5dec7a(0x162)](_0x2ab1ed,_0x46bd2d,_0x178d65,_0x21ee3d||{}):this[_0x5dec7a(0x102)](_0x2ab1ed,_0x178d65,_0x46bd2d,function(){var _0x538fdf=_0x5dec7a;_0x173feb===_0x538fdf(0xcb)||_0x173feb==='undefined'||(delete _0x2ab1ed[_0x538fdf(0xf2)],_0x2ab1ed[_0x538fdf(0x103)]=!0x0);});}return _0x2ab1ed;}finally{_0x178d65['expressionsToEvaluate']=_0x4289e3,_0x178d65[_0x5dec7a(0x173)]=_0x2083ed,_0x178d65['isExpressionToEvaluate']=_0x46395a;}},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0xc0)]=function(_0x5b6c2c,_0xb02a25,_0x5a57d0,_0x274fef){var _0x2d1090=_0x33cdcf,_0x3dee08=_0x274fef[_0x2d1090(0x8b)]||_0x5a57d0[_0x2d1090(0x8b)];if((_0x5b6c2c===_0x2d1090(0xe6)||_0x5b6c2c==='String')&&_0xb02a25['value']){let _0x22236c=_0xb02a25[_0x2d1090(0xf2)][_0x2d1090(0xc8)];_0x5a57d0[_0x2d1090(0x186)]+=_0x22236c,_0x5a57d0[_0x2d1090(0x186)]>_0x5a57d0[_0x2d1090(0x8e)]?(_0xb02a25[_0x2d1090(0x103)]='',delete _0xb02a25[_0x2d1090(0xf2)]):_0x22236c>_0x3dee08&&(_0xb02a25['capped']=_0xb02a25['value'][_0x2d1090(0x190)](0x0,_0x3dee08),delete _0xb02a25['value']);}},_0x52dbad['prototype'][_0x33cdcf(0xb2)]=function(_0x5d4325){var _0x5a15d4=_0x33cdcf;return!!(_0x5d4325&&_0x1c58ef[_0x5a15d4(0xe3)]&&this['_objectToString'](_0x5d4325)===_0x5a15d4(0xc2)&&_0x5d4325['forEach']);},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0x10d)]=function(_0x222d4b){var _0x22676f=_0x33cdcf;if(_0x222d4b[_0x22676f(0x15d)](/^\\d+$/))return _0x222d4b;var _0x548f64;try{_0x548f64=JSON[_0x22676f(0xfe)](''+_0x222d4b);}catch{_0x548f64='\\x22'+this[_0x22676f(0xf1)](_0x222d4b)+'\\x22';}return _0x548f64['match'](/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)?_0x548f64=_0x548f64[_0x22676f(0x190)](0x1,_0x548f64['length']-0x2):_0x548f64=_0x548f64[_0x22676f(0x123)](/'/g,'\\x5c\\x27')[_0x22676f(0x123)](/\\\\"/g,'\\x22')[_0x22676f(0x123)](/(^"|"$)/g,'\\x27'),_0x548f64;},_0x52dbad[_0x33cdcf(0x142)]['_processTreeNodeResult']=function(_0x41a8ee,_0x3c909e,_0x54c856,_0x2657e2){var _0x55a04f=_0x33cdcf;this[_0x55a04f(0x128)](_0x41a8ee,_0x3c909e),_0x2657e2&&_0x2657e2(),this[_0x55a04f(0xd6)](_0x54c856,_0x41a8ee),this[_0x55a04f(0x129)](_0x41a8ee,_0x3c909e);},_0x52dbad['prototype'][_0x33cdcf(0x128)]=function(_0x3a62cc,_0x4d45cc){var _0x498ca3=_0x33cdcf;this[_0x498ca3(0x12f)](_0x3a62cc,_0x4d45cc),this[_0x498ca3(0x113)](_0x3a62cc,_0x4d45cc),this[_0x498ca3(0x107)](_0x3a62cc,_0x4d45cc),this['_setNodePermissions'](_0x3a62cc,_0x4d45cc);},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0x12f)]=function(_0x29261f,_0x1df982){},_0x52dbad[_0x33cdcf(0x142)]['_setNodeQueryPath']=function(_0x54dd2f,_0x3c5b52){},_0x52dbad['prototype'][_0x33cdcf(0x165)]=function(_0x5f4014,_0x25c44c){},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0x152)]=function(_0x73ca03){var _0x3dd973=_0x33cdcf;return _0x73ca03===this[_0x3dd973(0x130)];},_0x52dbad['prototype']['_treeNodePropertiesAfterFullValue']=function(_0x189aeb,_0x1b08df){var _0x257795=_0x33cdcf;this[_0x257795(0x165)](_0x189aeb,_0x1b08df),this[_0x257795(0xf6)](_0x189aeb),_0x1b08df['sortProps']&&this[_0x257795(0x100)](_0x189aeb),this[_0x257795(0xe1)](_0x189aeb,_0x1b08df),this[_0x257795(0xed)](_0x189aeb,_0x1b08df),this[_0x257795(0xa0)](_0x189aeb);},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0xd6)]=function(_0x58a7a0,_0x270782){var _0x3af250=_0x33cdcf;try{_0x58a7a0&&typeof _0x58a7a0['length']==_0x3af250(0x189)&&(_0x270782[_0x3af250(0xc8)]=_0x58a7a0['length']);}catch{}if(_0x270782[_0x3af250(0x13f)]===_0x3af250(0x189)||_0x270782[_0x3af250(0x13f)]===_0x3af250(0x109)){if(isNaN(_0x270782[_0x3af250(0xf2)]))_0x270782['nan']=!0x0,delete _0x270782[_0x3af250(0xf2)];else switch(_0x270782[_0x3af250(0xf2)]){case Number['POSITIVE_INFINITY']:_0x270782[_0x3af250(0xd7)]=!0x0,delete _0x270782['value'];break;case Number['NEGATIVE_INFINITY']:_0x270782[_0x3af250(0xbe)]=!0x0,delete _0x270782['value'];break;case 0x0:this[_0x3af250(0x10b)](_0x270782[_0x3af250(0xf2)])&&(_0x270782[_0x3af250(0xee)]=!0x0);break;}}else _0x270782[_0x3af250(0x13f)]===_0x3af250(0xb6)&&typeof _0x58a7a0[_0x3af250(0x91)]==_0x3af250(0xe6)&&_0x58a7a0['name']&&_0x270782[_0x3af250(0x91)]&&_0x58a7a0[_0x3af250(0x91)]!==_0x270782['name']&&(_0x270782[_0x3af250(0xef)]=_0x58a7a0[_0x3af250(0x91)]);},_0x52dbad['prototype'][_0x33cdcf(0x10b)]=function(_0x543c96){var _0x5aeac0=_0x33cdcf;return 0x1/_0x543c96===Number[_0x5aeac0(0x145)];},_0x52dbad['prototype'][_0x33cdcf(0x100)]=function(_0x4586bf){var _0x40cafe=_0x33cdcf;!_0x4586bf[_0x40cafe(0x133)]||!_0x4586bf[_0x40cafe(0x133)]['length']||_0x4586bf[_0x40cafe(0x13f)]==='array'||_0x4586bf['type']===_0x40cafe(0xe3)||_0x4586bf[_0x40cafe(0x13f)]==='Set'||_0x4586bf['props'][_0x40cafe(0x16c)](function(_0x3dc04a,_0x3ffc88){var _0x390252=_0x40cafe,_0x38fa95=_0x3dc04a['name'][_0x390252(0x183)](),_0x265aaf=_0x3ffc88[_0x390252(0x91)][_0x390252(0x183)]();return _0x38fa95<_0x265aaf?-0x1:_0x38fa95>_0x265aaf?0x1:0x0;});},_0x52dbad['prototype']['_addFunctionsNode']=function(_0x511755,_0x2b0bae){var _0x47b476=_0x33cdcf;if(!(_0x2b0bae['noFunctions']||!_0x511755[_0x47b476(0x133)]||!_0x511755[_0x47b476(0x133)]['length'])){for(var _0x31b4f0=[],_0x1cacf6=[],_0x2c4a6d=0x0,_0x519193=_0x511755[_0x47b476(0x133)][_0x47b476(0xc8)];_0x2c4a6d<_0x519193;_0x2c4a6d++){var _0x38fe52=_0x511755[_0x47b476(0x133)][_0x2c4a6d];_0x38fe52[_0x47b476(0x13f)]===_0x47b476(0xb6)?_0x31b4f0[_0x47b476(0x147)](_0x38fe52):_0x1cacf6[_0x47b476(0x147)](_0x38fe52);}if(!(!_0x1cacf6[_0x47b476(0xc8)]||_0x31b4f0[_0x47b476(0xc8)]<=0x1)){_0x511755[_0x47b476(0x133)]=_0x1cacf6;var _0x33b0c2={'functionsNode':!0x0,'props':_0x31b4f0};this[_0x47b476(0x12f)](_0x33b0c2,_0x2b0bae),this[_0x47b476(0x165)](_0x33b0c2,_0x2b0bae),this['_setNodeExpandableState'](_0x33b0c2),this[_0x47b476(0xe4)](_0x33b0c2,_0x2b0bae),_0x33b0c2['id']+='\\x20f',_0x511755[_0x47b476(0x133)][_0x47b476(0x118)](_0x33b0c2);}}},_0x52dbad[_0x33cdcf(0x142)]['_addLoadNode']=function(_0x392afa,_0x5d5b5c){},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0xf6)]=function(_0x4b9d85){},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0xdc)]=function(_0x5f4b98){var _0x280fba=_0x33cdcf;return Array[_0x280fba(0xfa)](_0x5f4b98)||typeof _0x5f4b98==_0x280fba(0x116)&&this[_0x280fba(0xf1)](_0x5f4b98)===_0x280fba(0x15e);},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0xe4)]=function(_0x23ce84,_0x392c18){},_0x52dbad[_0x33cdcf(0x142)][_0x33cdcf(0xa0)]=function(_0x2d43c9){var _0x2c16ab=_0x33cdcf;delete _0x2d43c9[_0x2c16ab(0x114)],delete _0x2d43c9[_0x2c16ab(0x11b)],delete _0x2d43c9[_0x2c16ab(0x139)];},_0x52dbad[_0x33cdcf(0x142)]['_setNodeExpressionPath']=function(_0x42e683,_0x583752){};let _0x5a6cb0=new _0x52dbad(),_0x52f6ba={'props':_0x1afdbf[_0x33cdcf(0xe8)][_0x33cdcf(0x133)]||0x64,'elements':_0x1afdbf['defaultLimits'][_0x33cdcf(0xb8)]||0x64,'strLength':_0x1afdbf[_0x33cdcf(0xe8)][_0x33cdcf(0x8b)]||0x400*0x32,'totalStrLength':_0x1afdbf['defaultLimits'][_0x33cdcf(0x8e)]||0x400*0x32,'autoExpandLimit':_0x1afdbf[_0x33cdcf(0xe8)][_0x33cdcf(0x92)]||0x1388,'autoExpandMaxDepth':_0x1afdbf['defaultLimits'][_0x33cdcf(0x17d)]||0xa},_0x285333={'props':_0x1afdbf[_0x33cdcf(0xf5)][_0x33cdcf(0x133)]||0x5,'elements':_0x1afdbf[_0x33cdcf(0xf5)][_0x33cdcf(0xb8)]||0x5,'strLength':_0x1afdbf[_0x33cdcf(0xf5)][_0x33cdcf(0x8b)]||0x100,'totalStrLength':_0x1afdbf[_0x33cdcf(0xf5)][_0x33cdcf(0x8e)]||0x100*0x3,'autoExpandLimit':_0x1afdbf[_0x33cdcf(0xf5)][_0x33cdcf(0x92)]||0x1e,'autoExpandMaxDepth':_0x1afdbf[_0x33cdcf(0xf5)][_0x33cdcf(0x17d)]||0x2};if(_0x151665){let _0x36a590=_0x5a6cb0['serialize']['bind'](_0x5a6cb0);_0x5a6cb0[_0x33cdcf(0x162)]=function(_0x1a8500,_0x36477d,_0x2ac83d,_0x4d2739){return _0x36a590(_0x1a8500,_0x151665(_0x36477d),_0x2ac83d,_0x4d2739);};}function _0x587ae6(_0x50fdce,_0x1ccb6f,_0x1ceb31,_0x16e9b3,_0x469370,_0x5a5c3f){var _0x2c2c4e=_0x33cdcf;let _0x4ffc9a,_0x4b7fe5;try{_0x4b7fe5=_0x53963a(),_0x4ffc9a=_0x392343[_0x1ccb6f],!_0x4ffc9a||_0x4b7fe5-_0x4ffc9a['ts']>_0x2c89f8['perLogpoint'][_0x2c2c4e(0x12e)]&&_0x4ffc9a[_0x2c2c4e(0x135)]&&_0x4ffc9a[_0x2c2c4e(0xb4)]/_0x4ffc9a['count']<_0x2c89f8[_0x2c2c4e(0x167)][_0x2c2c4e(0x10c)]?(_0x392343[_0x1ccb6f]=_0x4ffc9a={'count':0x0,'time':0x0,'ts':_0x4b7fe5},_0x392343[_0x2c2c4e(0x86)]={}):_0x4b7fe5-_0x392343[_0x2c2c4e(0x86)]['ts']>_0x2c89f8[_0x2c2c4e(0x163)][_0x2c2c4e(0x12e)]&&_0x392343[_0x2c2c4e(0x86)]['count']&&_0x392343[_0x2c2c4e(0x86)]['time']/_0x392343[_0x2c2c4e(0x86)][_0x2c2c4e(0x135)]<_0x2c89f8[_0x2c2c4e(0x163)][_0x2c2c4e(0x10c)]&&(_0x392343['hits']={});let _0x307aaa=[],_0x46c5ae=_0x4ffc9a['reduceLimits']||_0x392343[_0x2c2c4e(0x86)][_0x2c2c4e(0x111)]?_0x285333:_0x52f6ba,_0x1bb59f=_0x335310=>{var _0x554bbd=_0x2c2c4e;let _0xf0ff1e={};return _0xf0ff1e[_0x554bbd(0x133)]=_0x335310[_0x554bbd(0x133)],_0xf0ff1e[_0x554bbd(0xb8)]=_0x335310[_0x554bbd(0xb8)],_0xf0ff1e[_0x554bbd(0x8b)]=_0x335310[_0x554bbd(0x8b)],_0xf0ff1e[_0x554bbd(0x8e)]=_0x335310[_0x554bbd(0x8e)],_0xf0ff1e['autoExpandLimit']=_0x335310[_0x554bbd(0x92)],_0xf0ff1e[_0x554bbd(0x17d)]=_0x335310['autoExpandMaxDepth'],_0xf0ff1e['sortProps']=!0x1,_0xf0ff1e[_0x554bbd(0x90)]=!_0x93f561,_0xf0ff1e['depth']=0x1,_0xf0ff1e[_0x554bbd(0xce)]=0x0,_0xf0ff1e[_0x554bbd(0xab)]=_0x554bbd(0x88),_0xf0ff1e['rootExpression']='root_exp',_0xf0ff1e[_0x554bbd(0x176)]=!0x0,_0xf0ff1e[_0x554bbd(0x144)]=[],_0xf0ff1e[_0x554bbd(0x138)]=0x0,_0xf0ff1e[_0x554bbd(0x137)]=_0x1afdbf[_0x554bbd(0x137)],_0xf0ff1e[_0x554bbd(0x186)]=0x0,_0xf0ff1e[_0x554bbd(0x14e)]={'current':void 0x0,'parent':void 0x0,'index':0x0},_0xf0ff1e;};for(var _0x48ed03=0x0;_0x48ed03<_0x469370[_0x2c2c4e(0xc8)];_0x48ed03++)_0x307aaa['push'](_0x5a6cb0['serialize']({'timeNode':_0x50fdce==='time'||void 0x0},_0x469370[_0x48ed03],_0x1bb59f(_0x46c5ae),{}));if(_0x50fdce===_0x2c2c4e(0xf8)||_0x50fdce===_0x2c2c4e(0xd2)){let _0x54b128=Error[_0x2c2c4e(0x181)];try{Error[_0x2c2c4e(0x181)]=0x1/0x0,_0x307aaa[_0x2c2c4e(0x147)](_0x5a6cb0[_0x2c2c4e(0x162)]({'stackNode':!0x0},new Error()[_0x2c2c4e(0xde)],_0x1bb59f(_0x46c5ae),{'strLength':0x1/0x0}));}finally{Error['stackTraceLimit']=_0x54b128;}}return{'method':_0x2c2c4e(0xa7),'version':_0x24223d,'args':[{'ts':_0x1ceb31,'session':_0x16e9b3,'args':_0x307aaa,'id':_0x1ccb6f,'context':_0x5a5c3f}]};}catch(_0x1368d2){return{'method':_0x2c2c4e(0xa7),'version':_0x24223d,'args':[{'ts':_0x1ceb31,'session':_0x16e9b3,'args':[{'type':'unknown','error':_0x1368d2&&_0x1368d2[_0x2c2c4e(0x15c)]}],'id':_0x1ccb6f,'context':_0x5a5c3f}]};}finally{try{if(_0x4ffc9a&&_0x4b7fe5){let _0x3060d6=_0x53963a();_0x4ffc9a[_0x2c2c4e(0x135)]++,_0x4ffc9a[_0x2c2c4e(0xb4)]+=_0x385497(_0x4b7fe5,_0x3060d6),_0x4ffc9a['ts']=_0x3060d6,_0x392343['hits'][_0x2c2c4e(0x135)]++,_0x392343[_0x2c2c4e(0x86)][_0x2c2c4e(0xb4)]+=_0x385497(_0x4b7fe5,_0x3060d6),_0x392343[_0x2c2c4e(0x86)]['ts']=_0x3060d6,(_0x4ffc9a[_0x2c2c4e(0x135)]>_0x2c89f8[_0x2c2c4e(0x167)][_0x2c2c4e(0xa6)]||_0x4ffc9a[_0x2c2c4e(0xb4)]>_0x2c89f8[_0x2c2c4e(0x167)]['reduceOnAccumulatedProcessingTimeMs'])&&(_0x4ffc9a[_0x2c2c4e(0x111)]=!0x0),(_0x392343[_0x2c2c4e(0x86)][_0x2c2c4e(0x135)]>_0x2c89f8[_0x2c2c4e(0x163)][_0x2c2c4e(0xa6)]||_0x392343[_0x2c2c4e(0x86)]['time']>_0x2c89f8[_0x2c2c4e(0x163)][_0x2c2c4e(0x8f)])&&(_0x392343[_0x2c2c4e(0x86)][_0x2c2c4e(0x111)]=!0x0);}}catch{}}}return _0x587ae6;}function G(_0x43cdbb){var _0x51d79c=_0x1c2cbf;if(_0x43cdbb&&typeof _0x43cdbb=='object'&&_0x43cdbb[_0x51d79c(0x11c)])switch(_0x43cdbb[_0x51d79c(0x11c)][_0x51d79c(0x91)]){case _0x51d79c(0xdb):return _0x43cdbb['hasOwnProperty'](Symbol[_0x51d79c(0xbf)])?Promise[_0x51d79c(0x125)]():_0x43cdbb;case _0x51d79c(0xba):return Promise[_0x51d79c(0x125)]();}return _0x43cdbb;}((_0x449669,_0x3d3421,_0x3537bc,_0x778a8d,_0x506f33,_0x2a2945,_0x4c4e5c,_0x50a3a1,_0x8302f4,_0x32c564,_0x14a3de,_0x5afc86)=>{var _0x3e4e92=_0x1c2cbf;if(_0x449669['_console_ninja'])return _0x449669[_0x3e4e92(0x178)];let _0x56bc24={'consoleLog':()=>{},'consoleTrace':()=>{},'consoleTime':()=>{},'consoleTimeEnd':()=>{},'autoLog':()=>{},'autoLogMany':()=>{},'autoTraceMany':()=>{},'coverage':()=>{},'autoTrace':()=>{},'autoTime':()=>{},'autoTimeEnd':()=>{}};if(!X(_0x449669,_0x50a3a1,_0x506f33))return _0x449669[_0x3e4e92(0x178)]=_0x56bc24,_0x449669['_console_ninja'];let _0x565127=b(_0x449669),_0x45ff2b=_0x565127['elapsed'],_0x48347f=_0x565127['timeStamp'],_0x4b5b5e=_0x565127[_0x3e4e92(0x182)],_0xf3058e={'hits':{},'ts':{}},_0x277c6f=J(_0x449669,_0x8302f4,_0xf3058e,_0x2a2945,_0x5afc86,_0x506f33===_0x3e4e92(0xca)?G:void 0x0),_0x4411e9=(_0x59f3ae,_0x679952,_0x13f8d6,_0x41a157,_0x26ce19,_0x53c9b3)=>{var _0x302eaa=_0x3e4e92;let _0xe261d=_0x449669['_console_ninja'];try{return _0x449669[_0x302eaa(0x178)]=_0x56bc24,_0x277c6f(_0x59f3ae,_0x679952,_0x13f8d6,_0x41a157,_0x26ce19,_0x53c9b3);}finally{_0x449669[_0x302eaa(0x178)]=_0xe261d;}},_0x273781=_0x4b672b=>{_0xf3058e['ts'][_0x4b672b]=_0x48347f();},_0x178977=(_0x1eaded,_0x568425)=>{let _0x4794dc=_0xf3058e['ts'][_0x568425];if(delete _0xf3058e['ts'][_0x568425],_0x4794dc){let _0x5a5961=_0x45ff2b(_0x4794dc,_0x48347f());_0x1ac160(_0x4411e9('time',_0x1eaded,_0x4b5b5e(),_0x65c1ab,[_0x5a5961],_0x568425));}},_0x2cff89=_0x44b23f=>{var _0x31cfd8=_0x3e4e92,_0x40aa4e;return _0x506f33===_0x31cfd8(0xca)&&_0x449669['origin']&&((_0x40aa4e=_0x44b23f==null?void 0x0:_0x44b23f[_0x31cfd8(0x17c)])==null?void 0x0:_0x40aa4e[_0x31cfd8(0xc8)])&&(_0x44b23f[_0x31cfd8(0x17c)][0x0][_0x31cfd8(0x127)]=_0x449669[_0x31cfd8(0x127)]),_0x44b23f;};_0x449669[_0x3e4e92(0x178)]={'consoleLog':(_0x3cf21b,_0x3629f6)=>{var _0x3ecb77=_0x3e4e92;_0x449669[_0x3ecb77(0x9a)][_0x3ecb77(0xa7)][_0x3ecb77(0x91)]!=='disabledLog'&&_0x1ac160(_0x4411e9(_0x3ecb77(0xa7),_0x3cf21b,_0x4b5b5e(),_0x65c1ab,_0x3629f6));},'consoleTrace':(_0x136d52,_0xb13bbd)=>{var _0x247847=_0x3e4e92,_0x124bd5,_0xa9bf3d;_0x449669[_0x247847(0x9a)][_0x247847(0xa7)][_0x247847(0x91)]!=='disabledTrace'&&((_0xa9bf3d=(_0x124bd5=_0x449669[_0x247847(0xcf)])==null?void 0x0:_0x124bd5[_0x247847(0xc7)])!=null&&_0xa9bf3d['node']&&(_0x449669[_0x247847(0x193)]=!0x0),_0x1ac160(_0x2cff89(_0x4411e9(_0x247847(0xf8),_0x136d52,_0x4b5b5e(),_0x65c1ab,_0xb13bbd))));},'consoleError':(_0x36bb6c,_0x35c991)=>{var _0x230ba0=_0x3e4e92;_0x449669[_0x230ba0(0x193)]=!0x0,_0x1ac160(_0x2cff89(_0x4411e9('error',_0x36bb6c,_0x4b5b5e(),_0x65c1ab,_0x35c991)));},'consoleTime':_0x5bd52d=>{_0x273781(_0x5bd52d);},'consoleTimeEnd':(_0x5b09c6,_0x46c521)=>{_0x178977(_0x46c521,_0x5b09c6);},'autoLog':(_0x1b2c62,_0x19a62c)=>{var _0x30e40f=_0x3e4e92;_0x1ac160(_0x4411e9(_0x30e40f(0xa7),_0x19a62c,_0x4b5b5e(),_0x65c1ab,[_0x1b2c62]));},'autoLogMany':(_0x5a35e5,_0x4d04ff)=>{var _0x3d463a=_0x3e4e92;_0x1ac160(_0x4411e9(_0x3d463a(0xa7),_0x5a35e5,_0x4b5b5e(),_0x65c1ab,_0x4d04ff));},'autoTrace':(_0x5a6d73,_0x2151b2)=>{var _0x1b012f=_0x3e4e92;_0x1ac160(_0x2cff89(_0x4411e9(_0x1b012f(0xf8),_0x2151b2,_0x4b5b5e(),_0x65c1ab,[_0x5a6d73])));},'autoTraceMany':(_0x5833c1,_0x22f672)=>{_0x1ac160(_0x2cff89(_0x4411e9('trace',_0x5833c1,_0x4b5b5e(),_0x65c1ab,_0x22f672)));},'autoTime':(_0x164239,_0x59bb03,_0x5cee84)=>{_0x273781(_0x5cee84);},'autoTimeEnd':(_0x499d1f,_0x2d7bc4,_0x584e4c)=>{_0x178977(_0x2d7bc4,_0x584e4c);},'coverage':_0x5e7cb3=>{var _0x231250=_0x3e4e92;_0x1ac160({'method':_0x231250(0x18b),'version':_0x2a2945,'args':[{'id':_0x5e7cb3}]});}};let _0x1ac160=H(_0x449669,_0x3d3421,_0x3537bc,_0x778a8d,_0x506f33,_0x32c564,_0x14a3de),_0x65c1ab=_0x449669['_console_ninja_session'];return _0x449669['_console_ninja'];})(globalThis,_0x1c2cbf(0x110),_0x1c2cbf(0xa4),_0x1c2cbf(0x16e),_0x1c2cbf(0xd5),_0x1c2cbf(0x98),_0x1c2cbf(0x17f),["localhost","127.0.0.1","example.cypress.io","10.0.2.2","Carlos","192.168.3.62","172.30.224.1"],_0x1c2cbf(0x170),_0x1c2cbf(0x126),_0x1c2cbf(0x101),_0x1c2cbf(0x175));`);
  } catch (e) {
    console.error(e);
  }
}
function oo_tx(i, ...v) {
  try {
    oo_cm().consoleError(i, v);
  } catch (e) {
  }
  return v;
}
//# sourceMappingURL=main.js.map
