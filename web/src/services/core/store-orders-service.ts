import { api } from '@/lib/api-client'
import type { ListResponse } from '@/interfaces/list-response'

export type StoreOrderStatus = 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED'

export interface ApiStoreOrderItem {
  id: string
  productId: string | null
  name: string
  price: string | number
  quantity: number
  subtotal: string | number
}

export interface ApiStoreOrder {
  id: string
  orderNumber: string
  phone: string
  status: StoreOrderStatus
  subtotal: string | number
  deliveredAt: string | null
  createdAt: string
  items?: ApiStoreOrderItem[]
  _count?: { items: number }
}

export const STORE_ORDER_STATUS_LABELS: Record<StoreOrderStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export const STORE_ORDER_STATUS_COLORS: Record<StoreOrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

// Próximo(s) status válido(s) desde el status actual — ver
// ALLOWED_TRANSITIONS en store-orders.service.ts (backend), misma regla.
export const STORE_ORDER_NEXT_STATUSES: Record<StoreOrderStatus, StoreOrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
}

export async function getStoreOrders(params?: { page?: number; limit?: number; status?: StoreOrderStatus }): Promise<ListResponse<ApiStoreOrder>> {
  const { data } = await api.get<ListResponse<ApiStoreOrder>>('/store-orders', { params })
  return data
}

export async function getStoreOrderById(id: string): Promise<ApiStoreOrder> {
  const { data } = await api.get<ApiStoreOrder>(`/store-orders/${id}`)
  return data
}

export async function updateStoreOrderStatus(id: string, status: StoreOrderStatus): Promise<ApiStoreOrder> {
  const { data } = await api.patch<ApiStoreOrder>(`/store-orders/${id}/status`, { status })
  return data
}

export function fmtMoney(val: string | number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(val))
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}
