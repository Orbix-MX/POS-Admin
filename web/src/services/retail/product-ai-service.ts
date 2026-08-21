import { api } from '@/lib/api-client'

export interface ProductDraftResponse {
  aiRequestId: string
  degradations: string[]
  name: string
  description: string | null
  price: number
  comparePrice: number | null
  costPrice: number | null
  taxCode: string
  trackInventory: boolean | null
  lowStockAlert: number | null
  confidence: number
  category: { name: string; id: string | null }
  skuSuggestion: string
  unresolved: string[]
  conflicts: string[]
}

export async function getProductDraft(message: string): Promise<ProductDraftResponse> {
  const { data } = await api.post<ProductDraftResponse>('ai/products/draft', { message })
  return data
}
