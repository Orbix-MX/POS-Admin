import { api } from '@/lib/api-client'

export type AccountPayableStatus = 'PENDIENTE' | 'PARCIAL' | 'PAGADO'
export type SupplierPaymentMethod = 'CASH' | 'TRANSFER' | 'CARD'

export interface ApiSupplierPayment {
  id: string
  accountPayableId: string
  amount: string | number
  paymentMethod: SupplierPaymentMethod
  paymentDate: string
  reference?: string | null
  notes?: string | null
  createdAt: string
}

export interface ApiAccountPayable {
  id: string
  tenantId: string
  purchaseOrderId: string
  supplierId: string
  totalAmount: string | number
  balance: string | number
  status: AccountPayableStatus
  notes?: string | null
  createdAt: string
  updatedAt: string
  supplier?: { id: string; name: string; email: string }
  purchaseOrder?: { id: string; orderNumber: string; total: string | number }
  payments: ApiSupplierPayment[]
}

interface PaginatedResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface RegisterPaymentInput {
  amount: number
  paymentMethod: SupplierPaymentMethod
  paymentDate?: string
  reference?: string
  notes?: string
}

export async function fetchPayables(params?: {
  page?: number
  limit?: number
  status?: AccountPayableStatus
  supplierId?: string
  search?: string
}): Promise<PaginatedResponse<ApiAccountPayable>> {
  const { data } = await api.get<PaginatedResponse<ApiAccountPayable>>('/payables', { params })
  return data
}

export async function fetchPayable(id: string): Promise<ApiAccountPayable> {
  const { data } = await api.get<ApiAccountPayable>(`/payables/${id}`)
  return data
}

export async function registerPayablePayment(id: string, input: RegisterPaymentInput): Promise<ApiAccountPayable> {
  const { data } = await api.post<ApiAccountPayable>(`/payables/${id}/payments`, input)
  return data
}

export async function fetchPayablesStats(): Promise<{
  pendiente: { count: number; balance: number }
  parcial: { count: number; balance: number }
  pagado: { count: number; total: number }
}> {
  const { data } = await api.get('/payables/stats')
  return data
}

export const PAYABLE_STATUS_LABELS: Record<AccountPayableStatus, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL:   'Parcial',
  PAGADO:    'Pagado',
}

export const PAYABLE_STATUS_COLORS: Record<AccountPayableStatus, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  PARCIAL:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  PAGADO:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}

export const PAYMENT_METHOD_LABELS: Record<SupplierPaymentMethod, string> = {
  CASH:     'Efectivo',
  TRANSFER: 'Transferencia',
  CARD:     'Tarjeta',
}
