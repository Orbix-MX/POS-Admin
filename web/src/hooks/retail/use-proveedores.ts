import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  fetchProveedores, createProveedor, updateProveedor, deleteProveedor
} from '@/services/retail/proveedores-service'
import type { Proveedor, CreateProveedorInput, UpdateProveedorInput } from '@/services/retail/proveedores-service'

export type { Proveedor }

const EMPTY_FORM = {
  nombre: '',
  contacto: '',
  email: '',
  telefono: '',
  ciudad: '',
  plazo: '',
  categoria: '',
}

const PER_PAGE = 6

export function useProveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selected, setSelected] = useState<Proveedor | null>(null)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const loadProveedores = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProveedores()
      setProveedores(data)
    } catch {
      setError('Error al cargar proveedores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProveedores() }, [loadProveedores])

  const filtered = useMemo(() => {
    return proveedores.filter(r => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        r.nombre.toLowerCase().includes(q) ||
        r.contacto.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'Todos' || r.estado === statusFilter
      return matchSearch && matchStatus
    })
  }, [search, statusFilter, proveedores])

  const pageData = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [page, filtered]
  )

  // js-combine-iterations: single pass for all stats
  const stats = useMemo(() => {
    let activos = 0, inactivos = 0, gastoTotal = 0
    for (const p of proveedores) {
      gastoTotal += parseFloat(p.comprasTotal.replace(/[$,]/g, ''))
      if (p.estado === 'Activo') activos++
      else inactivos++
    }
    return { total: proveedores.length, activos, inactivos, gastoTotal }
  }, [proveedores])

  const buildCreateInput = useCallback((f: typeof EMPTY_FORM): CreateProveedorInput => ({
    name: f.nombre,
    contactName: f.contacto || undefined,
    email: f.email,
    phone: f.telefono || undefined,
    city: f.ciudad || undefined,
    category: f.categoria || undefined,
    paymentTerms: f.plazo || undefined,
  }), [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await createProveedor(buildCreateInput(form))
      await loadProveedores()
      setModalOpen(false)
      setForm(EMPTY_FORM)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }, [form, loadProveedores, buildCreateInput])

  const handleOpenNew = useCallback(() => {
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
    setForm(EMPTY_FORM)
  }, [])

  const handleOpenEdit = useCallback((proveedor: Proveedor) => {
    setEditing(proveedor)
    setEditForm({
      nombre: proveedor.nombre,
      contacto: proveedor.contacto,
      email: proveedor.email,
      telefono: proveedor.telefono,
      ciudad: proveedor.ciudad,
      plazo: proveedor.plazo,
      categoria: proveedor.categoria,
    })
    setSelected(null)
    setEditModalOpen(true)
  }, [])

  const handleCloseEdit = useCallback(() => {
    setEditModalOpen(false)
    setEditing(null)
    setEditForm(EMPTY_FORM)
  }, [])

  const handleUpdate = useCallback(async () => {
    if (!editing) return
    setSaving(true)
    try {
      const input: UpdateProveedorInput = {
        name: editForm.nombre,
        contactName: editForm.contacto || undefined,
        email: editForm.email,
        phone: editForm.telefono || undefined,
        city: editForm.ciudad || undefined,
        category: editForm.categoria || undefined,
        paymentTerms: editForm.plazo || undefined,
      }
      await updateProveedor(editing.id, input)
      await loadProveedores()
      handleCloseEdit()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }, [editing, editForm, loadProveedores, handleCloseEdit])

  const handleDelete = useCallback(async (id: string) => {
    setSaving(true)
    try {
      await deleteProveedor(id)
      await loadProveedores()
      setSelected(null)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }, [loadProveedores])

  return {
    proveedores,
    loading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    modalOpen,
    editModalOpen,
    selected,
    setSelected,
    editing,
    form,
    setForm,
    editForm,
    setEditForm,
    filtered,
    pageData,
    stats,
    saving,
    handleSave,
    handleOpenNew,
    handleCloseModal,
    handleOpenEdit,
    handleCloseEdit,
    handleUpdate,
    handleDelete,
    loadProveedores,
  }
}
