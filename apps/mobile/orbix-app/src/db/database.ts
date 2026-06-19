/**
 * SQLite connection bootstrap. Opens a single shared database, applies the
 * schema once, and hands the handle to repositories.
 *
 * Responsibility: configure SQLite. No syncing, no backend access.
 */
import * as SQLite from 'expo-sqlite';

import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';

const DATABASE_NAME = 'orbix.db';

// Cache the open+migrate promise so concurrent callers share one connection.
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await migrate(db);
  return db;
}

/** Apply the schema and record the version via `user_version`. Idempotent. */
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

/** Returns the shared, migrated database handle (lazily opened once). */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

/**
 * Eager initialization hook — call once at startup to surface DB errors early.
 * Safe to call multiple times.
 */
export async function initDatabase(): Promise<void> {
  await getDatabase();
}

/** Testing/maintenance: close and forget the connection. */
export async function closeDatabase(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.closeAsync();
  dbPromise = null;
}
