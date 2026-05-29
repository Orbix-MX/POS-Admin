import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Supply } from '@/services/retail/supplies-service'
import {
  fetchSupplies, createSupply, updateSupply, deleteSupply, adjustSupplyStock,
} from '@/services/retail/supplies-service'

const EMPTY_FORM: Omit<Supply, 'id' | 'createdAt' | 'updatedAt' | 'branch'> = {
  name: '',
  sku: '',
  unit: '',
  stock: 0,
  minStock: 0,
  cost: 0,
  status: 'ACTIVE',
}

export const SUPPLY_UNITS = [
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'gr', label: 'Gramo (gr)' },
  { value: 'lt', label: 'Litro (lt)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'pieza', label: 'Pieza' },
  { value: 'porcion', label: 'Porción' },
  { value: 'caja', label: 'Caja' },
  { value: 'bolsa', label: 'Bolsa' },
  { value: 'rollo', label: 'Rollo' },
]

const PER_PAGE = 8

export function useSupplies() {
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM })

  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustQty, setAdjustQty] = useState(0)
  const [adjustNotes, setAdjustNotes] = useState('')

  const loadSupplies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchSupplies()
      setSupplies(res.data || [])
    } catch {
      setError('Error al cargar insumos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSupplies() }, [loadSupplies])

  const filtered = useMemo(() => {
    if (!search) return supplies
    const q = search.toLowerCase()
    return supplies.filter(
      (s) => s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q),
    )
  }, [supplies, search])

  const pageData = useMemo(() => {
    const start = (page - 1) * PER_PAGE
    return filtered.slice(start, start + PER_PAGE)
  }, [filtered, page])

  const stats = useMemo(() => {
    let total = 0, active = 0, lowStock = 0
    for (const s of supplies) {
      total++
      if (s.status === 'ACTIVE') active++
      if (Number(s.stock) <= Number(s.minStock)) lowStock++
    }
    return { total, active, lowStock }
  }, [supplies])

  const handleOpenNew = useCallback(() => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }, [])

  const handleEdit = useCallback((id: string) => {
    const s = supplies.find((x) => x.id === id)
    if (!s) return
    setEditingId(id)
    setForm({
      name: s.name,
      sku: s.sku,
      unit: s.unit,
      stock: Number(s.stock),
      minStock: Number(s.minStock),
      cost: Number(s.cost),
      status: s.status,
      branchId: s.branchId,
    })
    setModalOpen(true)
  }, [supplies])

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
  }, [])

  const handleSave = useCallback(async () => {
    try {
      if (editingId) {
        await updateSupply(editingId, form)
      } else {
        await createSupply(form)
      }
      handleCloseModal()
      await loadSupplies()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al guardar insumo')
    }
  }, [editingId, form, handleCloseModal, loadSupplies])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar este insumo?')) return
    try {
      await deleteSupply(id)
      await loadSupplies()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al eliminar insumo')
    }
  }, [loadSupplies])

  const handleOpenAdjust = useCallback((id: string) => {
    setAdjustingId(id)
    setAdjustQty(0)
    setAdjustNotes('')
    setAdjustModalOpen(true)
  }, [])

  const handleAdjust = useCallback(async () => {
    if (!adjustingId || adjustQty === 0) return
    try {
      await adjustSupplyStock(adjustingId, adjustQty, adjustNotes || undefined)
      setAdjustModalOpen(false)
      setAdjustingId(null)
      await loadSupplies()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al ajustar stock')
    }
  }, [adjustingId, adjustQty, adjustNotes, loadSupplies])

  return {
    supplies, loading, error, search, setSearch, page, setPage,
    filtered, pageData, stats, perPage: PER_PAGE,
    modalOpen, editingId, form, setForm,
    handleOpenNew, handleEdit, handleCloseModal, handleSave, handleDelete,
    adjustModalOpen, setAdjustModalOpen, adjustingId, adjustQty, setAdjustQty,
    adjustNotes, setAdjustNotes, handleOpenAdjust, handleAdjust,
    loadSupplies,
  }
}
