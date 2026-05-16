import { api } from '@/lib/api-client'
import type { ListResponse } from '@/interfaces/list-response'

export interface Service {
  id: string
  tenantId: string
  name: string
  description?: string | null
  basePrice: number | string
  estimatedDuration?: string | null
  hasVariablePrice: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateServicePayload {
  name: string
  description?: string
  basePrice: number
  estimatedDuration?: string
  hasVariablePrice?: boolean
  isActive?: boolean
}

export interface UpdateServicePayload extends Partial<CreateServicePayload> {}

export async function fetchServices(params?: {
  search?: string
  isActive?: boolean
  page?: number
  limit?: number
}): Promise<ListResponse<Service>> {
  const res = await api.get<ListResponse<Service>>('/services', { params })
  return res.data
}

export async function createService(payload: CreateServicePayload): Promise<Service> {
  const res = await api.post<Service>('/services', payload)
  return res.data
}

export async function updateService(id: string, payload: UpdateServicePayload): Promise<Service> {
  const res = await api.patch<Service>(`/services/${id}`, payload)
  return res.data
}
