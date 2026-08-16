import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  downloadProductImportTemplate,
  importProductsFromExcel,
  type Product,
  type ImportResult,
} from '@/services/retail/product-service'

export const CATEGORIES = [
  { id: "Computadoras", name: "Computadoras" },
  { id: "Monitores", name: "Monitores" },
  { id: "Periféricos", name: "Periféricos" },
  { id: "Audio", name: "Audio" },
  { id: "Tablets", name: "Tablets" },
  { id: "Impresoras", name: "Impresoras" },
  { id: "Cables", name: "Cables" },
  { id: "Otro", name: "Otro" },
]

export const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Borrador" },
  { value: "ACTIVE", label: "Activo" },
  { value: "ARCHIVED", label: "Archivado" },
]

export const TAX_CODES = [
  { value: "EXCENTO", label: "IVA 0%", rate: 0 },
  { value: "IVA_16", label: "IVA 16%", rate: 16 },
]

export const TAX_RATE_MAP: Record<string, number> = Object.fromEntries(
  TAX_CODES.map((t) => [t.value, t.rate]),
)

export const PRODUCT_TYPE_OPTIONS = [
  { value: 'SIMPLE', label: 'Producto Simple' },
  { value: 'RECIPE', label: 'Receta / Preparado' },
  { value: 'COMBO', label: 'Combo / Paquete' },
  { value: 'SERVICE', label: 'Servicio' },
]

export const EMPTY_FORM: Product = {
  type: "SIMPLE",
  sku: "",
  name: "",
  description: "",
  price: 0,
  comparePrice: 0,
  costPrice: 0,
  categoryId: "",
  status: "DRAFT",
  stock: 0,
  trackInventory: true,
  lowStockAlert: 5,
  metaTitle: "",
  metaDescription: "",
  taxRate: 0,
  taxCode: "IVA_16",
  slug: "",
  isEcommerce: false,
  recipe: null,
  comboItems: [],
  attributes: [],
  features: [],
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState("Todas")
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Product>(EMPTY_FORM)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProducts()
      setProducts(data?.data || [])
    } catch {
      setError('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    console.log(products)
    return products?.filter(r => {
      const matchSearch = !q || r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
      const matchCat = catFilter === "Todas" || r.categoryId === catFilter
      return matchSearch && matchCat
    })
  }, [search, catFilter, products])

  const pageData = useMemo(() => {
    const PER_PAGE = 7
    const start = (page - 1) * PER_PAGE
    return filtered.slice(start, start + PER_PAGE)
  }, [page, filtered])

  const stats = useMemo(() => ({
    total: products.length,
    ok: products.filter(x => x.status === "ACTIVE" && (!x.trackInventory || x.stock > x.lowStockAlert)).length,
    bajo: products.filter(x => x.status === "ACTIVE" && x.trackInventory && x.stock <= x.lowStockAlert && x.stock > 0).length,
    agotado: products.filter(x => x.trackInventory && x.stock === 0).length,
  }), [products])

  const handleSave = useCallback(async () => {
    try {
      if (editingId) {
        await updateProduct(editingId, form)
      } else {
        await createProduct(form)
      }
      await loadProducts()
      setModalOpen(false)
      setForm(EMPTY_FORM)
      setEditingId(null)
    } catch (e) {
      console.error(e)
    }
  }, [editingId, form, loadProducts])

  const handleEdit = useCallback((p: Product) => {
    setForm(p)
    setEditingId(p.id || null)
    setModalOpen(true)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar producto?')) return
    try {
      await deleteProduct(id)
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch (e) {
      console.error(e)
    }
  }, [])

  const handleOpenNew = useCallback(() => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setModalOpen(true)
  }, [])

  /** Abre el modal de alta prellenado con un borrador del AI Product Assistant (§07) — el usuario sigue revisando y confirmando en el mismo formulario de siempre. */
  const handleOpenWithDraft = useCallback((patch: Partial<Product>) => {
    setForm({ ...EMPTY_FORM, ...patch })
    setEditingId(null)
    setModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
  }, [])

  const handleDownloadTemplate = useCallback(async () => {
    try {
      await downloadProductImportTemplate()
    } catch (e) {
      console.error(e)
    }
  }, [])

  const handleImportFile = useCallback(async (file: File) => {
    setImporting(true)
    setImportError(null)
    setImportResult(null)
    try {
      const result = await importProductsFromExcel(file)
      setImportResult(result)
      await loadProducts()
    } catch (e) {
      console.error(e)
      setImportError('No se pudo importar el archivo. Verifica que sea un .xlsx válido.')
    } finally {
      setImporting(false)
    }
  }, [loadProducts])

  const clearImportResult = useCallback(() => {
    setImportResult(null)
    setImportError(null)
  }, [])

  return {
    products,
    loading,
    error,
    search,
    setSearch,
    catFilter,
    setCatFilter,
    page,
    setPage,
    modalOpen,
    editingId,
    form,
    setForm,
    filtered,
    pageData,
    stats,
    categorias: ["Todas", ...CATEGORIES.map(c => c.name)],
    handleSave,
    handleEdit,
    handleDelete,
    handleOpenNew,
    handleOpenWithDraft,
    handleCloseModal,
    loadProducts,
    importing,
    importResult,
    importError,
    handleDownloadTemplate,
    handleImportFile,
    clearImportResult,
  }
}