import { OrderOrigin } from '@prisma/client';

type OrderLike = { orderOrigin?: OrderOrigin | null; tableNumber?: string | null };

export function isRestaurantOrder(order: OrderLike): boolean {
  if (order.orderOrigin != null) return order.orderOrigin === OrderOrigin.RESTAURANT_COMANDA;
  return order.tableNumber != null;
}

export function isRetailOrder(order: OrderLike): boolean {
  if (order.orderOrigin != null) return order.orderOrigin === OrderOrigin.RETAIL_POS;
  return order.tableNumber == null;
}

export function getOrderOrigin(order: OrderLike): OrderOrigin {
  if (order.orderOrigin != null) return order.orderOrigin;
  return order.tableNumber != null ? OrderOrigin.RESTAURANT_COMANDA : OrderOrigin.RETAIL_POS;
}
