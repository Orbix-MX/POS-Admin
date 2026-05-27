import { api } from '@/lib/api-client'

export interface ComandaItem {
  itemType?: 'PRODUCT' | 'SERVICE'
  productId?: string
  name?: string
  quantity: number
  price: number
}

export interface CreateComandaInput {
  tableNumber: string
  employeeNumber: string
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

export async function checkoutComanda(orderId: string, paymentMethod: string): Promise<void> {
  await api.post(`/restaurant/orders/${orderId}/checkout`, { paymentMethod })
}

export function fmtComandaMoney(val: string | number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(val))
}
