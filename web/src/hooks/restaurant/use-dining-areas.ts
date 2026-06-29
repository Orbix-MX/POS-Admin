import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchDiningAreas, createDiningArea, updateDiningArea,
} from '@/services/restaurant/dining-areas-service'
import type { DiningArea, CreateDiningAreaInput, UpdateDiningAreaInput } from '@/services/restaurant/dining-areas-service'
import { useAuthStore } from '@/store/auth-store'

export type { DiningArea }

const EMPTY_FORM: CreateDiningAreaInput & { isActive?: boolean } = {
  name: '',
  description: '',
  displayOrder: 0,
}

export function useDiningAreas() {
  const currentBranch = useAuthStore((s) => s.currentBranch)
  const branchId = currentBranch?.id ?? null

  const [areas, setAreas] = useState<DiningArea[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DiningArea | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true); setError(null)
    try {
      setAreas(await fetchDiningAreas(branchId))
    } catch {
      setError('No se pudieron cargar las áreas.')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() =>
    areas.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())),
    [areas, search])

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setSaveError(null)
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((area: DiningArea) => {
    setEditTarget(area)
    setForm({ name: area.name, description: area.description ?? '', displayOrder: area.displayOrder })
    setSaveError(null)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => { setModalOpen(false); setEditTarget(null) }, [])

  const handleSave = useCallback(async () => {
    if (!branchId || !form.name.trim()) return
    setSaving(true); setSaveError(null)
    try {
      if (editTarget) {
        const updated = await updateDiningArea(branchId, editTarget.id, { name: form.name.trim(), description: form.description, displayOrder: form.displayOrder })
        setAreas((prev) => prev.map((a) => a.id === updated.id ? updated : a))
      } else {
        const created = await createDiningArea(branchId, { name: form.name.trim(), description: form.description, displayOrder: form.displayOrder })
        setAreas((prev) => [...prev, created])
      }
      closeModal()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar.'
      setSaveError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? msg)
    } finally {
      setSaving(false)
    }
  }, [branchId, form, editTarget, closeModal])

  const toggleActive = useCallback(async (area: DiningArea) => {
    if (!branchId) return
    try {
      const updated = await updateDiningArea(branchId, area.id, { isActive: !area.isActive })
      setAreas((prev) => prev.map((a) => a.id === updated.id ? updated : a))
    } catch {
      /* ignore */
    }
  }, [branchId])

  return {
    areas, filtered, loading, error, search, setSearch,
    branchId, currentBranch,
    modalOpen, editTarget, form, setForm, saving, saveError,
    openCreate, openEdit, closeModal, handleSave, toggleActive,
    reload: load,
  }
}
