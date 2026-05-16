import type { ListResponse } from '@/interfaces/list-response'
import { api } from '@/lib/api-client'

export interface Product {
  id?: string
  sku: string
  name: string
  description: string
  price: number
  comparePrice: number
  costPrice: number
  categoryId: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  stock: number
  trackInventory: boolean
  lowStockAlert: number
  metaTitle: string
  metaDescription: string
  taxRate: number
  taxCode: string
  slug: string
}

export async function fetchProducts(): Promise<ListResponse<Product>> {
  const { data } = await api.get<ListResponse<Product>>('products')
  return data
}

export async function createProduct(data: Product): Promise<Product> {
  const { data: result } = await api.post<Product>('products', data)
  return result
}

type UpdateProductBody = Pick<Product,
  'name' | 'description' | 'price' | 'comparePrice' | 'costPrice' |
  'categoryId' | 'status' | 'stock' | 'trackInventory' | 'lowStockAlert' |
  'metaTitle' | 'metaDescription' | 'taxRate' | 'taxCode'
>

export async function updateProduct(id: string, data: Product): Promise<Product> {
  const body: UpdateProductBody = {
    name: data.name,
    description: data.description,
    price: data.price,
    comparePrice: data.comparePrice,
    costPrice: data.costPrice,
    categoryId: data.categoryId,
    status: data.status,
    stock: data.stock,
    trackInventory: data.trackInventory,
    lowStockAlert: data.lowStockAlert,
    metaTitle: data.metaTitle,
    metaDescription: data.metaDescription,
    taxRate: data.taxRate,
    taxCode: data.taxCode,
  }
  const { data: result } = await api.patch<Product>(`products/${id}`, body)
  return result
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`products/${id}`)
}
