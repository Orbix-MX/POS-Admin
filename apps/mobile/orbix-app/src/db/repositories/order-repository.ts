/**
 * OrderRepository — CRUD for locally persisted orders. Pure persistence; no
 * backend access and no sync logic.
 */
import { getDatabase } from '../database';
import { TABLES } from '../schema';
import { newId, nowIso } from '../ids';
import type { LocalOrder, LocalServiceType, OrderRow } from '../types';

export interface CreateOrderInput {
  branchId: string;
  serviceType: LocalServiceType;
  tableId?: string | null;
  reference?: string | null;
  status?: string;
  subtotal?: number;
  serverId?: string | null;
}

export interface UpdateOrderPatch {
  reference?: string | null;
  status?: string;
  subtotal?: number;
  tableId?: string | null;
  serverId?: string | null;
  synced?: boolean;
}

function mapRow(row: OrderRow): LocalOrder {
  return {
    id: row.id,
    serverId: row.server_id,
    branchId: row.branch_id,
    tableId: row.table_id,
    reference: row.reference,
    serviceType: row.service_type,
    status: row.status,
    subtotal: row.subtotal,
    synced: row.synced === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class OrderRepository {
  async create(input: CreateOrderInput): Promise<LocalOrder> {
    const db = await getDatabase();
    const now = nowIso();
    const order: LocalOrder = {
      id: newId(),
      serverId: input.serverId ?? null,
      branchId: input.branchId,
      tableId: input.tableId ?? null,
      reference: input.reference ?? null,
      serviceType: input.serviceType,
      status: input.status ?? 'OPEN',
      subtotal: input.subtotal ?? 0,
      synced: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.runAsync(
      `INSERT INTO ${TABLES.orders}
        (id, server_id, branch_id, table_id, reference, service_type, status, subtotal, synced, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id, order.serverId, order.branchId, order.tableId, order.reference,
        order.serviceType, order.status, order.subtotal, 0, order.createdAt, order.updatedAt,
      ],
    );
    return order;
  }

  async findById(id: string): Promise<LocalOrder | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<OrderRow>(
      `SELECT * FROM ${TABLES.orders} WHERE id = ?`, [id],
    );
    return row ? mapRow(row) : null;
  }

  async findAll(branchId?: string): Promise<LocalOrder[]> {
    const db = await getDatabase();
    const rows = branchId
      ? await db.getAllAsync<OrderRow>(
          `SELECT * FROM ${TABLES.orders} WHERE branch_id = ? ORDER BY created_at DESC`, [branchId])
      : await db.getAllAsync<OrderRow>(
          `SELECT * FROM ${TABLES.orders} ORDER BY created_at DESC`);
    return rows.map(mapRow);
  }

  /** Orders not yet pushed to the backend (synced = 0). */
  async findUnsynced(): Promise<LocalOrder[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<OrderRow>(
      `SELECT * FROM ${TABLES.orders} WHERE synced = 0 ORDER BY created_at ASC`);
    return rows.map(mapRow);
  }

  async update(id: string, patch: UpdateOrderPatch): Promise<void> {
    const db = await getDatabase();
    const sets: string[] = [];
    const values: SQLiteParam[] = [];

    if (patch.reference !== undefined) { sets.push('reference = ?'); values.push(patch.reference); }
    if (patch.status !== undefined) { sets.push('status = ?'); values.push(patch.status); }
    if (patch.subtotal !== undefined) { sets.push('subtotal = ?'); values.push(patch.subtotal); }
    if (patch.tableId !== undefined) { sets.push('table_id = ?'); values.push(patch.tableId); }
    if (patch.serverId !== undefined) { sets.push('server_id = ?'); values.push(patch.serverId); }
    if (patch.synced !== undefined) { sets.push('synced = ?'); values.push(patch.synced ? 1 : 0); }

    sets.push('updated_at = ?'); values.push(nowIso());
    values.push(id);

    await db.runAsync(`UPDATE ${TABLES.orders} SET ${sets.join(', ')} WHERE id = ?`, values);
  }

  /** Link a local order to its backend id and mark it synced. */
  async markSynced(id: string, serverId: string): Promise<void> {
    await this.update(id, { serverId, synced: true });
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM ${TABLES.orders} WHERE id = ?`, [id]);
  }
}

type SQLiteParam = string | number | null;

export const orderRepository = new OrderRepository();
