import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/retail/categories-service'
import type { Category } from '@/services/retail/categories-service'

export type { Category }

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

type CategoryForm = Omit<Category, 'id'>

const EMPTY_FORM: CategoryForm = {
  name: '',
  slug: '',
  description: '',
  parentId: null,
  status: 'ACTIVE',
  sortOrder: 0,
}

const PER_PAGE = 8

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM)

  const loadCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCategories()
      setCategories(data)
    } catch {
      setError('Error al cargar categorías')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])

  const filtered = useMemo(() => {
    if (!search) return categories
    const q = search.toLowerCase()
    return categories.filter(c =>
      c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    )
  }, [search, categories])

  const pageData = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [page, filtered]
  )

  // js-combine-iterations: single pass for stats
  const stats = useMemo(() => {
    let active = 0, inactive = 0
    for (const c of categories) {
      if (c.status === 'ACTIVE') active++
      else inactive++
    }
    return { total: categories.length, active, inactive }
  }, [categories])

  // Auto-slug from name when slug hasn't been manually set
  const setName = useCallback((name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === toSlug(prev.name) ? toSlug(name) : prev.slug,
    }))
  }, [])

  const handleSave = useCallback(async () => {
    // `form` puede traer campos de solo lectura (parent, images, _count,
    // tenantId...) heredados del objeto completo que devuelve la API al
    // editar — el backend rechaza cualquier propiedad fuera del DTO.
    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description,
      parentId: form.parentId,
      status: form.status,
      sortOrder: form.sortOrder,
    }
    try {
      if (editingId) {
        await updateCategory(editingId, payload)
      } else {
        await createCategory(payload)
      }
      await loadCategories()
      setModalOpen(false)
      setForm(EMPTY_FORM)
      setEditingId(null)
    } catch (e) {
      console.error(e)
    }
  }, [editingId, form, loadCategories])

  const handleEdit = useCallback((cat: Category) => {
    const { id, ...rest } = cat
    setForm(rest)
    setEditingId(id ?? null)
    setModalOpen(true)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar esta categoría?')) return
    try {
      await deleteCategory(id)
      setCategories(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      console.error(e)
    }
  }, [])

  const handleOpenNew = useCallback(() => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
  }, [])

  return {
    categories,
    loading,
    error,
    search,
    setSearch,
    page,
    setPage,
    modalOpen,
    editingId,
    form,
    setForm,
    setName,
    filtered,
    pageData,
    stats,
    perPage: PER_PAGE,
    handleSave,
    handleEdit,
    handleDelete,
    handleOpenNew,
    handleCloseModal,
    loadCategories,
  }
}
