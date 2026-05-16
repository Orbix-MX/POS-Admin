import { useState, useMemo, useEffect, useCallback } from 'react'
import { fetchClientes, createCliente, updateCliente, deleteCliente } from '@/services/core/clientes-service'
import type { Cliente, CreateClienteInput, UpdateClienteInput } from '@/services/core/clientes-service'

export type { Cliente }

const EMPTY_FORM = {
  nombre: '',
  empresa: '',
  email: '',
  telefono: '',
  ciudad: '',
  hasCredit: false,
  creditDays: '',
  creditLimit: '',
}

const PER_PAGE = 6

export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selected, setSelected] = useState<Cliente | null>(null)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const loadClientes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchClientes()
      setClientes(data)
    } catch {
      setError('Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadClientes() }, [loadClientes])

  const filtered = useMemo(() => {
    return clientes.filter(r => {
      const q = search.toLowerCase()
      const matchSearch = !q || r.nombre.toLowerCase().includes(q) || r.empresa.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'Todos' || r.estado === statusFilter
      return matchSearch && matchStatus
    })
  }, [search, statusFilter, clientes])

  const pageData = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [page, filtered]
  )

  // js-combine-iterations: single pass for all stats
  const stats = useMemo(() => {
    let activos = 0, inactivos = 0, valorTotal = 0
    for (const c of clientes) {
      valorTotal += parseFloat(c.totalCompras.replace(/[$,]/g, ''))
      if (c.estado === 'Activo') activos++
      else inactivos++
    }
    return { total: clientes.length, activos, inactivos, valorTotal }
  }, [clientes])

  const buildCreateInput = useCallback((f: typeof EMPTY_FORM): CreateClienteInput => {
    const parts = f.nombre.trim().split(' ')
    const hasCredit = f.hasCredit
    return {
      firstName: parts[0] ?? '',
      lastName: (parts.slice(1).join(' ') || parts[0]) ?? '',
      email: f.email,
      phone: f.telefono || undefined,
      company: f.empresa || undefined,
      city: f.ciudad || undefined,
      hasCredit,
      creditDays: hasCredit ? (parseInt(f.creditDays) || 0) : 0,
      creditLimit: hasCredit && f.creditLimit !== '' ? parseFloat(f.creditLimit) : undefined,
    }
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await createCliente(buildCreateInput(form))
      await loadClientes()
      setModalOpen(false)
      setForm(EMPTY_FORM)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }, [form, loadClientes, buildCreateInput])

  const handleOpenNew = useCallback(() => {
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
    setForm(EMPTY_FORM)
  }, [])

  const handleOpenEdit = useCallback((cliente: Cliente) => {
    setEditing(cliente)
    setEditForm({
      nombre: cliente.nombre,
      empresa: cliente.empresa,
      email: cliente.email,
      telefono: cliente.telefono,
      ciudad: cliente.ciudad,
      hasCredit: cliente.hasCredit ?? false,
      creditDays: cliente.creditDays ? String(cliente.creditDays) : '',
      creditLimit: cliente.creditLimit != null ? String(cliente.creditLimit) : '',
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
      const parts = editForm.nombre.trim().split(' ')
      const hasCredit = editForm.hasCredit
      const input: UpdateClienteInput = {
        firstName: parts[0] ?? '',
        lastName: (parts.slice(1).join(' ') || parts[0]) ?? '',
        email: editForm.email,
        phone: editForm.telefono || undefined,
        company: editForm.empresa || undefined,
        city: editForm.ciudad || undefined,
        hasCredit,
        creditDays: hasCredit ? (parseInt(editForm.creditDays) || 0) : 0,
        creditLimit: hasCredit && editForm.creditLimit !== ''
          ? parseFloat(editForm.creditLimit)
          : hasCredit ? undefined : null,
      }
      await updateCliente(editing.id, input)
      await loadClientes()
      handleCloseEdit()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }, [editing, editForm, loadClientes, handleCloseEdit])

  const handleDelete = useCallback(async (id: string) => {
    setSaving(true)
    try {
      await deleteCliente(id)
      await loadClientes()
      setSelected(null)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }, [loadClientes])

  return {
    clientes,
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
    loadClientes,
  }
}
