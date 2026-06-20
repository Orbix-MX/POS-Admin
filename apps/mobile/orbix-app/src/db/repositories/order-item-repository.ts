/**
 * OrderItemRepository — CRUD for locally persisted order items. Pure
 * persistence; no backend access and no sync logic.
 */
import { getDatabase } from '../database';
import { TABLES } from '../schema';
import { newId, nowIso } from '../ids';
import type { LocalOrderItem, OrderItemRow } from '../types';

export interface CreateOrderItemInput {
  orderId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  /** Id explícito (uuid de cliente). Por defecto se genera uno. Permite que la
   *  línea en memoria (React) y la fila SQLite compartan id para edición/borrado. */
  id?: string;
  productId?: string | null;
  notes?: string | null;
  serverId?: string | null;
}

export interface UpdateOrderItemPatch {
  quantity?: number;
  unitPrice?: number;
  notes?: string | null;
  serverId?: string | null;
}

type SQLiteParam = string | number | null;

function mapRow(row: OrderItemRow): LocalOrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    serverId: row.server_id,
    productId: row.product_id,
    productName: row.product_name,
    unitPrice: row.unit_price,
    quantity: row.quantity,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export class OrderItemRepository {
  async create(input: CreateOrderItemInput): Promise<LocalOrderItem> {
    const db = await getDatabase();
    const item: LocalOrderItem = {
      id: input.id ?? newId(),
      orderId: input.orderId,
      serverId: input.serverId ?? null,
      productId: input.productId ?? null,
      productName: input.productName,
      unitPrice: input.unitPrice,
      quantity: input.quantity,
      notes: input.notes ?? null,
      createdAt: nowIso(),
    };
    await db.runAsync(
      `INSERT INTO ${TABLES.orderItems}
        (id, order_id, server_id, product_id, product_name, unit_price, quantity, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id, item.orderId, item.serverId, item.productId, item.productName,
        item.unitPrice, item.quantity, item.notes, item.createdAt,
      ],
    );
    return item;
  }

  async findByOrder(orderId: string): Promise<LocalOrderItem[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<OrderItemRow>(
      `SELECT * FROM ${TABLES.orderItems} WHERE order_id = ? ORDER BY created_at ASC`, [orderId]);
    return rows.map(mapRow);
  }

  async findById(id: string): Promise<LocalOrderItem | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<OrderItemRow>(
      `SELECT * FROM ${TABLES.orderItems} WHERE id = ?`, [id]);
    return row ? mapRow(row) : null;
  }

  async update(id: string, patch: UpdateOrderItemPatch): Promise<void> {
    const db = await getDatabase();
    const sets: string[] = [];
    const values: SQLiteParam[] = [];

    if (patch.quantity !== undefined) { sets.push('quantity = ?'); values.push(patch.quantity); }
    if (patch.unitPrice !== undefined) { sets.push('unit_price = ?'); values.push(patch.unitPrice); }
    if (patch.notes !== undefined) { sets.push('notes = ?'); values.push(patch.notes); }
    if (patch.serverId !== undefined) { sets.push('server_id = ?'); values.push(patch.serverId); }
    if (sets.length === 0) return;

    values.push(id);
    await db.runAsync(`UPDATE ${TABLES.orderItems} SET ${sets.join(', ')} WHERE id = ?`, values);
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM ${TABLES.orderItems} WHERE id = ?`, [id]);
  }

  async deleteByOrder(orderId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM ${TABLES.orderItems} WHERE order_id = ?`, [orderId]);
  }
}

export const orderItemRepository = new OrderItemRepository();
