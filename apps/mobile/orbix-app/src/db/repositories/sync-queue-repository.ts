/**
 * SyncQueueRepository — durable log of local mutations awaiting a future push to
 * the backend. Single responsibility: register/read pending operations.
 *
 * Each entry records: localId, operationType, payload, createdAt, status.
 * The sync worker that drains this queue is intentionally NOT implemented yet.
 */
import { getDatabase } from '../database';
import { TABLES } from '../schema';
import { newId, nowIso } from '../ids';
import {
  entityTypeFor,
  type SyncOperationType,
  type SyncQueueEntry,
  type SyncQueueRow,
  type SyncStatus,
} from '../types';

export interface EnqueueInput {
  /** Local primary key of the affected order/item. */
  localId: string;
  operationType: SyncOperationType;
  /** Serializable snapshot of the change. */
  payload?: unknown;
}

type SQLiteParam = string | number | null;

function mapRow(row: SyncQueueRow): SyncQueueEntry {
  return {
    id: row.id,
    localId: row.entity_id,
    operationType: row.operation,
    entityType: row.entity_type,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

export class SyncQueueRepository {
  /** Append a pending operation. `payload` is JSON-serialized when provided. */
  async enqueue(input: EnqueueInput): Promise<SyncQueueEntry> {
    const db = await getDatabase();
    const entry: SyncQueueEntry = {
      id: newId(),
      localId: input.localId,
      operationType: input.operationType,
      entityType: entityTypeFor(input.operationType),
      payload: input.payload === undefined ? null : JSON.stringify(input.payload),
      status: 'PENDING',
      attempts: 0,
      lastError: null,
      createdAt: nowIso(),
    };
    await db.runAsync(
      `INSERT INTO ${TABLES.syncQueue}
        (id, entity_type, entity_id, operation, payload, status, attempts, last_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id, entry.entityType, entry.localId, entry.operationType, entry.payload,
        entry.status, entry.attempts, entry.lastError, entry.createdAt,
      ],
    );
    return entry;
  }

  /** Oldest-first pending entries, ready for a future worker to process. */
  async findPending(limit = 50): Promise<SyncQueueEntry[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<SyncQueueRow>(
      `SELECT * FROM ${TABLES.syncQueue} WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT ?`,
      [limit],
    );
    return rows.map(mapRow);
  }

  async findAll(): Promise<SyncQueueEntry[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<SyncQueueRow>(
      `SELECT * FROM ${TABLES.syncQueue} ORDER BY created_at ASC`);
    return rows.map(mapRow);
  }

  async setStatus(id: string, status: SyncStatus, lastError?: string | null): Promise<void> {
    const db = await getDatabase();
    const values: SQLiteParam[] = [status, lastError ?? null, id];
    await db.runAsync(
      `UPDATE ${TABLES.syncQueue} SET status = ?, last_error = ? WHERE id = ?`, values);
  }

  async incrementAttempts(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE ${TABLES.syncQueue} SET attempts = attempts + 1 WHERE id = ?`, [id]);
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM ${TABLES.syncQueue} WHERE id = ?`, [id]);
  }

  /** Remove completed entries to keep the queue small. */
  async clearDone(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM ${TABLES.syncQueue} WHERE status = 'DONE'`);
  }

  async pendingCount(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM ${TABLES.syncQueue} WHERE status = 'PENDING'`);
    return row?.c ?? 0;
  }
}

export const syncQueueRepository = new SyncQueueRepository();
