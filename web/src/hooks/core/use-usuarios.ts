import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  fetchUsuarios, createUsuario, updateUsuario, deleteUsuario, setUserRoles,
  activateUsuario, deactivateUsuario, fetchUserCapacity,
} from '@/services/core/users-service'
import type { Usuario, UpdateUsuarioInput, UserCapacity, MembershipStatus } from '@/services/core/users-service'
import { isPasswordValid } from '@/lib/password-policy'

export type { Usuario }

type FormState = { firstName: string; lastName: string; email: string; password: string; roleId: string; status: MembershipStatus }
type EditFormState = { firstName: string; lastName: string; email: string; roleId: string; status: MembershipStatus }

function errMessage(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
}

const EMPTY_FORM: FormState = { firstName: '', lastName: '', email: '', password: '', roleId: '', status: 'ACTIVE' }
const EMPTY_EDIT: EditFormState = { firstName: '', lastName: '', email: '', roleId: '', status: 'ACTIVE' }

const PER_PAGE = 8

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [capacity, setCapacity] = useState<UserCapacity | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [rolFilter, setRolFilter] = useState('Todos')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selected, setSelected] = useState<Usuario | null>(null)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT)
  const [saving, setSaving] = useState(false)

  const loadUsuarios = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, cap] = await Promise.all([fetchUsuarios(), fetchUserCapacity()])
      setUsuarios(list)
      setCapacity(cap)
    } catch {
      setError('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsuarios() }, [loadUsuarios])

  const filtered = useMemo(() => usuarios.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRol = rolFilter === 'Todos' || u.rol === rolFilter
    return matchSearch && matchRol
  }), [search, rolFilter, usuarios])

  const pageData = useMemo(() => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE), [page, filtered])

  // js-combine-iterations: single pass
  const stats = useMemo(() => {
    let activos = 0, inactivos = 0, admins = 0
    for (const u of usuarios) {
      if (u.estado === 'Activo') activos++
      else inactivos++
      if (u.rolRaw === 'ADMIN' || u.rolRaw === 'SUPER_ADMIN') admins++
    }
    return { total: usuarios.length, activos, inactivos, admins }
  }, [usuarios])

  const handleSave = useCallback(async () => {
    // Se comprueba aquí además de en el API: así el aviso es inmediato y no
    // depende de un 400. La validación que protege sigue siendo la del backend.
    if (!isPasswordValid(form.password)) {
      setActionError('La contraseña no cumple los requisitos indicados.')
      return
    }
    setSaving(true)
    setActionError(null)
    try {
      const newUser = await createUsuario({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        role: 'STAFF',
        status: form.status,
      })
      if (form.roleId) await setUserRoles(newUser.id, [form.roleId])
      await loadUsuarios()
      setModalOpen(false)
      setForm(EMPTY_FORM)
    } catch (e) {
      setActionError(errMessage(e, 'No se pudo crear el usuario'))
    }
    finally { setSaving(false) }
  }, [form, loadUsuarios])

  const handleActivate = useCallback(async (id: string) => {
    setSaving(true)
    setActionError(null)
    try {
      await activateUsuario(id)
      await loadUsuarios()
      setSelected(null)
    } catch (e) {
      setActionError(errMessage(e, 'No se pudo activar el usuario'))
    }
    finally { setSaving(false) }
  }, [loadUsuarios])

  const handleDeactivate = useCallback(async (id: string) => {
    setSaving(true)
    setActionError(null)
    try {
      await deactivateUsuario(id)
      await loadUsuarios()
      setSelected(null)
    } catch (e) {
      setActionError(errMessage(e, 'No se pudo desactivar el usuario'))
    }
    finally { setSaving(false) }
  }, [loadUsuarios])

  const handleOpenNew = useCallback(() => { setForm(EMPTY_FORM); setModalOpen(true) }, [])
  const handleCloseModal = useCallback(() => { setModalOpen(false); setForm(EMPTY_FORM) }, [])

  const handleOpenEdit = useCallback((u: Usuario) => {
    setEditing(u)
    setEditForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, roleId: u.roleId ?? '', status: u.statusRaw })
    setSelected(null)
    setEditModalOpen(true)
  }, [])

  const handleCloseEdit = useCallback(() => { setEditModalOpen(false); setEditing(null); setEditForm(EMPTY_EDIT) }, [])

  const handleUpdate = useCallback(async () => {
    if (!editing) return
    setSaving(true)
    try {
      const { roleId, ...rest } = editForm
      await updateUsuario(editing.id, rest as UpdateUsuarioInput)
      await setUserRoles(editing.id, roleId ? [roleId] : [])
      await loadUsuarios()
      handleCloseEdit()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }, [editing, editForm, loadUsuarios, handleCloseEdit])

  const handleDelete = useCallback(async (id: string) => {
    setSaving(true)
    setActionError(null)
    try {
      await deleteUsuario(id)
      await loadUsuarios()
      setSelected(null)
    } catch (e) {
      setActionError(errMessage(e, 'No se pudo eliminar el usuario'))
    }
    finally { setSaving(false) }
  }, [loadUsuarios])

  return {
    usuarios, capacity, actionError, setActionError,
    loading, error, search, setSearch, rolFilter, setRolFilter,
    page, setPage, modalOpen, editModalOpen, selected, setSelected,
    editing, form, setForm, editForm, setEditForm,
    filtered, pageData, stats, saving,
    handleSave, handleOpenNew, handleCloseModal,
    handleOpenEdit, handleCloseEdit, handleUpdate, handleDelete,
    handleActivate, handleDeactivate, loadUsuarios,
  }
}
