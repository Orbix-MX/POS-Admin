import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  fetchProductAttributes,
  createProductAttribute,
  updateProductAttribute,
  deleteProductAttribute,
} from '@/services/retail/product-attributes-service'
import type { ProductAttribute } from '@/services/retail/product-attributes-service'

export type { ProductAttribute }

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

type AttributeForm = Omit<ProductAttribute, 'id'>

const EMPTY_FORM: AttributeForm = {
  name: '',
  slug: '',
  type: 'TEXT',
  options: [],
  sortOrder: 0,
  isActive: true,
}

const PER_PAGE = 8

export function useProductAttributes() {
  const [attributes, setAttributes] = useState<ProductAttribute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AttributeForm>(EMPTY_FORM)

  const loadAttributes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProductAttributes()
      setAttributes(data)
    } catch {
      setError('Error al cargar atributos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAttributes() }, [loadAttributes])

  const filtered = useMemo(() => {
    if (!search) return attributes
    const q = search.toLowerCase()
    return attributes.filter(a =>
      a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q)
    )
  }, [search, attributes])

  const pageData = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [page, filtered]
  )

  // js-combine-iterations: single pass for stats
  const stats = useMemo(() => {
    let active = 0, inactive = 0
    for (const a of attributes) {
      if (a.isActive) active++
      else inactive++
    }
    return { total: attributes.length, active, inactive }
  }, [attributes])

  // Auto-slug from name when slug hasn't been manually set
  const setName = useCallback((name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === toSlug(prev.name) ? toSlug(name) : prev.slug,
    }))
  }, [])

  const handleSave = useCallback(async () => {
    try {
      if (editingId) {
        await updateProductAttribute(editingId, form)
      } else {
        await createProductAttribute(form)
      }
      await loadAttributes()
      setModalOpen(false)
      setForm(EMPTY_FORM)
      setEditingId(null)
    } catch (e) {
      console.error(e)
    }
  }, [editingId, form, loadAttributes])

  const handleEdit = useCallback((attribute: ProductAttribute) => {
    const { id, ...rest } = attribute
    setForm(rest)
    setEditingId(id ?? null)
    setModalOpen(true)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar este atributo?')) return
    try {
      await deleteProductAttribute(id)
      setAttributes(prev => prev.filter(a => a.id !== id))
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
    attributes,
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
    loadAttributes,
  }
}
