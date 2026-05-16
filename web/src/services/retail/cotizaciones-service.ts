import { api } from '@/lib/api-client'
import type { ListResponse } from '@/interfaces/list-response'

export type QuoteStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED'

export interface ServiceQuoteItem {
  id: string
  serviceQuoteId: string
  itemType?: 'PRODUCT' | 'SERVICE'
  serviceId?: string | null
  productId?: string | null
  sku?: string | null
  description: string
  quantity: number
  unitPrice: number | string
  total: number | string
  service?: { id: string; name: string } | null
  product?: { id: string; name: string; sku: string } | null
}

export interface ServiceQuote {
  id: string
  tenantId: string
  customerId: string
  quoteNumber: string
  status: QuoteStatus
  estimatedDeliveryDate?: string | null
  subtotal: number | string
  tax: number | string
  total: number | string
  notes?: string | null
  createdAt: string
  updatedAt: string
  customer: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    company?: string | null
  }
  items: ServiceQuoteItem[]
  orders?: Array<{ id: string; orderNumber: string; status: string; createdAt: string }>
  createdBy?: { id: string; firstName: string; lastName: string } | null
}

export interface CreateQuoteItemPayload {
  itemType?: 'PRODUCT' | 'SERVICE'
  productId?: string
  serviceId?: string
  sku?: string
  description: string
  quantity: number
  unitPrice: number
}

export interface CreateQuotePayload {
  customerId: string
  items: CreateQuoteItemPayload[]
  estimatedDeliveryDate?: string
  notes?: string
}

export interface ConvertQuotePayload {
  paymentMethod?: string
  notes?: string
  extraProducts?: Array<{ productId: string; quantity: number; price: number }>
}

export async function fetchQuotesByCustomer(customerId: string): Promise<ServiceQuote[]> {
  const res = await api.get<ServiceQuote[]>(`/service-quotes/customer/${customerId}`)
  return res.data
}

export async function fetchQuotes(params?: {
  customerId?: string
  status?: QuoteStatus
  search?: string
  page?: number
  limit?: number
}): Promise<ListResponse<ServiceQuote>> {
  const res = await api.get<ListResponse<ServiceQuote>>('/service-quotes', { params })
  return res.data
}

export async function fetchQuote(id: string): Promise<ServiceQuote> {
  const res = await api.get<ServiceQuote>(`/service-quotes/${id}`)
  return res.data
}

export async function createQuote(payload: CreateQuotePayload): Promise<ServiceQuote> {
  const res = await api.post<ServiceQuote>('/service-quotes', payload)
  return res.data
}

export async function updateQuote(id: string, payload: Partial<{ status: string; notes: string; estimatedDeliveryDate: string }>): Promise<ServiceQuote> {
  const res = await api.patch<ServiceQuote>(`/service-quotes/${id}`, payload)
  return res.data
}

export async function approveQuote(id: string): Promise<ServiceQuote> {
  const res = await api.post<ServiceQuote>(`/service-quotes/${id}/approve`)
  return res.data
}

export async function convertQuote(id: string, payload: ConvertQuotePayload): Promise<any> {
  const res = await api.post(`/service-quotes/${id}/convert`, payload)
  return res.data
}

export async function downloadQuotePdf(id: string, quoteNumber: string): Promise<void> {
  const res = await api.get(`/service-quotes/${id}/pdf`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${quoteNumber}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
