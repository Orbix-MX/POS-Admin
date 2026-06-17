import { api } from '@/lib/api-client'

export interface ComandaItem {
  itemType?: 'PRODUCT' | 'SERVICE'
  productId?: string
  name?: string
  quantity: number
  price: number
  notes?: string
}

export interface CreateComandaInput {
  tableNumber: string
  employeeNumber?: string
  guestCount?: number
  items: ComandaItem[]
}

export interface OpenTableItem {
  id: string
  name: string
  quantity: number
  price: string
  total: string
  sku?: string | null
}

export interface OpenTable {
  id: string
  orderNumber: string
  tableNumber: string
  employeeNumber: string | null
  guestCount: number | null
  total: string
  createdAt: string
  items: OpenTableItem[]
}

export async function createComanda(input: CreateComandaInput): Promise<OpenTable> {
  const { data } = await api.post<OpenTable>('/restaurant/comandas', input)
  return data
}

export async function getOpenTables(): Promise<OpenTable[]> {
  const { data } = await api.get<OpenTable[]>('/restaurant/open-tables')
  return data
}

export async function addItemsToComanda(
  orderId: string,
  items: ComandaItem[],
): Promise<OpenTable> {
  const { data } = await api.post<OpenTable>(`/restaurant/orders/${orderId}/items`, { items })
  return data
}

export async function checkoutComanda(
  orderId: string,
  paymentMethod: string,
  amount: number,
): Promise<void> {
  await api.post(`/restaurant/orders/${orderId}/checkout`, {
    payments: [{ paymentMethod, amount }],
  })
}

export interface DirectCheckoutItem {
  productId?: string
  name?: string
  price: number
  quantity: number
}

export async function directCheckout(
  items: DirectCheckoutItem[],
  paymentMethod: string,
): Promise<{ id: string; orderNumber: string }> {
  const { data } = await api.post<{ id: string; orderNumber: string }>(
    '/restaurant/checkout/direct',
    { items, paymentMethod },
  )
  return data
}

export function fmtComandaMoney(val: string | number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(val))
}
