import { useState, useMemo, useEffect, useCallback } from 'react'
import { fetchRoles, fetchRol, fetchPermisosFlat, createRol, updateRol, deleteRol } from '@/services/core/roles-service'
import type { Rol, Permiso, CreateRolInput, UpdateRolInput } from '@/services/core/roles-service'

export type { Rol, Permiso }

const EMPTY_FORM = { name: '', description: '', color: '#6366f1', permissionIds: [] as string[] }
const PER_PAGE = 8

export function useRoles() {
  const [roles, setRoles] = useState<Rol[]>([])
  const [permisos, setPermisos] = useState<Permiso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selected, setSelected] = useState<Rol | null>(null)
  const [editing, setEditing] = useState<Rol | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [r, p] = await Promise.all([fetchRoles(), fetchPermisosFlat()])
      setRoles(r)
      setPermisos(p)
    } catch {
      setError('Error al cargar roles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const filtered = useMemo(() => {
    if (!search) return roles
    const q = search.toLowerCase()
    return roles.filter(r => r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q))
  }, [search, roles])

  const pageData = useMemo(() => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE), [page, filtered])

  const togglePerm = useCallback((id: string, current: string[]) => {
    return current.includes(id) ? current.filter(p => p !== id) : [...current, id]
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await createRol(form as CreateRolInput)
      await loadAll()
      setModalOpen(false)
      setForm(EMPTY_FORM)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }, [form, loadAll])

  const handleOpenNew = useCallback(() => { setForm(EMPTY_FORM); setModalOpen(true) }, [])
  const handleCloseModal = useCallback(() => { setModalOpen(false); setForm(EMPTY_FORM) }, [])

  const handleOpenEdit = useCallback(async (rol: Rol) => {
    setSelected(null)
    setEditModalOpen(true)
    const full = await fetchRol(rol.id)
    setEditing(full)
    setEditForm({
      name: full.name,
      description: full.description ?? '',
      color: full.color ?? '#6366f1',
      permissionIds: full.permissions?.map(p => p.permission.id) ?? [],
    })
  }, [])

  const handleCloseEdit = useCallback(() => { setEditModalOpen(false); setEditing(null); setEditForm(EMPTY_FORM) }, [])

  const handleUpdate = useCallback(async () => {
    if (!editing) return
    setSaving(true)
    try {
      await updateRol(editing.id, editForm as UpdateRolInput)
      await loadAll()
      handleCloseEdit()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }, [editing, editForm, loadAll, handleCloseEdit])

  const handleDelete = useCallback(async (id: string) => {
    setSaving(true)
    try {
      await deleteRol(id)
      await loadAll()
      setSelected(null)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }, [loadAll])

  return {
    roles, permisos, loading, error, search, setSearch,
    page, setPage, modalOpen, editModalOpen, selected, setSelected,
    editing, form, setForm, editForm, setEditForm,
    filtered, pageData, saving, togglePerm,
    handleSave, handleOpenNew, handleCloseModal,
    handleOpenEdit, handleCloseEdit, handleUpdate, handleDelete, loadAll,
  }
}
