/**
 * Local SQLite schema (DDL) for offline persistence.
 *
 * Mirrors the dining-order domain locally so the app can capture orders without
 * the network. `server_id` links a local row to its backend id once synced.
 *
 * This file ONLY describes the schema. No syncing / backend access lives here.
 */

export const TABLES = {
  orders: 'orders',
  orderItems: 'order_items',
  syncQueue: 'sync_queue',
} as const;

/** Bump when the DDL below changes; `migrate()` runs guarded steps. */
export const SCHEMA_VERSION = 2;

/**
 * Idempotent DDL. Executed inside a single batch on open. `IF NOT EXISTS`
 * everywhere so repeated boots are safe.
 */
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ${TABLES.orders} (
  id           TEXT PRIMARY KEY NOT NULL,
  server_id    TEXT,
  branch_id    TEXT NOT NULL,
  table_id     TEXT,
  reference    TEXT,
  service_type TEXT NOT NULL DEFAULT 'DINE_IN',
  status       TEXT NOT NULL DEFAULT 'OPEN',
  subtotal     REAL NOT NULL DEFAULT 0,
  synced       INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_synced ON ${TABLES.orders}(synced);
CREATE INDEX IF NOT EXISTS idx_orders_server_id ON ${TABLES.orders}(server_id);

CREATE TABLE IF NOT EXISTS ${TABLES.orderItems} (
  id           TEXT PRIMARY KEY NOT NULL,
  order_id     TEXT NOT NULL,
  server_id    TEXT,
  product_id   TEXT,
  product_name TEXT NOT NULL,
  unit_price   REAL NOT NULL DEFAULT 0,
  quantity     INTEGER NOT NULL DEFAULT 1,
  notes        TEXT,
  created_at   TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES ${TABLES.orders}(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON ${TABLES.orderItems}(order_id);

CREATE TABLE IF NOT EXISTS ${TABLES.syncQueue} (
  id               TEXT PRIMARY KEY NOT NULL,
  entity_type      TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  operation        TEXT NOT NULL,
  payload          TEXT,
  status           TEXT NOT NULL DEFAULT 'PENDING',
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  last_attempt_at  TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON ${TABLES.syncQueue}(status);
`;

/**
 * Incremental migrations indexed by target version.
 * Each SQL runs when upgrading an existing DB from version < key.
 * Fresh installs (user_version = 0) skip these — they get the full SCHEMA_SQL.
 */
export const MIGRATIONS: Record<number, string> = {
  2: `ALTER TABLE ${TABLES.syncQueue} ADD COLUMN last_attempt_at TEXT;`,
};
