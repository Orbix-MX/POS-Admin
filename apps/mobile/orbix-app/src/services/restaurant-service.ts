import { apiClient } from './api-client';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED';

export interface DiningArea {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface ActiveOrder {
  id: string;
  openedAt: string;
  waiter: { id: string; firstName: string; lastName: string };
}

export interface RestaurantTable {
  id: string;
  name: string;
  capacity: number;
  displayOrder: number;
  isActive: boolean;
  status: TableStatus;
  areaId: string;
  area: { id: string; name: string };
  diningOrders: ActiveOrder[];
}

export interface DiningOrderItem {
  id: string;
  productId: string | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string | null;
  /** NULL = pendiente de envío (ronda en captura); fecha = ya enviado a cocina. */
  sentToKitchenAt?: string | null;
  createdAt: string;
  /** Solo cliente: cambio aplicado offline aún sin confirmar en el backend. */
  pendingSync?: boolean;
}

export type DiningOrderStatus =
  | 'OPEN'
  | 'SENT_TO_KITCHEN'
  | 'IN_PREPARATION'
  | 'READY'
  | 'DELIVERED'
  | 'READY_FOR_PAYMENT'
  | 'PAID'
  | 'CLOSED'
  | 'CANCELLED';

export interface DiningOrder {
  id: string;
  status: DiningOrderStatus;
  serviceType: string;
  reference: string | null;
  openedAt: string;
  tableId: string | null;
  branchId: string;
  table: { id: string; name: string; capacity: number } | null;
  waiter: { id: string; firstName: string; lastName: string };
  items: DiningOrderItem[];
  /** True for orders created/edited offline that haven't reached the server. */
  pendingSync?: boolean;
}

export type ProductKind = 'SIMPLE' | 'RECIPE' | 'COMBO' | 'SERVICE';

export interface ProductResult {
  id: string;
  name: string;
  price: number;
  sku: string;
  type: ProductKind;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
}

export interface ProductCategory {
  id: string;
  name: string;
}

export async function fetchDiningAreas(branchId: string): Promise<DiningArea[]> {
  const { data } = await apiClient.get<DiningArea[]>(`/branches/${branchId}/dining-areas`);
  return data;
}

export async function fetchTables(branchId: string): Promise<RestaurantTable[]> {
  const { data } = await apiClient.get<RestaurantTable[]>(`/branches/${branchId}/tables`);
  return data;
}

export type DiningServiceType = 'DINE_IN' | 'COUNTER';

export async function openDiningOrder(
  branchId: string,
  options:
    | { serviceType: 'DINE_IN'; tableId: string; waiterId?: string }
    | { serviceType: 'COUNTER'; reference?: string; waiterId?: string },
): Promise<DiningOrder> {
  const { data } = await apiClient.post<DiningOrder>(`/branches/${branchId}/dining-orders`, options);
  return data;
}

/**
 * Discard an abandoned empty draft order, releasing its table. Safe to call only
 * for OPEN orders with no items (the API rejects non-empty / non-draft orders).
 */
export async function discardOrder(branchId: string, orderId: string): Promise<{ discarded: boolean }> {
  const { data } = await apiClient.delete<{ discarded: boolean }>(`/branches/${branchId}/dining-orders/${orderId}`);
  return data;
}

export async function fetchActiveOrders(branchId: string): Promise<DiningOrder[]> {
  const { data } = await apiClient.get<DiningOrder[]>(`/branches/${branchId}/dining-orders`);
  return Array.isArray(data) ? data : [];
}

export async function fetchOrder(branchId: string, orderId: string): Promise<DiningOrder> {
  const { data } = await apiClient.get<DiningOrder>(`/branches/${branchId}/dining-orders/${orderId}`);
  return data;
}

export async function addOrderItem(
  branchId: string,
  orderId: string,
  item: { productName: string; unitPrice: number; quantity: number; id?: string; productId?: string; notes?: string },
): Promise<DiningOrderItem> {
  const { data } = await apiClient.post<DiningOrderItem>(
    `/branches/${branchId}/dining-orders/${orderId}/items`,
    item,
  );
  return data;
}

export async function updateOrderItem(
  branchId: string,
  orderId: string,
  itemId: string,
  patch: { quantity?: number; notes?: string | null },
): Promise<DiningOrderItem> {
  const { data } = await apiClient.patch<DiningOrderItem>(
    `/branches/${branchId}/dining-orders/${orderId}/items/${itemId}`,
    {
      ...(patch.quantity != null && { quantity: patch.quantity }),
      ...(patch.notes !== undefined && { notes: patch.notes ?? '' }),
    },
  );
  return data;
}

export async function removeOrderItem(
  branchId: string,
  orderId: string,
  itemId: string,
): Promise<void> {
  await apiClient.delete(`/branches/${branchId}/dining-orders/${orderId}/items/${itemId}`);
}

export async function changeOrderStatus(
  branchId: string,
  orderId: string,
  status: DiningOrderStatus,
): Promise<DiningOrder> {
  const { data } = await apiClient.patch<DiningOrder>(
    `/branches/${branchId}/dining-orders/${orderId}/status`,
    { status },
  );
  return data;
}

/**
 * Envía una ronda: marca como enviados solo los ítems pendientes y avanza el
 * estado (a cocina o a caja). No duplica la orden ni re-envía lo ya preparado.
 */
export async function fireRound(branchId: string, orderId: string): Promise<DiningOrder> {
  const { data } = await apiClient.post<DiningOrder>(
    `/branches/${branchId}/dining-orders/${orderId}/fire`,
    {},
  );
  return data;
}

export type DiningPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

export interface DiningPaymentSplit {
  paymentMethod: DiningPaymentMethod;
  amount: number;
  amountReceived?: number;
  changeGiven?: number;
}

export interface CheckoutResult {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
}

/**
 * Charge a dining order. Generates the financial Order server-side (inventory +
 * payment + cash movement) and links it to the dining order. Mirrors POS and
 * Restaurant Web checkout — this is what replaces the old changeStatus(PAID).
 */
export async function checkoutDiningOrder(
  branchId: string,
  orderId: string,
  payments: DiningPaymentSplit[],
  customerId?: string,
): Promise<CheckoutResult> {
  const { data } = await apiClient.post<CheckoutResult>(
    `/branches/${branchId}/dining-orders/${orderId}/checkout`,
    { payments, ...(customerId ? { customerId } : {}) },
  );
  return data;
}

interface RawProduct {
  id: string;
  name: string;
  price: string | number;
  sku: string;
  type?: ProductKind;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
}

export interface ProductPage {
  products: ProductResult[];
  page: number;
  totalPages: number;
  total: number;
}

export interface SearchProductsParams {
  search?: string;
  categoryId?: string;
  /** Filtra por tipo (p. ej. 'COMBO') server-side; escala igual que categorías. */
  type?: ProductKind;
  page?: number;
  limit?: number;
}

/**
 * Búsqueda de productos paginada y server-side. Reemplaza la carga del catálogo
 * completo: el backend filtra por texto/categoría/tipo y pagina, de modo que la
 * captura escala con 100, 500 o 2000+ productos sin traer todo al dispositivo.
 */
export async function searchProducts(opts: SearchProductsParams = {}): Promise<ProductPage> {
  const params = new URLSearchParams({
    status: 'ACTIVE',
    page: String(opts.page ?? 1),
    limit: String(opts.limit ?? 30),
  });
  if (opts.search) params.set('search', opts.search);
  if (opts.categoryId) params.set('categoryId', opts.categoryId);
  if (opts.type) params.set('type', opts.type);

  const { data } = await apiClient.get<{
    data: RawProduct[];
    meta?: { page: number; limit: number; total: number; totalPages: number };
  }>(`/products?${params.toString()}`);

  const products = (data.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    sku: p.sku,
    type: p.type ?? 'SIMPLE',
    categoryId: p.categoryId ?? p.category?.id ?? null,
    category: p.category ?? null,
  }));

  return {
    products,
    page: data.meta?.page ?? 1,
    totalPages: data.meta?.totalPages ?? 1,
    total: data.meta?.total ?? products.length,
  };
}

export async function fetchCategories(): Promise<ProductCategory[]> {
  const { data } = await apiClient.get<ProductCategory[]>('/categories');
  return Array.isArray(data) ? data : [];
}
