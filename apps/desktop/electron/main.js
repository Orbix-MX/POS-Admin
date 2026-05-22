import { app, BrowserWindow, ipcMain, shell, nativeTheme, safeStorage, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { getDb, initDb } from './db';
import { syncPendingSales, syncPendingCashMovements, cacheProducts, cacheCustomers } from './sync';
import { printTicket, printPdf } from './printer';
// ── Window ────────────────────────────────────────────────────────────────────
let mainWindow = null;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 600,
        show: false,
        titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
        autoHideMenuBar: true,
        backgroundColor: nativeTheme.shouldUseDarkColors ? '#09090b' : '#ffffff',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
    });
    if (process.env['VITE_DEV_SERVER_URL']) {
        mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
    initDb();
    createWindow();
    setupIpcHandlers();
    setupAutoUpdater();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});
// ── IPC Handlers ──────────────────────────────────────────────────────────────
function setupIpcHandlers() {
    const db = getDb();
    // ── App ──
    ipcMain.handle('app:version', () => app.getVersion());
    ipcMain.handle('app:platform', () => process.platform);
    // ── Secure Storage (JWT) ──
    ipcMain.handle('storage:set', (_e, key, value) => {
        if (!safeStorage.isEncryptionAvailable()) {
            // Fallback: store as-is (dev environments without keychain)
            db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(key, value);
            return;
        }
        const encrypted = safeStorage.encryptString(value).toString('base64');
        db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(key, encrypted);
    });
    ipcMain.handle('storage:get', (_e, key) => {
        const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
        if (!row)
            return null;
        if (!safeStorage.isEncryptionAvailable())
            return row.value;
        try {
            return safeStorage.decryptString(Buffer.from(row.value, 'base64'));
        }
        catch {
            return row.value;
        }
    });
    ipcMain.handle('storage:delete', (_e, key) => {
        db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
    });
    // ── DB: Products cache ──
    ipcMain.handle('db:products:get', () => {
        return db.prepare('SELECT * FROM products_cache WHERE status = ? ORDER BY name ASC').all('ACTIVE');
    });
    ipcMain.handle('db:products:cache', (_e, products) => {
        cacheProducts(db, products);
        return { ok: true };
    });
    // ── DB: Customers cache ──
    ipcMain.handle('db:customers:get', () => {
        return db.prepare('SELECT * FROM customers_cache ORDER BY first_name ASC').all();
    });
    ipcMain.handle('db:customers:cache', (_e, customers) => {
        cacheCustomers(db, customers);
        return { ok: true };
    });
    // ── DB: Pending sales ──
    ipcMain.handle('db:sales:save-pending', (_e, sale) => {
        const s = sale;
        db.prepare(`
      INSERT INTO pending_sales
        (id, tenant_id, branch_id, user_id, client_id, items, subtotal, discount, tax, total,
         payment_method, payment_amount, change_amount, notes, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(s.id, s.tenantId, s.branchId, s.userId, s.clientId, JSON.stringify(s.items), s.subtotal, s.discount, s.tax, s.total, s.paymentMethod, s.paymentAmount, s.changeAmount, s.notes, Date.now());
        return { ok: true };
    });
    ipcMain.handle('db:sales:get-pending', () => {
        return db.prepare("SELECT * FROM pending_sales WHERE status = 'pending' ORDER BY created_at ASC").all();
    });
    ipcMain.handle('db:sales:count-pending', () => {
        const row = db.prepare("SELECT COUNT(*) as n FROM pending_sales WHERE status = 'pending'").get();
        return row.n;
    });
    // ── DB: Pending cash movements ──
    ipcMain.handle('db:cash:save-pending', (_e, movement) => {
        const m = movement;
        db.prepare(`
      INSERT INTO pending_cash_movements
        (id, tenant_id, branch_id, session_id, type, amount, concept, notes, user_id, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(m.id, m.tenantId, m.branchId, m.sessionId, m.type, m.amount, m.concept, m.notes, m.userId, Date.now());
        return { ok: true };
    });
    // ── Sync ──
    ipcMain.handle('sync:run', async (_e, opts) => {
        const { apiBase, token } = opts;
        try {
            const salesResult = await syncPendingSales(db, apiBase, token);
            const cashResult = await syncPendingCashMovements(db, apiBase, token);
            const now = Date.now();
            db.prepare('INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES (?, ?, ?)')
                .run('last_sync', now.toString(), now);
            return { ok: true, ...salesResult, cashSynced: cashResult.synced, cashErrors: cashResult.errors };
        }
        catch (err) {
            return { ok: false, error: String(err) };
        }
    });
    ipcMain.handle('sync:last-time', () => {
        const row = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'").get();
        return row ? parseInt(row.value) : null;
    });
    // ── Print ──
    ipcMain.handle('print:ticket', async (_e, data) => {
        try {
            await printTicket(mainWindow, data);
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: String(err) };
        }
    });
    ipcMain.handle('print:pdf', async (_e, opts) => {
        try {
            const pdfPath = await printPdf(mainWindow, opts);
            return { ok: true, path: pdfPath };
        }
        catch (err) {
            return { ok: false, error: String(err) };
        }
    });
    ipcMain.handle('print:printers', async () => {
        if (!mainWindow)
            return [];
        return mainWindow.webContents.getPrintersAsync();
    });
    // ── Dialog ──
    ipcMain.handle('dialog:save', async (_e, opts) => {
        const result = await dialog.showSaveDialog(mainWindow, opts);
        return result;
    });
}
// ── Auto updater ──────────────────────────────────────────────────────────────
function setupAutoUpdater() {
    if (process.env.NODE_ENV === 'development')
        return;
    autoUpdater.autoDownload = false;
    autoUpdater.logger = null;
    autoUpdater.on('update-available', (info) => {
        mainWindow?.webContents.send('updater:available', info);
    });
    autoUpdater.on('download-progress', (progress) => {
        mainWindow?.webContents.send('updater:progress', progress);
    });
    autoUpdater.on('update-downloaded', () => {
        mainWindow?.webContents.send('updater:ready');
    });
    ipcMain.handle('updater:check', async () => {
        try {
            await autoUpdater.checkForUpdates();
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: String(err) };
        }
    });
    ipcMain.handle('updater:download', () => {
        autoUpdater.downloadUpdate();
    });
    ipcMain.handle('updater:install', () => {
        autoUpdater.quitAndInstall();
    });
    // Check on startup (delay to avoid slowing app launch)
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => { }), 10_000);
}
