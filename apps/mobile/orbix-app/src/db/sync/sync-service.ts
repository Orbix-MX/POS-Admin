/**
 * Sync worker — drains the local SyncQueue against the backend.
 *
 * Single responsibility: process SyncQueue entries (oldest-first) when on WiFi.
 * For each entry it replays the mutation through the existing dining-orders API,
 * maps localId → serverId, and marks the local row SYNCED.
 *
 * Triggered by SyncManager when connectionType === 'wifi'. Entries are processed
 * in order; a transient failure keeps the entry PENDING and stops the run so the
 * next trigger resumes without breaking dependency order (order before items).
 */
import { orderRepository } from '../repositories/order-repository';
import { orderItemRepository } from '../repositories/order-item-repository';
import { syncQueueRepository } from '../repositories/sync-queue-repository';
import type { SyncQueueEntry } from '../types';
import {
  openDiningOrder, addOrderItem, updateOrderItem, removeOrderItem, changeOrderStatus, fireRound,
  type DiningOrderStatus,
} from '@/services/restaurant-service';

// Estados de "envío" que en el servidor se aplican vía fireRound (marca los
// ítems pendientes como enviados), no como un simple cambio de estado.
const FIRE_STATUSES: DiningOrderStatus[] = ['SENT_TO_KITCHEN', 'READY_FOR_PAYMENT'];
import { getApiErrorMessage } from '@/services/api-client';
import { useSyncStore } from '@/store/sync-store';
import { useDeviceStore } from '@/store/device-store';

// In-process guard so overlapping triggers don't double-process.
let running = false;

// Tras N intentos una entrada pasa a FAILED (dead-letter) para no bloquear la cola.
const MAX_SYNC_ATTEMPTS = 6;

export interface SyncResult {
  processed: number;
  remaining: number;
}

/** Refresh the observable pending count (e.g. after enqueuing offline ops). */
export async function refreshSyncPending(): Promise<number> {
  const count = await syncQueueRepository.pendingCount();
  useSyncStore.getState().setPending(count);
  return count;
}

export async function processSyncQueue(): Promise<SyncResult> {
  const store = useSyncStore.getState();
  if (running) return { processed: 0, remaining: await syncQueueRepository.pendingCount() };
  running = true;
  store.setSyncing(true);
  store.setError(null);
  let processed = 0;
  let failed: string | null = null;
  try {
    const pending = await syncQueueRepository.findPending();
    for (const entry of pending) {
      try {
        await processEntry(entry);
        await syncQueueRepository.setStatus(entry.id, 'DONE');
        processed += 1;
      } catch (e) {
        failed = getApiErrorMessage(e, 'Error de sincronización');
        await syncQueueRepository.incrementAttempts(entry.id);
        const status = httpStatus(e);
        const attempts = entry.attempts + 1;
        // Permanente (4xx no idempotente) o agotó reintentos → dead-letter
        // (FAILED) y CONTINÚA: una entrada envenenada no bloquea el resto.
        const permanent = status !== undefined && status >= 400 && status < 500;
        if (permanent || attempts >= MAX_SYNC_ATTEMPTS) {
          await syncQueueRepository.setStatus(entry.id, 'FAILED', failed);
          continue;
        }
        // Transitorio (offline a media corrida, 5xx, dependencia aún no subida):
        // mantener PENDING y detener para preservar el orden FIFO.
        await syncQueueRepository.setStatus(entry.id, 'PENDING', failed);
        break;
      }
    }
    await syncQueueRepository.clearDone();
  } finally {
    running = false;
    useSyncStore.getState().setSyncing(false);
    useSyncStore.getState().setError(failed);
    await refreshSyncPending();
  }
  return { processed, remaining: await syncQueueRepository.pendingCount() };
}

async function processEntry(entry: SyncQueueEntry): Promise<void> {
  switch (entry.operationType) {
    case 'CREATE_ORDER':
      return createOrder(entry);
    case 'ADD_ITEM':
      return addItem(entry);
    case 'UPDATE_ITEM':
      return updateItem(entry);
    case 'DELETE_ITEM':
      return deleteItem(entry);
    case 'UPDATE_ORDER':
      return updateOrder(entry);
    case 'REMOTE_ADD_ITEM':
      return remoteAddItem(entry);
    case 'REMOTE_UPDATE_ITEM':
      return remoteUpdateItem(entry);
    case 'REMOTE_REMOVE_ITEM':
      return remoteRemoveItem(entry);
    case 'REMOTE_FIRE':
      return remoteFire(entry);
  }
}

/** HTTP status de un error de axios, si lo hay (para idempotencia). */
function httpStatus(e: unknown): number | undefined {
  return (e as { response?: { status?: number } })?.response?.status;
}

// ── REMOTE ops: editan una orden ya sincronizada por serverId ────────────────
// El payload trae todo (ids de servidor/cliente). Idempotentes: un ítem ya
// removido/inexistente (404) o una ronda sin pendientes (400) se consideran
// hechas — no bloquean la cola ni se reintentan en bucle.

