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
  createdAt: string;
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
    | { serviceType: 'DINE_IN'; tableId: string }
    | { serviceType: 'COUNTER'; reference?: string },
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
  item: { productName: string; unitPrice: number; quantity: number; productId?: string; notes?: string },
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
  quantity: number,
): Promise<DiningOrderItem> {
  const { data } = await apiClient.patch<DiningOrderItem>(
    `/branches/${branchId}/dining-orders/${orderId}/items/${itemId}`,
    { quantity },
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

interface RawProduct {
  id: string;
  name: string;
  price: string | number;
  sku: string;
  type?: ProductKind;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
}

export async function searchProducts(search?: string, categoryId?: string): Promise<ProductResult[]> {
  const params = new URLSearchParams({ status: 'ACTIVE', limit: '100' });
  if (search) params.set('search', search);
  if (categoryId) params.set('categoryId', categoryId);
  const { data } = await apiClient.get<{ data: RawProduct[] }>(`/products?${params.toString()}`);
  return (data.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    sku: p.sku,
    type: p.type ?? 'SIMPLE',
    categoryId: p.categoryId ?? p.category?.id ?? null,
    category: p.category ?? null,
  }));
}

export async function fetchCategories(): Promise<ProductCategory[]> {
  const { data } = await apiClient.get<ProductCategory[]>('/categories');
  return Array.isArray(data) ? data : [];
}
