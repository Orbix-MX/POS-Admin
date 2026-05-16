import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  fetchServices, createService, updateService,
  type Service, type CreateServicePayload,
} from '@/services/retail/services-service'

const BLANK: CreateServicePayload = {
  name: '',
  description: '',
  basePrice: 0,
  estimatedDuration: '',
  hasVariablePrice: false,
  isActive: true,
}

export function useServicios() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const perPage = 15

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState<CreateServicePayload>(BLANK)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchServices({ limit: 200 })
      setServices(res.data ?? [])
    } catch {
      setError('Error al cargar servicios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return services.filter((s) => {
      if (filterActive === 'active' && !s.isActive) return false
      if (filterActive === 'inactive' && s.isActive) return false
      if (q && !s.name.toLowerCase().includes(q) && !(s.description ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [services, search, filterActive])

  const pageData = useMemo(() => {
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page])

  const openCreate = useCallback(() => {
    setEditing(null)
    setForm(BLANK)
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((s: Service) => {
    setEditing(s)
    setForm({
      name: s.name,
      description: s.description ?? '',
      basePrice: Number(s.basePrice),
      estimatedDuration: s.estimatedDuration ?? '',
      hasVariablePrice: s.hasVariablePrice,
      isActive: s.isActive,
    })
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditing(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const updated = await updateService(editing.id, form)
        setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      } else {
        const created = await createService(form)
        setServices((prev) => [created, ...prev])
      }
      closeModal()
    } catch {
      alert('Error al guardar servicio')
    } finally {
      setSaving(false)
    }
  }, [form, editing, closeModal])

  const toggleActive = useCallback(async (s: Service) => {
    try {
      const updated = await updateService(s.id, { isActive: !s.isActive })
      setServices((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    } catch {
      alert('Error al actualizar servicio')
    }
  }, [])

  return {
    services, loading, error,
    search, setSearch,
    filterActive, setFilterActive,
    page, setPage, perPage,
    filtered, pageData,
    modalOpen, editing, form, setForm, saving,
    openCreate, openEdit, closeModal, handleSave,
    toggleActive,
  }
}
