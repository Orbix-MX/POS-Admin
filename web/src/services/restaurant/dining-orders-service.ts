import { api } from '@/lib/api-client'

/**
 * Cliente web del flujo único de restaurante sobre `DiningOrder`
 * (endpoints `/branches/:branchId/dining-orders/*`). Es el mismo backend que
 * consume la app móvil: `DiningOrdersService`. La caja cobra con `checkout`,
 * que genera el `Order` financiero (inventario + Payment + CashMovement) y lo
 * retorna para imprimir el ticket desde el Order, no desde el DiningOrder.
 */

export type DiningOrderStatus =
  | 'OPEN'
  | 'SENT_TO_KITCHEN'
  | 'IN_PREPARATION'
  | 'READY'
  | 'DELIVERED'
  | 'READY_FOR_PAYMENT'
  | 'PAID'
  | 'CLOSED'
  | 'CANCELLED'

export type DiningServiceType = 'DINE_IN' | 'COUNTER'

export interface DiningOrderItem {
  id: string
  productId: string | null
  productName: string
  unitPrice: number
  quantity: number
  notes: string | null
  createdAt: string
}

export interface DiningOrder {
  id: string
  status: DiningOrderStatus
  serviceType: DiningServiceType | string
  reference: string | null
  openedAt: string
  closedAt: string | null
  tableId: string | null
  branchId: string
  table: { id: string; name: string; capacity: number } | null
  waiter: { id: string; firstName: string; lastName: string }
  items: DiningOrderItem[]
}

export type DiningPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'

export interface DiningPaymentSplit {
  paymentMethod: DiningPaymentMethod | string
  amount: number
  currency?: string
  amountReceived?: number
  changeGiven?: number
}

/** Order financiero retornado por el checkout (fuente para imprimir ticket). */
export interface DiningCheckoutResult {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
}

/** Estados desde los que la caja puede cobrar una cuenta. */
export const PAYABLE_DINING_STATUSES: DiningOrderStatus[] = ['DELIVERED', 'READY_FOR_PAYMENT']

export function isPayableDiningOrder(o: DiningOrder): boolean {
  return PAYABLE_DINING_STATUSES.includes(o.status as DiningOrderStatus)
}

// ─── Lectura ───────────────────────────────────────────────────────────────────

/**
 * Intención de visibilidad del solicitante. 'all' (caja): todas las cuentas
 * activas, siempre. 'own' (comanda/operador): respetará `restaurantVisibilityMode`
 * cuando se implemente. Hoy el backend no filtra; el contrato ya queda fijado.
 */
export type DiningOrderScope = 'all' | 'own'

export async function getActiveDiningOrders(
  branchId: string,
  scope: DiningOrderScope = 'all',
): Promise<DiningOrder[]> {
  const { data } = await api.get<DiningOrder[]>(
    `/branches/${branchId}/dining-orders`,
    { params: { scope } },
  )
  return Array.isArray(data) ? data : []
}

export async function getDiningOrder(branchId: string, orderId: string): Promise<DiningOrder> {
  const { data } = await api.get<DiningOrder>(`/branches/${branchId}/dining-orders/${orderId}`)
  return data
}

export async function getDiningOrderForTable(
  branchId: string,
  tableId: string,
): Promise<DiningOrder | null> {
  const { data } = await api.get<DiningOrder | null>(
    `/branches/${branchId}/dining-orders/table/${tableId}`,
  )
  return data ?? null
}

// ─── Captura ────────────────────────────────────────────────────────────────────

export async function openDiningOrder(
  branchId: string,
  options:
    | { serviceType: 'DINE_IN'; tableId: string; waiterId?: string }
    | { serviceType: 'COUNTER'; reference?: string; waiterId?: string },
): Promise<DiningOrder> {
  const { data } = await api.post<DiningOrder>(`/branches/${branchId}/dining-orders`, options)
  return data
}

export async function addDiningOrderItem(
  branchId: string,
  orderId: string,
  item: { productName: string; unitPrice: number; quantity: number; productId?: string; notes?: string },
): Promise<DiningOrderItem> {
  const { data } = await api.post<DiningOrderItem>(
    `/branches/${branchId}/dining-orders/${orderId}/items`,
    item,
  )
  return data
}

export async function updateDiningOrderItem(
  branchId: string,
  orderId: string,
  itemId: string,
  quantity: number,
): Promise<DiningOrderItem> {
  const { data } = await api.patch<DiningOrderItem>(
    `/branches/${branchId}/dining-orders/${orderId}/items/${itemId}`,
    { quantity },
  )
  return data
}

export async function removeDiningOrderItem(
  branchId: string,
  orderId: string,
  itemId: string,
): Promise<void> {
  await api.delete(`/branches/${branchId}/dining-orders/${orderId}/items/${itemId}`)
}

export async function changeDiningOrderStatus(
  branchId: string,
  orderId: string,
  status: DiningOrderStatus,
): Promise<DiningOrder> {
  const { data } = await api.patch<DiningOrder>(
    `/branches/${branchId}/dining-orders/${orderId}/status`,
    { status },
  )
  return data
}

/**
 * Envía una ronda: marca como enviados solo los ítems pendientes y avanza el
 * estado (cocina o caja). Reemplaza al changeStatus para el "primer envío" y las
 * rondas adicionales — así el KDS recibe únicamente lo nuevo, sin duplicar la cuenta.
 */
export async function fireDiningRound(branchId: string, orderId: string): Promise<DiningOrder> {
  const { data } = await api.post<DiningOrder>(
    `/branches/${branchId}/dining-orders/${orderId}/fire`,
    {},
  )
  return data
}

export async function discardDiningOrder(
  branchId: string,
  orderId: string,
): Promise<{ discarded: boolean }> {
  const { data } = await api.delete<{ discarded: boolean }>(
    `/branches/${branchId}/dining-orders/${orderId}`,
  )
  return data
}

// ─── Cobro (caja) ────────────────────────────────────────────────────────────────

/**
 * Cobra una cuenta. El backend genera el Order financiero (inventario SIMPLE/
 * RECIPE/COMBO + branchInventory + movimientos + Payment + CashMovement),
 * enlaza el DiningOrder y libera la mesa. Idempotente. Retorna el Order para
 * imprimir el ticket con `printOrder(result.id)`.
 */
export async function checkoutDiningOrder(
  branchId: string,
  orderId: string,
  payments: DiningPaymentSplit[],
  customerId?: string,
): Promise<DiningCheckoutResult> {
  const { data } = await api.post<DiningCheckoutResult>(
    `/branches/${branchId}/dining-orders/${orderId}/checkout`,
    { payments, ...(customerId ? { customerId } : {}) },
  )
  return data
}

export function fmtDiningMoney(val: string | number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(val))
}

export function diningOrderTotal(o: DiningOrder): number {
  return o.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)
}
