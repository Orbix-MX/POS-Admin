import { api } from '@/lib/api-client'

export type ProductAttributeType = 'TEXT' | 'SELECT'

export interface ProductAttribute {
  id?: string
  name: string
  slug: string
  type: ProductAttributeType
  options: string[]
  sortOrder: number
  isActive: boolean
}

export async function fetchProductAttributes(): Promise<ProductAttribute[]> {
  const { data } = await api.get<ProductAttribute[]>('/product-attributes')
  return data
}

export async function createProductAttribute(data: Omit<ProductAttribute, 'id'>): Promise<ProductAttribute> {
  const { data: result } = await api.post<ProductAttribute>('/product-attributes', data)
  return result
}

export async function updateProductAttribute(id: string, data: Omit<ProductAttribute, 'id'>): Promise<ProductAttribute> {
  const { data: result } = await api.patch<ProductAttribute>(`/product-attributes/${id}`, data)
  return result
}

export async function deleteProductAttribute(id: string): Promise<void> {
  await api.delete(`/product-attributes/${id}`)
}
