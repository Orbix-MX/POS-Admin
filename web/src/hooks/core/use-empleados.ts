import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  fetchEmpleados, createEmpleado, updateEmpleado, deleteEmpleado,
} from '@/services/core/empleados-service'
import type { Empleado, CreateEmpleadoInput, UpdateEmpleadoInput } from '@/services/core/empleados-service'

export type { Empleado }

const EMPTY_FORM = {
  employeeNumber: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  birthDate: '',
  curp: '',
  rfc: '',
  department: '',
  position: '',
  contractType: 'FULL_TIME' as 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'TEMPORARY',
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ON_LEAVE',
  hireDate: new Date().toISOString().substring(0, 10),
  salary: '',
  notes: '',
}

const PER_PAGE = 8

// ── helpers de módulo (fuera del hook para evitar capturas stale) ──────────

const FIELD_LABELS: Record<string, string> = {
  email:          'Ingresa un email válido',
  employeeNumber: 'Número de empleado inválido',
  firstName:      'El nombre es requerido',
  lastName:       'Los apellidos son requeridos',
  salary:         'El salario no es válido',
  phone:          'El teléfono no es válido',
  rfc:            'El RFC no es válido',
  curp:           'El CURP no es válido',
  hireDate:       'La fecha de ingreso no es válida',
  birthDate:      'La fecha de nacimiento no es válida',
}

function parseBackendErrors(messages: string[]): Record<string, string> {
  const errs: Record<string, string> = {}
  for (const msg of messages) {
    const field = msg.split(' ')[0]
    errs[field] = FIELD_LABELS[field] ?? msg
  }
  return errs
}

function validateForm(f: typeof EMPTY_FORM): Record<string, string> {
  const e: Record<string, string> = {}
  if (!f.employeeNumber.trim()) e.employeeNumber = 'El número de empleado es requerido'
  if (!f.firstName.trim())      e.firstName      = 'El nombre es requerido'
  if (!f.lastName.trim())       e.lastName       = 'Los apellidos son requeridos'
  if (!f.email.trim())          e.email          = 'El email es requerido'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Ingresa un email válido'
  if (f.salary && isNaN(parseFloat(f.salary)))   e.salary = 'El salario debe ser un número'
  else if (f.salary && parseFloat(f.salary) < 0) e.salary = 'El salario no puede ser negativo'
  return e
}

function extractError(e: unknown): { fieldErrors: Record<string, string> | null; message: string } {
  const resp = (e as any)?.response?.data
  if (!resp) return { fieldErrors: null, message: 'Error al guardar. Intenta de nuevo.' }
  if (Array.isArray(resp.message) && resp.message.length > 0) {
    return {
      fieldErrors: parseBackendErrors(resp.message),
      message: 'Revisa los campos marcados en rojo.',
    }
  }
  return {
    fieldErrors: null,
    message: typeof resp.message === 'string' ? resp.message : 'Error al guardar. Intenta de nuevo.',
  }
}

