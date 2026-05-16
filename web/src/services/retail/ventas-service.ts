import { api } from '@/lib/api-client'

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'

export interface ApiOrderItem {
  id: string
  itemType?: 'PRODUCT' | 'SERVICE'
  productId?: string | null
  serviceId?: string | null
  name: string
  description?: string | null
  sku?: string | null
  quantity: number
  price: string | number
  discount: string | number
  tax: string | number
  subtotal: string | number
  total: string | number
  createdAt?: string
}

export interface ApiOrderPayment {
  id: string
  paymentMethod: string
  amount: string | number
  status: string
}

export interface ApiOrderCustomer {
  id: string
  firstName: string
  lastName: string
  email: string
}

export interface ApiOrder {
  id: string
  orderNumber: string
  customerId: string | null
  status: OrderStatus
  paymentStatus: PaymentStatus
  subtotal: string | number
  tax: string | number
  discount: string | number
  shippingCost: string | number
  total: string | number
  notes: string | null
  couponCode: string | null
  createdAt: string
  updatedAt: string
  customer: ApiOrderCustomer | null
  items: ApiOrderItem[]
  payments: ApiOrderPayment[]
}

export interface ListResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface CreateOrderItemInput {
  itemType?: 'PRODUCT' | 'SERVICE'
  productId?: string
  serviceId?: string
  name?: string
  description?: string
  quantity: number
  price: number
  discount?: number
  tax?: number
}

export interface CreateOrderPaymentSplit {
  method: string
  currency?: 'MXN' | 'USD'
  amount: number
  amountReceived?: number
  changeGiven?: number
}

export interface CreateOrderInput {
  customerId?: string
  items: CreateOrderItemInput[]
  paymentMethod: string
  payments?: CreateOrderPaymentSplit[]
  shippingCost?: number
  notes?: string
  couponCode?: string
  paymentStatus?: string
  status?: string
  dueDate?: string
  sourceQuoteId?: string
  changeAmount?: number
  changeCurrency?: 'MXN' | 'USD'
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:    'Pendiente',
  CONFIRMED:  'Confirmada',
  PROCESSING: 'Procesando',
  SHIPPED:    'Enviada',
  DELIVERED:  'Entregada',
  CANCELLED:  'Cancelada',
  REFUNDED:   'Reembolsada',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING:  'Pendiente',
  PAID:     'Pagado',
  FAILED:   'Fallido',
  REFUNDED: 'Reembolsado',
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING:    'bg-amber-100 text-amber-700',
  CONFIRMED:  'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-violet-100 text-violet-700',
  SHIPPED:    'bg-cyan-100 text-cyan-700',
  DELIVERED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-red-100 text-red-700',
  REFUNDED:   'bg-gray-100 text-gray-600',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  PENDING:  'bg-amber-100 text-amber-700',
  PAID:     'bg-green-100 text-green-700',
  FAILED:   'bg-red-100 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-600',
}

export async function getOrders(params?: { page?: number; limit?: number; status?: OrderStatus }): Promise<ListResponse<ApiOrder>> {
  const { data } = await api.get<ListResponse<ApiOrder>>('/orders', { params })
  return data
}

export async function getOrderById(id: string): Promise<ApiOrder> {
  const { data } = await api.get<ApiOrder>(`/orders/${id}`)
  return data
}

export async function createOrder(input: CreateOrderInput): Promise<ApiOrder> {
  const { data } = await api.post<ApiOrder>('/orders', input)
  return data
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<ApiOrder> {
  const { data } = await api.patch<ApiOrder>(`/orders/${id}/status-payment`, { status })
  return data
}

export function fmtMoney(val: string | number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(val))
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function customerName(customer: ApiOrderCustomer | null): string {
  if (!customer) return 'Mostrador'
  return `${customer.firstName} ${customer.lastName}`
}
