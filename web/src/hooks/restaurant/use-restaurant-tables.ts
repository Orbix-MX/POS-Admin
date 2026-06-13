import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchTables, createTable, updateTable,
} from '@/services/restaurant/tables-service'
import type { RestaurantTable, TableStatus, CreateTableInput } from '@/services/restaurant/tables-service'
import { fetchDiningAreas } from '@/services/restaurant/dining-areas-service'
import type { DiningArea } from '@/services/restaurant/dining-areas-service'
import { useAuthStore } from '@/store/auth-store'

export type { RestaurantTable, TableStatus }

const EMPTY_FORM: CreateTableInput & { isActive?: boolean } = {
  name: '',
  areaId: '',
  capacity: 4,
  displayOrder: 0,
}

export function useRestaurantTables() {
  const currentBranch = useAuthStore((s) => s.currentBranch)
  const branchId = currentBranch?.id ?? null

  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [areas, setAreas] = useState<DiningArea[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterAreaId, setFilterAreaId] = useState<string>('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RestaurantTable | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true); setError(null)
    try {
      const [tablesData, areasData] = await Promise.all([
        fetchTables(branchId),
        fetchDiningAreas(branchId),
      ])
      setTables(tablesData)
      setAreas(areasData)
    } catch {
      setError('No se pudieron cargar las mesas.')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let result = tables
    if (filterAreaId) result = result.filter((t) => t.areaId === filterAreaId)
    if (search) result = result.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    return result
  }, [tables, filterAreaId, search])

  const tablesByArea = useMemo(() => {
    const activeAreas = areas.filter((a) => a.isActive)
    return activeAreas.map((area) => ({
      area,
      tables: filtered.filter((t) => t.areaId === area.id),
    }))
  }, [areas, filtered])

  const openCreate = useCallback((defaultAreaId?: string) => {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM, areaId: defaultAreaId ?? (areas[0]?.id ?? '') })
    setSaveError(null)
    setModalOpen(true)
  }, [areas])

  const openEdit = useCallback((table: RestaurantTable) => {
    setEditTarget(table)
    setForm({
      name: table.name,
      areaId: table.areaId,
      capacity: table.capacity,
      displayOrder: table.displayOrder,
    })
    setSaveError(null)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => { setModalOpen(false); setEditTarget(null) }, [])

  const handleSave = useCallback(async () => {
    if (!branchId || !form.name.trim() || !form.areaId) return
    setSaving(true); setSaveError(null)
    try {
      if (editTarget) {
        const updated = await updateTable(branchId, editTarget.id, {
          name: form.name.trim(),
          areaId: form.areaId,
          capacity: form.capacity,
          displayOrder: form.displayOrder,
        })
        setTables((prev) => prev.map((t) => t.id === updated.id ? updated : t))
      } else {
        const created = await createTable(branchId, {
          name: form.name.trim(),
          areaId: form.areaId,
          capacity: form.capacity,
          displayOrder: form.displayOrder,
        })
        setTables((prev) => [...prev, created])
      }
      closeModal()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar.'
      setSaveError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? msg)
    } finally {
      setSaving(false)
    }
  }, [branchId, form, editTarget, closeModal])

  const toggleActive = useCallback(async (table: RestaurantTable) => {
    if (!branchId) return
    try {
      const updated = await updateTable(branchId, table.id, { isActive: !table.isActive })
      setTables((prev) => prev.map((t) => t.id === updated.id ? updated : t))
    } catch {
      /* ignore */
    }
  }, [branchId])

  return {
    tables, areas, filtered, tablesByArea, loading, error,
    search, setSearch, filterAreaId, setFilterAreaId,
    branchId, currentBranch,
    modalOpen, editTarget, form, setForm, saving, saveError,
    openCreate, openEdit, closeModal, handleSave, toggleActive,
    reload: load,
  }
}
