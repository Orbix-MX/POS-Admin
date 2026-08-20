import { api } from '@/lib/api-client'

export interface CategoryImage {
  id: string
  url: string
}

export interface Category {
  id?: string
  name: string
  slug: string
  description: string
  parentId: string | null
  status: 'ACTIVE' | 'INACTIVE'
  sortOrder: number
  images?: CategoryImage[]
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
  const { data: result } = await api.patch<Category>(`/categories/${id}`, data)
  return result
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/categories/${id}`)
}

export async function uploadCategoryImage(categoryId: string, file: File): Promise<CategoryImage> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post<CategoryImage>(`/categories/${categoryId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteCategoryImage(categoryId: string, imageId: string): Promise<void> {
  await api.delete(`/categories/${categoryId}/images/${imageId}`)
}
