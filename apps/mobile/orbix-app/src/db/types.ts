/**
 * Domain shapes for locally persisted rows. Repositories map between these
 * camelCase models and the snake_case SQLite columns.
 */

export type LocalServiceType = 'DINE_IN' | 'COUNTER';

export interface LocalOrder {
  id: string;
  serverId: string | null;
  branchId: string;
  tableId: string | null;
  reference: string | null;
  serviceType: LocalServiceType;
  status: string;
  subtotal: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalOrderItem {
  id: string;
  orderId: string;
  serverId: string | null;
  productId: string | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string | null;
  createdAt: string;
}

/** The mutations the offline layer records, awaiting a future push. */
export type SyncOperationType =
  | 'CREATE_ORDER'
  | 'UPDATE_ORDER'
  | 'ADD_ITEM'
  | 'UPDATE_ITEM'
  | 'DELETE_ITEM';

export type SyncEntityType = 'order' | 'order_item';
export type SyncStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';

/** Which entity an operation acts on (derived from the operation type). */
export function entityTypeFor(op: SyncOperationType): SyncEntityType {
  return op === 'CREATE_ORDER' || op === 'UPDATE_ORDER' ? 'order' : 'order_item';
}

export interface SyncQueueEntry {
  id: string;
  /** Local primary key of the affected row (order or item). */
  localId: string;
  operationType: SyncOperationType;
  entityType: SyncEntityType;
  /** JSON snapshot of the change (serialized). */
  payload: string | null;
  status: SyncStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

// ── Raw row shapes (as returned by SQLite) ───────────────────────────────────
export interface OrderRow {
  id: string;
  server_id: string | null;
  branch_id: string;
  table_id: string | null;
  reference: string | null;
  service_type: LocalServiceType;
  status: string;
  subtotal: number;
  synced: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  server_id: string | null;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  notes: string | null;
  created_at: string;
}

export interface SyncQueueRow {
  id: string;
  entity_type: SyncEntityType;
  entity_id: string;       // localId
  operation: SyncOperationType;
  payload: string | null;
  status: SyncStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
}
