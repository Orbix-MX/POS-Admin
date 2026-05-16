// Shared types between @ventasy/api and @ventasy/web

export interface ListResponse<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type Currency = 'MXN' | 'USD'

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' | 'OTHER'

export type CashMovementType =
  | 'SALE'
  | 'CXC_PAYMENT'
  | 'SUPPLIER_PAYMENT'
  | 'INCOME'
  | 'EXPENSE'

export type CashSessionStatus = 'ABIERTA' | 'CERRADA'

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED'
