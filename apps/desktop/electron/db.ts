import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) throw new Error('DB not initialized — call initDb() first')
  return db
}

export function initDb(): void {
  const dbPath = path.join(app.getPath('userData'), 'orbix-pos.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  applySchema(db)
}

function applySchema(db: Database.Database): void {
  db.exec(`
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
  `)
}

// ── Helpers exportados para sync.ts ──────────────────────────────────────────

export function markSaleSynced(db: Database.Database, id: string): void {
  db.prepare("UPDATE pending_sales SET status = 'synced', synced_at = ? WHERE id = ?")
    .run(Date.now(), id)
}

export function markSaleError(db: Database.Database, id: string, error: string): void {
  db.prepare("UPDATE pending_sales SET status = 'error', sync_error = ? WHERE id = ?")
    .run(error, id)
}

export function markCashMovementSynced(db: Database.Database, id: string): void {
  db.prepare("UPDATE pending_cash_movements SET status = 'synced', synced_at = ? WHERE id = ?")
    .run(Date.now(), id)
}

export function markCashMovementError(db: Database.Database, id: string, error: string): void {
  db.prepare("UPDATE pending_cash_movements SET status = 'error', sync_error = ? WHERE id = ?")
    .run(error, id)
}
