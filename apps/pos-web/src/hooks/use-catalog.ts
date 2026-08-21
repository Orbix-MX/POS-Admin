import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAllProducts, fetchCategories, fetchSettings, type Category, type Product } from '~/services/orbix'
import { errorMessage } from '~/utils/api-error'

/**
 * Catálogo del POS: productos activos, categorías reales del tenant y la tasa
 * de impuesto por defecto que el backend usa cuando el producto no trae una.
 *
 * Fuente única: los mismos endpoints que consume el Admin Web. El POS no tiene
 * un catálogo aparte.
 */

export interface CatalogCategory {
  id: string
  name: string
  count: number
  /** Índice estable para color e icono, derivado del orden alfabético. */
  index: number
  lowStockCount: number
}

const UNCATEGORIZED = '__none__'

export function useCatalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [defaultTaxRate, setDefaultTaxRate] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prods, cats, settings] = await Promise.all([
        fetchAllProducts(),
        fetchCategories().catch(() => [] as Category[]),
        fetchSettings().catch(() => ({}) as Record<string, unknown>),
      ])
      setProducts(prods.filter((p) => p.status === 'ACTIVE'))
      setCategories(cats)
      setDefaultTaxRate(Number(settings.defaultTaxRate ?? 0) || 0)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const productsById = useMemo(() => {
    const map = new Map<string, Product>()
    for (const p of products) if (p.id) map.set(p.id, p)
    return map
  }, [products])

  /** Categorías con producto: las que realmente se pueden vender hoy. */
  const catalogCategories = useMemo<CatalogCategory[]>(() => {
    const nameById = new Map(categories.map((c) => [c.id ?? '', c.name]))
    const buckets = new Map<string, { name: string; count: number; lowStockCount: number }>()

    for (const p of products) {
      const id = p.categoryId || p.category?.id || UNCATEGORIZED
      const name = p.category?.name ?? nameById.get(id) ?? 'Sin categoría'
      if (!buckets.has(id)) buckets.set(id, { name, count: 0, lowStockCount: 0 })
      const bucket = buckets.get(id)!
      bucket.count++
      if (p.trackInventory && Number(p.stock ?? 0) <= Number(p.lowStockAlert ?? 0)) bucket.lowStockCount++
    }

    return [...buckets.entries()]
      .map(([id, b]) => ({ id, name: b.name, count: b.count, lowStockCount: b.lowStockCount, index: 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((c, index) => ({ ...c, index }))
  }, [products, categories])

  const categoryIndexById = useMemo(() => {
    const map = new Map<string, number>()
    catalogCategories.forEach((c) => map.set(c.id, c.index))
    return map
  }, [catalogCategories])

  const categoryIndexOf = useCallback(
    (product: Product): number => categoryIndexById.get(product.categoryId || product.category?.id || UNCATEGORIZED) ?? 0,
    [categoryIndexById],
  )

  const categoryNameOf = useCallback(
    (product: Product): string => {
      const id = product.categoryId || product.category?.id || UNCATEGORIZED
      return catalogCategories.find((c) => c.id === id)?.name ?? 'Sin categoría'
    },
    [catalogCategories],
  )

  return {
    products,
    productsById,
    categories: catalogCategories,
    categoryIndexOf,
    categoryNameOf,
    defaultTaxRate,
    loading,
    error,
    reload: load,
  }
}

export type CatalogSort = 'relevance' | 'name-asc' | 'price-asc' | 'price-desc' | 'stock-desc'

export const SORT_LABELS: Record<CatalogSort, string> = {
  relevance: 'Relevancia',
  'name-asc': 'Nombre A–Z',
  'price-asc': 'Precio menor',
  'price-desc': 'Precio mayor',
  'stock-desc': 'Mayor existencia',
}

export function sortProducts(list: Product[], sort: CatalogSort): Product[] {
  const copy = [...list]
  switch (sort) {
    case 'name-asc':
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    case 'price-asc':
      return copy.sort((a, b) => Number(a.price) - Number(b.price))
    case 'price-desc':
      return copy.sort((a, b) => Number(b.price) - Number(a.price))
    case 'stock-desc':
      return copy.sort((a, b) => Number(b.stock ?? 0) - Number(a.stock ?? 0))
    default:
      return copy
  }
}

/** Coincidencia por nombre o SKU, igual criterio que el buscador del Admin Web. */
export function matchesQuery(product: Product, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${product.name} ${product.sku}`.toLowerCase().includes(q)
}
