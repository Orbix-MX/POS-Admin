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
}

export const localOrderService = new LocalOrderService();
