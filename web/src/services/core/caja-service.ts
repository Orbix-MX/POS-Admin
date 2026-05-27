import { api } from '@/lib/api-client'

export type CashSessionStatus = 'ABIERTA' | 'CERRADA'
export type CashMovementType = 'SALE' | 'CXC_PAYMENT' | 'SUPPLIER_PAYMENT' | 'INCOME' | 'EXPENSE'

export interface ApiCashMovement {
  id: string
  cashSessionId: string | null
  type: CashMovementType
  currency: string
  amount: string | number
  exchangeRateUsed: string | number | null
  amountOriginalCurrency: string | number | null
  amountMxnEquivalent: string | number | null
  paymentMethod: string
  referenceId: string | null
  referenceType: string | null
  supplierPaymentId: string | null
  notes: string | null
  createdAt: string
}

export interface ApiCashSession {
  id: string
  tenantId: string
  branchId: string | null
  status: CashSessionStatus
  exchangeRateUsdMxn: string | number
  openingAmount: string | number
  openingAmountUsd: string | number
  closingAmount: string | number | null
  cashCounted: string | number | null
  cashCountedUsd: string | number | null
  difference: string | number | null
  differenceUsd: string | number | null
  notes: string | null
  openedAt: string
  closedAt: string | null
  openedBy: { id: string; email: string } | null
  closedBy: { id: string; email: string } | null
  authorizedBy: { id: string; email: string } | null
  branch: { id: string; name: string } | null
  movements: ApiCashMovement[]
  summary?: SessionSummary
  _count?: { movements: number }
}

export interface SessionSummary {
  openingAmount: number
  openingAmountUsd: number
  expectedCash: number
  expectedCashUsd: number
  totals: {
    sales:    { cash: number; cashUsd: number; card: number; transfer: number; total: number }
    cxc:      { cash: number; cashUsd: number; card: number; transfer: number; total: number }
    supplier: { cash: number; cashUsd: number; card: number; transfer: number; total: number }
    income:   { cash: number; cashUsd: number; total: number }
    expense:  { cash: number; cashUsd: number; total: number }
  }
  movementsCount: number
}

export interface OpenSessionInput {
  exchangeRateUsdMxn: number
  openingAmount: number
  openingAmountUsd?: number
  notes?: string
  branchId?: string
}

export interface CloseSessionInput {
  cashCounted: number
  cashCountedUsd?: number
  notes?: string
}

export function fmtUsd(val: string | number | null | undefined): string {
  return `$${parseFloat(String(val ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`
}

interface PaginatedResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export async function fetchActiveCashSession(branchId?: string): Promise<ApiCashSession | null> {
  const params = branchId ? { branchId } : {}
  const { data } = await api.get<ApiCashSession | Record<string, never>>('/cash-sessions/active', { params })
  return data && 'id' in data ? data as ApiCashSession : null
}

export async function fetchCashSessions(params?: {
  page?: number
  limit?: number
  status?: CashSessionStatus
  branchId?: string
}): Promise<PaginatedResponse<ApiCashSession>> {
  const { data } = await api.get<PaginatedResponse<ApiCashSession>>('/cash-sessions', { params })
  return data
}

export async function fetchCashSession(id: string): Promise<ApiCashSession> {
  const { data } = await api.get<ApiCashSession>(`/cash-sessions/${id}`)
  return data
}

export async function openCashSession(input: OpenSessionInput): Promise<ApiCashSession> {
  const { data } = await api.post<ApiCashSession>('/cash-sessions', input)
  return data
}

export async function closeCashSession(id: string, input: CloseSessionInput): Promise<ApiCashSession> {
  const { data } = await api.patch<ApiCashSession>(`/cash-sessions/${id}/close`, input)
  return data
}

export interface CloseWithAuthInput extends CloseSessionInput {
  authEmail: string
  authPassword: string
}

export async function closeSessionWithAuth(id: string, input: CloseWithAuthInput): Promise<ApiCashSession> {
  const { data } = await api.patch<ApiCashSession>(`/cash-sessions/${id}/close-authorized`, input)
  return data
}

export async function verifyCloseAuth(input: { authEmail: string; authPassword: string }): Promise<{ email: string }> {
  const { data } = await api.post<{ email: string }>('/cash-sessions/verify-auth', input)
  return data
}

export interface ManualMovementInput {
  type: 'INCOME' | 'EXPENSE'
  amount: number
  currency?: 'MXN' | 'USD'
  reason?: string
  notes?: string
}

export async function createManualMovement(input: ManualMovementInput): Promise<ApiCashMovement> {
  const { data } = await api.post<ApiCashMovement>('/cash-sessions/active/movement', input)
  return data
}

// ---- helpers ----

export const MOVEMENT_TYPE_LABELS: Record<CashMovementType, string> = {
  SALE: 'Venta',
  CXC_PAYMENT: 'Cobranza CxC',
  SUPPLIER_PAYMENT: 'Pago proveedor',
  INCOME: 'Ingreso manual',
  EXPENSE: 'Egreso manual',
}

export const MOVEMENT_TYPE_COLORS: Record<CashMovementType, string> = {
  SALE: 'text-green-600',
  CXC_PAYMENT: 'text-blue-600',
  SUPPLIER_PAYMENT: 'text-red-500',
  INCOME: 'text-emerald-600',
  EXPENSE: 'text-orange-500',
}

export const INCOME_TYPES: CashMovementType[] = ['SALE', 'CXC_PAYMENT', 'INCOME']
export const EXPENSE_TYPES: CashMovementType[] = ['SUPPLIER_PAYMENT', 'EXPENSE']

export function fmtMoney(val: string | number | null | undefined): string {
  return `$${parseFloat(String(val ?? 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}
