import { app as E, dialog as f, BrowserWindow as N, ipcMain as o, safeStorage as L, nativeTheme as A, shell as w } from "electron";
import U from "electron-updater";
import g from "path";
import { fileURLToPath as b } from "url";
import O from "better-sqlite3";
import S from "fs";
let h;
function I() {
  if (!h)
    throw new Error("DB not initialized — call initDb() first");
  return h;
}
function v() {
  const e = g.join(E.getPath("userData"), "orbix-pos.db");
  h = new O(e), h.pragma("journal_mode = WAL"), h.pragma("foreign_keys = ON"), C(h);
}
function C(e) {
  e.exec(`
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
function D(e, r) {
  e.prepare("UPDATE pending_sales SET status = 'synced', synced_at = ? WHERE id = ?").run(Date.now(), r);
}
function k(e, r, a) {
  e.prepare("UPDATE pending_sales SET status = 'error', sync_error = ? WHERE id = ?").run(a, r);
}
function P(e, r) {
  e.prepare("UPDATE pending_cash_movements SET status = 'synced', synced_at = ? WHERE id = ?").run(Date.now(), r);
}
function x(e, r, a) {
  e.prepare("UPDATE pending_cash_movements SET status = 'error', sync_error = ? WHERE id = ?").run(a, r);
}
function X(e, r) {
  const a = e.prepare(`
    INSERT OR REPLACE INTO products_cache
      (id, sku, name, price, cost_price, stock, category_id, category_name, status,
       track_inventory, low_stock_alert, tax_rate, tax_code, image_url, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `), n = Date.now();
  e.transaction((l) => {
    for (const t of l) {
      const c = Array.isArray(t.images) ? t.images : [], d = c.find((m) => m.isPrimary) ?? c[0];
      a.run(t.id, t.sku, t.name, t.price, t.costPrice ?? 0, t.stock ?? 0, t.categoryId ?? null, typeof t.category == "object" && t.category !== null ? t.category.name : null, t.status ?? "ACTIVE", t.trackInventory ? 1 : 0, t.lowStockAlert ?? 10, t.taxRate ?? 0, t.taxCode ?? "", (d == null ? void 0 : d.url) ?? null, n);
    }
  })(r);
}
function $(e, r) {
  const a = e.prepare(`
    INSERT OR REPLACE INTO customers_cache
      (id, email, first_name, last_name, phone, status, type, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `), n = Date.now();
  e.transaction((l) => {
    for (const t of l)
      a.run(t.id, t.email ?? null, t.firstName, t.lastName, t.phone ?? null, t.status ?? "ACTIVE", t.type ?? "NEW", n);
  })(r);
}
async function F(e, r, a) {
  const n = e.prepare("SELECT * FROM pending_sales WHERE status = 'pending' ORDER BY created_at ASC").all();
  let i = 0, l = 0;
  for (const t of n)
    try {
      e.prepare("UPDATE pending_sales SET status = 'syncing' WHERE id = ?").run(t.id);
      const c = JSON.parse(t.items), d = {
        offlineId: t.id,
        clienteId: t.client_id ?? null,
        items: c,
        subtotal: t.subtotal,
        descuentos: t.discount,
        tax: t.tax,
        total: t.total,
        metodoPago: t.payment_method,
        pagoCon: t.payment_amount,
        cambio: t.change_amount,
        notas: t.notes ?? null
      }, m = await fetch(`${r}/pos/ventas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${a}`
        },
        body: JSON.stringify(d),
        signal: AbortSignal.timeout(15e3)
      });
      if (!m.ok) {
        const R = await m.text().catch(() => m.statusText);
        throw new Error(`HTTP ${m.status}: ${R}`);
      }
      D(e, t.id), i++;
    } catch (c) {
      k(e, t.id, String(c)), l++;
    }
  return { synced: i, errors: l };
}
async function M(e, r, a) {
  const n = e.prepare("SELECT * FROM pending_cash_movements WHERE status = 'pending' ORDER BY created_at ASC").all();
  let i = 0, l = 0;
  for (const t of n)
    try {
      e.prepare("UPDATE pending_cash_movements SET status = 'syncing' WHERE id = ?").run(t.id);
      const c = await fetch(`${r}/cash-sessions/${t.session_id}/movements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${a}`
        },
        body: JSON.stringify({
          offlineId: t.id,
          type: t.type,
          amount: t.amount,
          concept: t.concept,
          notes: t.notes ?? null
        }),
        signal: AbortSignal.timeout(1e4)
      });
      if (!c.ok) {
        const d = await c.text().catch(() => c.statusText);
        throw new Error(`HTTP ${c.status}: ${d}`);
      }
      P(e, t.id), i++;
    } catch (c) {
      x(e, t.id, String(c)), l++;
    }
  return { synced: i, errors: l };
}
async function B(e, r) {
  const a = H(r);
  return new Promise((n, i) => {
    const { BrowserWindow: l } = require("electron"), t = new l({
      show: !1,
      webPreferences: { nodeIntegration: !1, contextIsolation: !0 }
    });
    t.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(a)}`), t.webContents.once("did-finish-load", () => {
      t.webContents.print({
        silent: !0,
        printBackground: !0,
        margins: { marginType: "none" }
      }, (c, d) => {
        t.close(), c ? n() : i(new Error(d ?? "Print failed"));
      });
    });
  });
}
async function W(e, r) {
  const { filePath: a } = await f.showSaveDialog(e, {
    title: "Guardar PDF",
    defaultPath: g.join(E.getPath("documents"), `${r.title}.pdf`),
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (!a)
    throw new Error("Cancelled");
  const { BrowserWindow: n } = require("electron"), i = new n({
    show: !1,
    webPreferences: { nodeIntegration: !1, contextIsolation: !0 }
  });
  await i.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(r.html)}`);
  const l = await i.webContents.printToPDF({
    printBackground: !0,
    pageSize: "A4"
  });
  return i.close(), S.writeFileSync(a, l), a;
}
function p(e) {
  return e.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function H(e) {
  const r = e.items.map((a) => `
    <tr>
      <td>${T(a.nombre)}</td>
      <td style="text-align:center">${a.qty}</td>
      <td style="text-align:right">$${p(a.precio)}</td>
      <td style="text-align:right">$${p(a.total)}</td>
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
  <h1>${T(e.sucursal)}</h1>
  <p class="center">Folio: ${T(e.folio)}</p>
  <p class="center">${T(e.fecha)}</p>
  <p class="center">Cajero: ${T(e.cajero)}</p>
  ${e.cliente ? `<p class="center">Cliente: ${T(e.cliente)}</p>` : ""}
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th>Artículo</th><th style="text-align:center">Cant</th>
        <th style="text-align:right">Precio</th><th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${r}</tbody>
  </table>
  <div class="divider"></div>
  <table class="totals">
    <tr><td class="label">Subtotal</td><td class="value">$${p(e.subtotal)}</td></tr>
    ${e.descuento > 0 ? `<tr><td class="label">Descuento</td><td class="value">-$${p(e.descuento)}</td></tr>` : ""}
    ${e.impuesto > 0 ? `<tr><td class="label">Impuesto</td><td class="value">$${p(e.impuesto)}</td></tr>` : ""}
    <tr class="grand-total">
      <td class="label">TOTAL</td><td class="value">$${p(e.total)}</td>
    </tr>
    <tr><td class="label">Pago (${T(e.metodoPago)})</td><td class="value">$${p(e.cambio + e.total)}</td></tr>
    ${e.cambio > 0 ? `<tr><td class="label">Cambio</td><td class="value">$${p(e.cambio)}</td></tr>` : ""}
  </table>
  <div class="divider"></div>
  <p class="center">¡Gracias por su compra!</p>
</body>
</html>`;
}
function T(e) {
  return String(e ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const { autoUpdater: u } = U, V = b(import.meta.url), _ = g.dirname(V);
let s = null;
function y() {
  s = new N({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: !1,
    titleBarStyle: process.platform === "darwin" ? "hidden" : "default",
    autoHideMenuBar: !0,
    backgroundColor: A.shouldUseDarkColors ? "#09090b" : "#ffffff",
    webPreferences: {
      preload: g.join(_, "preload.cjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      sandbox: !1
    }
  }), process.env.VITE_DEV_SERVER_URL ? (s.loadURL(process.env.VITE_DEV_SERVER_URL), s.webContents.openDevTools()) : s.loadFile(g.join(_, "../dist/index.html")), s.once("ready-to-show", () => {
    s.show(), s.webContents.openDevTools();
  }), s.webContents.setWindowOpenHandler(({ url: e }) => (w.openExternal(e), { action: "deny" })), s.on("closed", () => {
    s = null;
  });
}
E.whenReady().then(() => {
  v(), y(), Y(), j(), E.on("activate", () => {
    N.getAllWindows().length === 0 && y();
  });
});
E.on("window-all-closed", () => {
  process.platform !== "darwin" && E.quit();
});
function Y() {
  const e = I();
  o.handle("app:version", () => E.getVersion()), o.handle("app:platform", () => process.platform), o.handle("storage:set", (r, a, n) => {
    if (!L.isEncryptionAvailable()) {
      e.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").run(a, n);
      return;
    }
    const i = L.encryptString(n).toString("base64");
    e.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").run(a, i);
  }), o.handle("storage:get", (r, a) => {
    const n = e.prepare("SELECT value FROM kv_store WHERE key = ?").get(a);
    if (!n) return null;
    if (!L.isEncryptionAvailable()) return n.value;
    try {
      return L.decryptString(Buffer.from(n.value, "base64"));
    } catch {
      return n.value;
    }
  }), o.handle("storage:delete", (r, a) => {
    e.prepare("DELETE FROM kv_store WHERE key = ?").run(a);
  }), o.handle("db:products:get", () => e.prepare("SELECT * FROM products_cache WHERE status = ? ORDER BY name ASC").all("ACTIVE")), o.handle("db:products:cache", (r, a) => (X(e, a), { ok: !0 })), o.handle("db:customers:get", () => e.prepare("SELECT * FROM customers_cache ORDER BY first_name ASC").all()), o.handle("db:customers:cache", (r, a) => ($(e, a), { ok: !0 })), o.handle("db:sales:save-pending", (r, a) => {
    const n = a;
    return e.prepare(`
      INSERT INTO pending_sales
        (id, tenant_id, branch_id, user_id, client_id, items, subtotal, discount, tax, total,
         payment_method, payment_amount, change_amount, notes, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      n.id,
      n.tenantId,
      n.branchId,
      n.userId,
      n.clientId,
      JSON.stringify(n.items),
      n.subtotal,
      n.discount,
      n.tax,
      n.total,
      n.paymentMethod,
      n.paymentAmount,
      n.changeAmount,
      n.notes,
      Date.now()
    ), { ok: !0 };
  }), o.handle("db:sales:get-pending", () => e.prepare("SELECT * FROM pending_sales WHERE status = 'pending' ORDER BY created_at ASC").all()), o.handle("db:sales:count-pending", () => e.prepare("SELECT COUNT(*) as n FROM pending_sales WHERE status = 'pending'").get().n), o.handle("db:cash:save-pending", (r, a) => {
    const n = a;
    return e.prepare(`
      INSERT INTO pending_cash_movements
        (id, tenant_id, branch_id, session_id, type, amount, concept, notes, user_id, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(n.id, n.tenantId, n.branchId, n.sessionId, n.type, n.amount, n.concept, n.notes, n.userId, Date.now()), { ok: !0 };
  }), o.handle("sync:run", async (r, a) => {
    const { apiBase: n, token: i } = a;
    try {
      const l = await F(e, n, i), t = await M(e, n, i), c = Date.now();
      return e.prepare("INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES (?, ?, ?)").run("last_sync", c.toString(), c), { ok: !0, ...l, cashSynced: t.synced, cashErrors: t.errors };
    } catch (l) {
      return { ok: !1, error: String(l) };
    }
  }), o.handle("sync:last-time", () => {
    const r = e.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'").get();
    return r ? parseInt(r.value) : null;
  }), o.handle("print:ticket", async (r, a) => {
    try {
      return await B(s, a), { ok: !0 };
    } catch (n) {
      return { ok: !1, error: String(n) };
    }
  }), o.handle("print:pdf", async (r, a) => {
    try {
      return { ok: !0, path: await W(s, a) };
    } catch (n) {
      return { ok: !1, error: String(n) };
    }
  }), o.handle("print:printers", async () => s ? s.webContents.getPrintersAsync() : []), o.handle("dialog:save", async (r, a) => await f.showSaveDialog(s, a));
}
function j() {
  process.env.NODE_ENV !== "development" && (u.autoDownload = !1, u.logger = null, u.on("update-available", (e) => {
    s == null || s.webContents.send("updater:available", e);
  }), u.on("download-progress", (e) => {
    s == null || s.webContents.send("updater:progress", e);
  }), u.on("update-downloaded", () => {
    s == null || s.webContents.send("updater:ready");
  }), o.handle("updater:check", async () => {
    try {
      return await u.checkForUpdates(), { ok: !0 };
    } catch (e) {
      return { ok: !1, error: String(e) };
    }
  }), o.handle("updater:download", () => {
    u.downloadUpdate();
  }), o.handle("updater:install", () => {
    u.quitAndInstall();
  }), setTimeout(() => u.checkForUpdates().catch(() => {
  }), 1e4));
}
