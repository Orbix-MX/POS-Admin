import type { ListResponse } from '@/interfaces/list-response'
import { api } from '@/lib/api-client'

export interface Supply {
  id?: string
  name: string
  sku: string
  unit: string
  stock: number
  minStock: number
  cost: number
  branchId?: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt?: string
  updatedAt?: string
  branch?: { id: string; name: string } | null
}

export interface SupplyMovement {
  id: string
  supplyId: string
  type: 'PURCHASE' | 'RECIPE_CONSUMPTION' | 'ADJUSTMENT'
  quantity: number
  branchId?: string
  referenceId?: string
  notes?: string
  createdAt: string
}

export async function fetchSupplies(): Promise<ListResponse<Supply>> {
  const { data } = await api.get<ListResponse<Supply>>('supplies', { params: { limit: 200 } })
  return data
}

export async function createSupply(payload: Omit<Supply, 'id' | 'createdAt' | 'updatedAt' | 'branch'>): Promise<Supply> {
  const { data } = await api.post<Supply>('supplies', payload)
  return data
}

export async function updateSupply(id: string, payload: Partial<Supply>): Promise<Supply> {
  const { data } = await api.patch<Supply>(`supplies/${id}`, payload)
  return data
}

export async function deleteSupply(id: string): Promise<void> {
  await api.delete(`supplies/${id}`)
}

export async function adjustSupplyStock(id: string, quantity: number, notes?: string): Promise<Supply> {
  const { data } = await api.patch<Supply>(`supplies/${id}/stock`, { quantity, notes })
  return data
}

export async function fetchSupplyMovements(id: string): Promise<SupplyMovement[]> {
  const { data } = await api.get<SupplyMovement[]>(`supplies/${id}/movements`)
  return data
}
