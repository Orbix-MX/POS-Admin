import { api } from '@/lib/api-client'

export type CxCStatus = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'VENCIDO'

export interface ApiCxCPayment {
  id: string
  accountReceivableId: string
  amount: string | number
  paymentDate: string
  paymentMethod: string
  reference: string | null
  notes: string | null
  createdAt: string
}

export interface ApiCxCCustomer {
  id: string
  firstName: string
  lastName: string
  email: string
}

export interface ApiCxCOrder {
  orderNumber: string
  total: string | number
}

export interface ApiCxC {
  id: string
  tenantId: string
  orderId: string
  customerId: string | null
  totalAmount: string | number
  balance: string | number
  status: CxCStatus
  dueDate: string
  notes: string | null
  createdAt: string
  updatedAt: string
  order: ApiCxCOrder
  customer: ApiCxCCustomer | null
  payments: ApiCxCPayment[]
}

export interface CxCListResponse {
  data: ApiCxC[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface CxCStats {
  pendiente: { count: number; balance: number }
  vencido:   { count: number; balance: number }
  parcial:   { count: number; balance: number }
  pagado:    { count: number; total: number }
}

export interface RegisterPaymentInput {
  amount: number
  paymentMethod: string
  reference?: string
  notes?: string
}

export const CXC_STATUS_LABELS: Record<CxCStatus, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL:   'Parcial',
  PAGADO:    'Pagado',
  VENCIDO:   'Vencido',
}

export const CXC_STATUS_COLORS: Record<CxCStatus, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  PARCIAL:   'bg-blue-100 text-blue-700',
  PAGADO:    'bg-green-100 text-green-700',
  VENCIDO:   'bg-red-100 text-red-700',
}

export async function getCxCList(params?: { page?: number; limit?: number; status?: CxCStatus; customerId?: string }): Promise<CxCListResponse> {
  const { data } = await api.get<CxCListResponse>('/receivables', { params })
  return data
}

export async function getCxCById(id: string): Promise<ApiCxC> {
  const { data } = await api.get<ApiCxC>(`/receivables/${id}`)
  return data
}

export async function getCxCStats(): Promise<CxCStats> {
  const { data } = await api.get<CxCStats>('/receivables/stats')
  return data
}

export async function registerCxCPayment(id: string, input: RegisterPaymentInput): Promise<ApiCxC> {
  const { data } = await api.post<ApiCxC>(`/receivables/${id}/payments`, input)
  return data
}

export function fmtMoney(val: string | number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(val))
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function cxcCustomerName(customer: ApiCxCCustomer | null): string {
  if (!customer) return '—'
  return `${customer.firstName} ${customer.lastName}`
}
