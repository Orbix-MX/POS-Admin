import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Supply } from '@/services/retail/supplies-service'
import type { MeasurementUnit } from '@/services/retail/measurement-units-service'
import {
  fetchSupplies, createSupply, updateSupply, deleteSupply, adjustSupplyStock,
} from '@/services/retail/supplies-service'
import { fetchMeasurementUnits } from '@/services/retail/measurement-units-service'

export type SupplyFormState = {
  name: string
  sku: string
  unit: string
  baseUnitId: string | null
  inventoryUnitId: string | null
  conversionFactor: number
  stock: number
  minStock: number
  cost: number
  status: 'ACTIVE' | 'INACTIVE'
  branchId?: string
}

const EMPTY_FORM: SupplyFormState = {
  name: '',
  sku: '',
  unit: '',
  baseUnitId: null,
  inventoryUnitId: null,
  conversionFactor: 1,
  stock: 0,
  minStock: 0,
  cost: 0,
  status: 'ACTIVE',
}

const PER_PAGE = 8

export function useSupplies() {
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [measurementUnits, setMeasurementUnits] = useState<MeasurementUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SupplyFormState>({ ...EMPTY_FORM })

  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustQty, setAdjustQty] = useState(0)
  const [adjustNotes, setAdjustNotes] = useState('')

  const loadSupplies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, units] = await Promise.all([fetchSupplies(), fetchMeasurementUnits()])
      setSupplies(res.data || [])
      setMeasurementUnits(units)
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
    const convFactor = Number(s.conversionFactor ?? 1) || 1
    setForm({
      name: s.name,
      sku: s.sku,
      unit: s.unit,
      baseUnitId: s.baseUnitId ?? null,
      inventoryUnitId: s.inventoryUnitId ?? null,
      conversionFactor: convFactor,
      stock: Number(s.stock) / convFactor,
      minStock: Number(s.minStock) / convFactor,
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
      const convFactor = form.conversionFactor || 1
      const basePayload = {
        ...form,
        stock: form.stock * convFactor,
        minStock: form.minStock * convFactor,
      }
      if (editingId) {
        const { sku: _sku, ...updatePayload } = basePayload
        await updateSupply(editingId, updatePayload)
      } else {
        await createSupply(basePayload as any)
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
    const adjustingSupply = supplies.find((s) => s.id === adjustingId)
    // Send the inventoryUnit symbol so the backend converts to baseUnit automatically
    const unit = adjustingSupply?.inventoryUnit?.symbol ?? adjustingSupply?.unit
    try {
      await adjustSupplyStock(adjustingId, adjustQty, adjustNotes || undefined, unit)
      setAdjustModalOpen(false)
      setAdjustingId(null)
      await loadSupplies()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al ajustar stock')
    }
  }, [adjustingId, adjustQty, adjustNotes, supplies, loadSupplies])

  return {
    supplies, loading, error, search, setSearch, page, setPage,
    filtered, pageData, stats, perPage: PER_PAGE,
    measurementUnits,
    modalOpen, editingId, form, setForm,
    handleOpenNew, handleEdit, handleCloseModal, handleSave, handleDelete,
    adjustModalOpen, setAdjustModalOpen, adjustingId, adjustQty, setAdjustQty,
    adjustNotes, setAdjustNotes, handleOpenAdjust, handleAdjust,
    loadSupplies,
  }
}