async function remoteAddItem(entry: SyncQueueEntry): Promise<void> {
  if (!entry.payload) return;
  const { branchId, orderId, item } = JSON.parse(entry.payload) as {
    branchId: string; orderId: string;
    item: { id: string; productId: string | null; productName: string; unitPrice: number; quantity: number; notes: string | null };
  };
  // addItem es idempotente cuando se envía el id (el backend devuelve la línea
  // existente si ya fue creada en un intento previo).
  await addOrderItem(branchId, orderId, {
    id: item.id,
    productName: item.productName,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    ...(item.productId ? { productId: item.productId } : {}),
    ...(item.notes ? { notes: item.notes } : {}),
  });
}

async function remoteUpdateItem(entry: SyncQueueEntry): Promise<void> {
  if (!entry.payload) return;
  const { branchId, orderId, itemId, quantity, notes } = JSON.parse(entry.payload) as {
    branchId: string; orderId: string; itemId: string; quantity?: number; notes?: string | null;
  };
  try {
    await updateOrderItem(branchId, orderId, itemId, { quantity, notes });
  } catch (e) {
    if (httpStatus(e) === 404) return; // el ítem ya no existe → nada que actualizar
    throw e;
  }
}

async function remoteRemoveItem(entry: SyncQueueEntry): Promise<void> {
  if (!entry.payload) return;
  const { branchId, orderId, itemId } = JSON.parse(entry.payload) as {
    branchId: string; orderId: string; itemId: string;
  };
  try {
    await removeOrderItem(branchId, orderId, itemId);
  } catch (e) {
    if (httpStatus(e) === 404) return; // ya removido
    throw e;
  }
}

async function remoteFire(entry: SyncQueueEntry): Promise<void> {
  if (!entry.payload) return;
  const { branchId, orderId } = JSON.parse(entry.payload) as { branchId: string; orderId: string };
  try {
    await fireRound(branchId, orderId);
  } catch (e) {
    if (httpStatus(e) === 400) return; // sin productos pendientes → ya enviada
    throw e;
  }
}

async function createOrder(entry: SyncQueueEntry): Promise<void> {
  const local = await orderRepository.findById(entry.localId);
  if (!local) return;            // row gone — nothing to sync
  if (local.serverId) return;    // already created on a previous run

  // Mesero = operador actual (mismo dispositivo). Explícito para no depender del
  // fallback del backend al sincronizar órdenes creadas offline.
  const waiterId = useDeviceStore.getState().operator?.employee.id;
  const options = local.serviceType === 'DINE_IN'
    ? { serviceType: 'DINE_IN' as const, tableId: local.tableId ?? '', waiterId }
    : { serviceType: 'COUNTER' as const, reference: local.reference ?? undefined, waiterId };

  const created = await openDiningOrder(local.branchId, options);
  // localId → serverId + SYNCED
  await orderRepository.markSynced(local.id, created.id);
}

async function addItem(entry: SyncQueueEntry): Promise<void> {
  const item = await orderItemRepository.findById(entry.localId);
  if (!item) return;             // removed before it synced
  if (item.serverId) return;     // already pushed

  const order = await orderRepository.findById(item.orderId);
  if (!order?.serverId) throw new Error('La orden aún no se ha sincronizado.');

  const saved = await addOrderItem(order.branchId, order.serverId, {
    productId: item.productId ?? undefined,
    productName: item.productName,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    notes: item.notes ?? undefined,
  });
  await orderItemRepository.update(item.id, { serverId: saved.id });
}

async function updateItem(entry: SyncQueueEntry): Promise<void> {
  const item = await orderItemRepository.findById(entry.localId);
  if (!item?.serverId) return;   // unsynced edits already captured by ADD_ITEM
  const order = await orderRepository.findById(item.orderId);
  if (!order?.serverId) throw new Error('La orden aún no se ha sincronizado.');
  await updateOrderItem(order.branchId, order.serverId, item.serverId, {
    quantity: item.quantity,
    notes: item.notes,
  });
}

async function deleteItem(entry: SyncQueueEntry): Promise<void> {
  const item = await orderItemRepository.findById(entry.localId);
  // Never synced (or row already gone) → nothing to delete on the server.
  if (!item?.serverId) return;
  const order = await orderRepository.findById(item.orderId);
  if (!order?.serverId) throw new Error('La orden aún no se ha sincronizado.');
  await removeOrderItem(order.branchId, order.serverId, item.serverId);
}

async function updateOrder(entry: SyncQueueEntry): Promise<void> {
  const order = await orderRepository.findById(entry.localId);
  if (!order?.serverId) throw new Error('La orden aún no se ha sincronizado.');
  const payload = entry.payload ? (JSON.parse(entry.payload) as { status?: string }) : {};
  if (payload.status) {
    const status = payload.status as DiningOrderStatus;
    if (FIRE_STATUSES.includes(status)) {
      // Envío de ronda: marca los ítems pendientes como enviados en el servidor.
      await fireRound(order.branchId, order.serverId);
    } else {
      await changeOrderStatus(order.branchId, order.serverId, status);
    }
  }
}