export function useEmpleados() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [departmentFilter, setDepartmentFilter] = useState('Todos')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selected, setSelected] = useState<Empleado | null>(null)
  const [editing, setEditing] = useState<Empleado | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<string | null>(null)

  const loadEmpleados = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchEmpleados()
      setEmpleados(data)
    } catch {
      setError('Error al cargar empleados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadEmpleados() }, [loadEmpleados])

  const departments = useMemo(() => {
    const set = new Set(empleados.map(e => e.departamento).filter(Boolean))
    return ['Todos', ...Array.from(set).sort()]
  }, [empleados])

  const filtered = useMemo(() => {
    return empleados.filter(e => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        e.nombre.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.numEmpleado.toLowerCase().includes(q) ||
        e.departamento.toLowerCase().includes(q) ||
        e.puesto.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'Todos' || e.estado === statusFilter
      const matchDept = departmentFilter === 'Todos' || e.departamento === departmentFilter
      return matchSearch && matchStatus && matchDept
    })
  }, [search, statusFilter, departmentFilter, empleados])

  const pageData = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [page, filtered]
  )

  // js-combine-iterations: single pass for all stats
  const stats = useMemo(() => {
    let activos = 0, inactivos = 0, enPermiso = 0, nomina = 0
    for (const e of empleados) {
      if (e.estado === 'Activo') activos++
      else if (e.estado === 'En permiso') enPermiso++
      else inactivos++
      if (e.salarioRaw) nomina += e.salarioRaw
    }
    return { total: empleados.length, activos, inactivos, enPermiso, nomina }
  }, [empleados])

  const buildCreateInput = useCallback((f: typeof EMPTY_FORM): CreateEmpleadoInput => ({
    employeeNumber: f.employeeNumber,
    firstName: f.firstName,
    lastName: f.lastName,
    email: f.email,
    phone: f.phone || undefined,
    birthDate: f.birthDate || undefined,
    curp: f.curp || undefined,
    rfc: f.rfc || undefined,
    department: f.department || undefined,
    position: f.position || undefined,
    contractType: f.contractType,
    hireDate: f.hireDate || undefined,
    salary: f.salary ? parseFloat(f.salary) : undefined,
    notes: f.notes || undefined,
  }), [])

  const handleSave = useCallback(async () => {
    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      setApiError('Revisa los campos marcados en rojo.')
      return
    }
    setFormErrors({})
    setApiError(null)
    setSaving(true)
    try {
      await createEmpleado(buildCreateInput(form))
      await loadEmpleados()
      setModalOpen(false)
      setForm(EMPTY_FORM)
    } catch (e) {
      const { fieldErrors, message } = extractError(e)
      if (fieldErrors) setFormErrors(fieldErrors)
      setApiError(message)
    } finally {
      setSaving(false)
    }
  }, [form, loadEmpleados, buildCreateInput])

  const handleOpenNew = useCallback(() => {
    setForm({ ...EMPTY_FORM, hireDate: new Date().toISOString().substring(0, 10) })
    setFormErrors({})
    setApiError(null)
    setModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setApiError(null)
  }, [])

  const handleOpenEdit = useCallback((empleado: Empleado) => {
    setEditing(empleado)
    setEditForm({
      employeeNumber: empleado.numEmpleado,
      firstName: empleado.firstName ?? '',
      lastName: empleado.lastName ?? '',
      email: empleado.email,
      phone: empleado.telefono,
      birthDate: empleado.birthDate ?? '',
      curp: empleado.curp ?? '',
      rfc: empleado.rfc ?? '',
      department: empleado.departamento,
      position: empleado.puesto,
      contractType: empleado.contractType ?? 'FULL_TIME',
      status: empleado.status ?? 'ACTIVE',
      hireDate: empleado.hireDate ?? '',
      salary: empleado.salaryRaw != null ? String(empleado.salaryRaw) : '',
      notes: empleado.notes ?? '',
    })
    setSelected(null)
    setEditModalOpen(true)
  }, [])

  const handleCloseEdit = useCallback(() => {
    setEditModalOpen(false)
    setEditing(null)
    setEditForm(EMPTY_FORM)
    setEditErrors({})
    setApiError(null)
  }, [])

  const handleUpdate = useCallback(async () => {
    const errors = validateForm(editForm)
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors)
      setApiError('Revisa los campos marcados en rojo.')
      return
    }
    setEditErrors({})
    setApiError(null)
    if (!editing) return
    setSaving(true)
    try {
      const input: UpdateEmpleadoInput = {
        employeeNumber: editForm.employeeNumber,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone || undefined,
        birthDate: editForm.birthDate || undefined,
        curp: editForm.curp || undefined,
        rfc: editForm.rfc || undefined,
        department: editForm.department || undefined,
        position: editForm.position || undefined,
        contractType: editForm.contractType,
        status: editForm.status,
        hireDate: editForm.hireDate || undefined,
        salary: editForm.salary ? parseFloat(editForm.salary) : undefined,
        notes: editForm.notes || undefined,
      }
      await updateEmpleado(editing.id, input)
      await loadEmpleados()
      handleCloseEdit()
    } catch (e) {
      const { fieldErrors, message } = extractError(e)
      if (fieldErrors) setEditErrors(fieldErrors)
      setApiError(message)
    } finally {
      setSaving(false)
    }
  }, [editing, editForm, loadEmpleados, handleCloseEdit])

  const handleDelete = useCallback(async (id: string) => {
    setSaving(true)
    try {
      await deleteEmpleado(id)
      await loadEmpleados()
      setSelected(null)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }, [loadEmpleados])

  return {
    empleados,
    loading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    departmentFilter,
    setDepartmentFilter,
    departments,
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
    formErrors,
    editErrors,
    apiError,
    handleSave,
    handleOpenNew,
    handleCloseModal,
    handleOpenEdit,
    handleCloseEdit,
    handleUpdate,
    handleDelete,
    loadEmpleados,
  }
}
