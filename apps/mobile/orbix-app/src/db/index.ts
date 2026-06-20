/**
 * Local SQLite persistence layer. Configures the database and exposes
 * repositories. No syncing / backend access yet.
 */
export { getDatabase, initDatabase, closeDatabase } from './database';
export { TABLES, SCHEMA_VERSION } from './schema';
export { newId } from './ids';

export { OrderRepository, orderRepository } from './repositories/order-repository';
export type { CreateOrderInput, UpdateOrderPatch } from './repositories/order-repository';

export { OrderItemRepository, orderItemRepository } from './repositories/order-item-repository';
export type { CreateOrderItemInput, UpdateOrderItemPatch } from './repositories/order-item-repository';

export { SyncQueueRepository, syncQueueRepository } from './repositories/sync-queue-repository';
export type { EnqueueInput } from './repositories/sync-queue-repository';

export { LocalOrderService, localOrderService } from './local-order-service';

export { processSyncQueue, refreshSyncPending } from './sync/sync-service';
export type { SyncResult } from './sync/sync-service';

export { entityTypeFor } from './types';
export type {
  LocalOrder, LocalOrderItem, LocalServiceType,
  SyncQueueEntry, SyncEntityType, SyncOperationType, SyncStatus,
} from './types';
