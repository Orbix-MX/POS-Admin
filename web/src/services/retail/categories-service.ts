import { api } from '@/lib/api-client'

export interface Category {
  id?: string
  name: string
  slug: string
  description: string
  parentId: string | null
  status: 'ACTIVE' | 'INACTIVE'
  sortOrder: number
}

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>('/categories')
  return data
}

export async function createCategory(data: Omit<Category, 'id'>): Promise<Category> {
  const { data: result } = await api.post<Category>('/categories', data)
  return result
}

export async function updateCategory(id: string, data: Omit<Category, 'id'>): Promise<Category> {
  const { data: result } = await api.put<Category>(`/categories/${id}`, data)
  return result
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/categories/${id}`)
}
