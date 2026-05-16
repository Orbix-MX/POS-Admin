import { api } from '@/lib/api-client'
import type { Product } from '@/services/retail/product-service'
import type { ApiAccountPayable } from '@/services/core/payables-service'

// ---- API shapes ----

export interface ApiSupplier {
  id: string
  name: string
  contactName?: string | null
  email: string
  phone?: string | null
  status: 'ACTIVE' | 'INACTIVE'
  totalOrders: number
  totalSpent: string | number
}

export interface ApiProduct {
  id: string
  sku: string
  name: string
  costPrice?: string | number | null
  price: string | number
  stock: number
}

export interface ApiPurchaseOrderItem {
  id: string
  purchaseOrderId: string
  productId: string
  quantityOrdered: number
  unitCost: string | number
  tax: string | number
  total: string | number
  product: ApiProduct
}

export interface ApiPurchaseReceiptItem {
  id: string
  purchaseReceiptId: string
  productId: string
  quantityReceived: number
  product: ApiProduct
}

export interface ApiPurchaseReceipt {
  id: string
  purchaseOrderId: string
  receivedDate: string
  notes?: string | null
  receivedBy?: { id: string; firstName: string; lastName: string } | null
  items: ApiPurchaseReceiptItem[]
}

export type PurchaseOrderStatus = 'BORRADOR' | 'ENVIADA' | 'PARCIAL' | 'COMPLETADA' | 'CANCELADA'

export interface ApiPurchaseOrder {
  id: string
  orderNumber: string
  tenantId: string
  supplierId: string
  status: PurchaseOrderStatus
  orderDate: string
  expectedDate?: string | null
  subtotal: string | number
  tax: string | number
  total: string | number
  notes?: string | null
  createdAt: string
  updatedAt: string
  supplier: ApiSupplier
  items: ApiPurchaseOrderItem[]
  receipts?: ApiPurchaseReceipt[]
  accountPayable?: ApiAccountPayable | null
}

interface PaginatedResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

// ---- Input types ----

export interface CreatePurchaseOrderItemInput {
  productId: string
  quantityOrdered: number
  unitCost: number
  tax?: number
}

export interface CreatePurchaseOrderInput {
  supplierId: string
  expectedDate?: string
  notes?: string
  items: CreatePurchaseOrderItemInput[]
}

export interface UpdatePurchaseOrderInput {
  supplierId?: string
  expectedDate?: string
  notes?: string
  items?: CreatePurchaseOrderItemInput[]
}

export interface ReceiveItemInput {
  productId: string
  quantityReceived: number
}

export interface ReceivePurchaseOrderInput {
  items: ReceiveItemInput[]
  notes?: string
  branchId?: string
}

// ---- API calls ----

export async function fetchPurchaseOrders(params?: {
  page?: number
  limit?: number
  status?: PurchaseOrderStatus
  supplierId?: string
  search?: string
}): Promise<PaginatedResponse<ApiPurchaseOrder>> {
  const { data } = await api.get<PaginatedResponse<ApiPurchaseOrder>>('/purchase-orders', { params })
  return data
}

export async function fetchPurchaseOrder(id: string): Promise<ApiPurchaseOrder> {
  const { data } = await api.get<ApiPurchaseOrder>(`/purchase-orders/${id}`)
  return data
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<ApiPurchaseOrder> {
  const { data } = await api.post<ApiPurchaseOrder>('/purchase-orders', input)
  return data
}

export async function updatePurchaseOrder(id: string, input: UpdatePurchaseOrderInput): Promise<ApiPurchaseOrder> {
  const { data } = await api.patch<ApiPurchaseOrder>(`/purchase-orders/${id}`, input)
  return data
}

export async function sendPurchaseOrder(id: string): Promise<ApiPurchaseOrder> {
  const { data } = await api.post<ApiPurchaseOrder>(`/purchase-orders/${id}/send`)
  return data
}

export async function cancelPurchaseOrder(id: string): Promise<ApiPurchaseOrder> {
  const { data } = await api.post<ApiPurchaseOrder>(`/purchase-orders/${id}/cancel`)
  return data
}

export async function receivePurchaseOrder(id: string, input: ReceivePurchaseOrderInput): Promise<ApiPurchaseOrder> {
  const { data } = await api.post<ApiPurchaseOrder>(`/purchase-orders/${id}/receive`, input)
  return data
}

export async function fetchPurchaseReceipts(id: string): Promise<ApiPurchaseReceipt[]> {
  const { data } = await api.get<ApiPurchaseReceipt[]>(`/purchase-orders/${id}/receipts`)
  return data
}

export async function fetchSuppliersForSelect(): Promise<ApiSupplier[]> {
  const { data } = await api.get<PaginatedResponse<ApiSupplier>>('/suppliers', {
    params: { limit: 100, page: 1 },
  })
  return data.data
}

export async function fetchProductsForSelect(): Promise<ApiProduct[]> {
  const { data } = await api.get<{ data: ApiProduct[] }>('/products', {
    params: { limit: 200, page: 1, status: 'ACTIVE' },
  })
  return data.data
}

// ---- Helpers ----

export const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  BORRADOR:   'Borrador',
  ENVIADA:    'Enviada',
  PARCIAL:    'Parcial',
  COMPLETADA: 'Completada',
  CANCELADA:  'Cancelada',
}

export const STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  BORRADOR:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  ENVIADA:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  PARCIAL:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  COMPLETADA: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  CANCELADA:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export function fmtMoney(val: string | number): string {
  return `$${parseFloat(String(val ?? 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function calcReceived(order: ApiPurchaseOrder): Record<string, number> {
  const map: Record<string, number> = {}
  for (const r of order.receipts ?? []) {
    for (const ri of r.items) {
      map[ri.productId] = (map[ri.productId] ?? 0) + ri.quantityReceived
    }
  }
  return map
}
