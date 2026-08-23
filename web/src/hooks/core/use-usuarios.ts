import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  fetchUsuarios, updateUsuario, deleteUsuario, setUserRoles,
  activateUsuario, deactivateUsuario, fetchUserCapacity,
} from '@/services/core/users-service'
import type { Usuario, UpdateUsuarioInput, UserCapacity, MembershipStatus } from '@/services/core/users-service'
import {
  fetchPendingInvitations, createInvitation, revokeInvitation,
} from '@/services/core/invitations-service'
import type { PendingInvitation } from '@/services/core/invitations-service'

export type { Usuario }

type InviteFormState = { email: string; roleId: string }
type EditFormState = { firstName: string; lastName: string; email: string; roleId: string; status: MembershipStatus }

function errMessage(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
}

const EMPTY_INVITE: InviteFormState = { email: '', roleId: '' }
const EMPTY_EDIT: EditFormState = { firstName: '', lastName: '', email: '', roleId: '', status: 'ACTIVE' }

const PER_PAGE = 8

/**
 * Dar de alta un usuario es siempre invitarlo: nadie más fija la contraseña de
 * otra persona, y nadie entra a una empresa sin haberlo aceptado desde su
 * correo. `POST /users` (creación directa) sigue existiendo en el API por
 * compatibilidad, pero esta pantalla ya no lo usa.
 */
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
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
  const [inviteForm, setInviteForm] = useState<InviteFormState>(EMPTY_INVITE)
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT)
  const [saving, setSaving] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  const loadUsuarios = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, cap, pending] = await Promise.all([
        fetchUsuarios(), fetchUserCapacity(), fetchPendingInvitations(),
      ])
      setUsuarios(list)
      setCapacity(cap)
      setInvitations(pending)
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

  const handleInvite = useCallback(async () => {
    setSaving(true)
    setActionError(null)
    setInviteSuccess(null)
    try {
      await createInvitation({
        email: inviteForm.email,
        roleIds: inviteForm.roleId ? [inviteForm.roleId] : [],
      })
      await loadUsuarios()
      setInviteSuccess(`Invitación enviada a ${inviteForm.email}.`)
      setInviteForm(EMPTY_INVITE)
    } catch (e) {
      setActionError(errMessage(e, 'No se pudo enviar la invitación'))
    }
    finally { setSaving(false) }
  }, [inviteForm, loadUsuarios])

  const handleRevokeInvitation = useCallback(async (id: string) => {
    setSaving(true)
    setActionError(null)
    try {
      await revokeInvitation(id)
      await loadUsuarios()
    } catch (e) {
      setActionError(errMessage(e, 'No se pudo revocar la invitación'))
    }
    finally { setSaving(false) }
  }, [loadUsuarios])

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

  const handleOpenNew = useCallback(() => {
    setInviteForm(EMPTY_INVITE)
    setInviteSuccess(null)
    setActionError(null)
    setModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
    setInviteForm(EMPTY_INVITE)
    setInviteSuccess(null)
  }, [])

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
    usuarios, invitations, capacity, actionError, setActionError, inviteSuccess,
    loading, error, search, setSearch, rolFilter, setRolFilter,
    page, setPage, modalOpen, editModalOpen, selected, setSelected,
    editing, inviteForm, setInviteForm, editForm, setEditForm,
    filtered, pageData, stats, saving,
    handleInvite, handleRevokeInvitation, handleOpenNew, handleCloseModal,
    handleOpenEdit, handleCloseEdit, handleUpdate, handleDelete,
    handleActivate, handleDeactivate, loadUsuarios,
  }
}
