/**
 * LocalOrderService — single entry point for local order mutations.
 *
 * Every important change (create/update order, add/update/delete item) persists
 * via the repositories AND registers a Sync Queue entry, so the change can be
 * pushed to the backend later. Nothing is synced here — only recorded.
 */
import { orderRepository, type CreateOrderInput, type UpdateOrderPatch } from './repositories/order-repository';
import { orderItemRepository, type CreateOrderItemInput, type UpdateOrderItemPatch } from './repositories/order-item-repository';
import { syncQueueRepository } from './repositories/sync-queue-repository';
import type { LocalOrder, LocalOrderItem } from './types';

export class LocalOrderService {
  async createOrder(input: CreateOrderInput): Promise<LocalOrder> {
    const order = await orderRepository.create(input);
    await syncQueueRepository.enqueue({
      localId: order.id,
      operationType: 'CREATE_ORDER',
      payload: order,
    });
    return order;
  }

  async updateOrder(id: string, patch: UpdateOrderPatch): Promise<void> {
    await orderRepository.update(id, patch);
    await syncQueueRepository.enqueue({
      localId: id,
      operationType: 'UPDATE_ORDER',
      payload: { id, ...patch },
    });
  }

  async addItem(input: CreateOrderItemInput): Promise<LocalOrderItem> {
    const item = await orderItemRepository.create(input);
    await syncQueueRepository.enqueue({
      localId: item.id,
      operationType: 'ADD_ITEM',
      payload: item,
    });
    return item;
  }

  async updateItem(id: string, patch: UpdateOrderItemPatch): Promise<void> {
    await orderItemRepository.update(id, patch);
    await syncQueueRepository.enqueue({
      localId: id,
      operationType: 'UPDATE_ITEM',
      payload: { id, ...patch },
    });
  }

  async deleteItem(id: string): Promise<void> {
    await orderItemRepository.delete(id);
    await syncQueueRepository.enqueue({
      localId: id,
      operationType: 'DELETE_ITEM',
      payload: { id },
    });
  }

  // ── Ops sobre órdenes YA sincronizadas (offline) ───────────────────────────
  // No tocan las tablas locales: la cola guarda los ids de servidor/cliente y el
  // worker los reproduce directo contra el API. El id del ítem (uuid de cliente)
  // permite update/remove antes de que el ADD se sincronice.

  async queueRemoteAddItem(p: {
    branchId: string; orderId: string;
    item: { id: string; productId: string | null; productName: string; unitPrice: number; quantity: number; notes: string | null };
  }): Promise<void> {
    await syncQueueRepository.enqueue({ localId: p.orderId, operationType: 'REMOTE_ADD_ITEM', payload: p });
  }

  async queueRemoteUpdateItem(p: {
    branchId: string; orderId: string; itemId: string; quantity?: number; notes?: string | null;
  }): Promise<void> {
    await syncQueueRepository.enqueue({ localId: p.itemId, operationType: 'REMOTE_UPDATE_ITEM', payload: p });
  }

  async queueRemoteRemoveItem(p: { branchId: string; orderId: string; itemId: string }): Promise<void> {
    await syncQueueRepository.enqueue({ localId: p.itemId, operationType: 'REMOTE_REMOVE_ITEM', payload: p });
  }

  async queueRemoteFire(p: { branchId: string; orderId: string }): Promise<void> {
    await syncQueueRepository.enqueue({ localId: p.orderId, operationType: 'REMOTE_FIRE', payload: p });
  }

  /**
   * Encola un borrador local YA persistido (creado durante la captura) para que el
   * worker lo suba al reconectar: CREATE_ORDER + un ADD_ITEM por línea + el cambio
   * de estado final (Cocina/Caja). No crea filas nuevas — reutiliza el draft que
   * ya vive en SQLite, de modo que nada de lo capturado se pierde sin conexión.
   */
  async enqueueDraftForSync(localOrderId: string, status: string): Promise<void> {
    const order = await orderRepository.findById(localOrderId);
    if (!order) return;
    const items = await orderItemRepository.findByOrder(localOrderId);

    await syncQueueRepository.enqueue({
      localId: order.id,
      operationType: 'CREATE_ORDER',
      payload: order,
    });
    for (const item of items) {
      await syncQueueRepository.enqueue({
        localId: item.id,
        operationType: 'ADD_ITEM',
        payload: item,
      });
    }
    await orderRepository.update(localOrderId, { status });
    await syncQueueRepository.enqueue({
      localId: order.id,
      operationType: 'UPDATE_ORDER',
      payload: { id: order.id, status },
    });
  }
}

export const localOrderService = new LocalOrderService();
