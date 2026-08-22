import { api } from '@/lib/api-client'
export type { Empleado } from '@/types/erp'
import type { Empleado } from '@/types/erp'

interface ApiEmployee {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  birthDate?: string | null
  curp?: string | null
  rfc?: string | null
  department?: string | null
  position?: string | null
  contractType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'TEMPORARY'
  hireDate: string
  salary?: string | number | null
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ON_LEAVE'
  notes?: string | null
  createdAt: string
  hasPin?: boolean
  roleId?: string | null
  user?: LinkedAccount | null
}

/** Cuenta de back-office vinculada a un empleado. */
export interface LinkedAccount {
  id: string
  email: string
  firstName: string
  lastName: string
}

interface PaginatedResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

const CONTRACT_LABELS: Record<string, string> = {
  FULL_TIME:   'Tiempo completo',
  PART_TIME:   'Medio tiempo',
  CONTRACTOR:  'Contratista',
  TEMPORARY:   'Temporal',
}

const STATUS_LABELS: Record<string, Empleado['estado']> = {
  ACTIVE:    'Activo',
  INACTIVE:  'Inactivo',
  SUSPENDED: 'Suspendido',
  ON_LEAVE:  'En permiso',
}

function mapEmployee(e: ApiEmployee): Empleado {
  const salary = e.salary != null ? parseFloat(String(e.salary)) : null
  return {
    id: e.id,
    nombre: `${e.firstName} ${e.lastName}`,
    puesto: e.position ?? '',
    departamento: e.department ?? '',
    email: e.email,
    telefono: e.phone ?? '',
    numEmpleado: e.employeeNumber,
    tipoContrato: CONTRACT_LABELS[e.contractType] ?? e.contractType,
    salario: salary != null ? `$${salary.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—',
    estado: STATUS_LABELS[e.status] ?? 'Inactivo',
    fechaIngreso: new Date(e.hireDate).toLocaleDateString('es-MX'),
    // raw
    firstName: e.firstName,
    lastName: e.lastName,
    phone: e.phone,
    department: e.department,
    position: e.position,
    contractType: e.contractType,
    status: e.status,
    hireDate: e.hireDate ? e.hireDate.substring(0, 10) : '',
    birthDate: e.birthDate ? e.birthDate.substring(0, 10) : null,
    curp: e.curp,
    rfc: e.rfc,
    notes: e.notes,
    salaryRaw: salary,
    hasPin: e.hasPin ?? false,
    roleId: e.roleId ?? null,
    user: e.user ?? null,
  }
}

export interface CreateEmpleadoInput {
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  birthDate?: string
  curp?: string
  rfc?: string
  department?: string
  position?: string
  contractType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'TEMPORARY'
  hireDate?: string
  salary?: number
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ON_LEAVE'
  notes?: string
  /** Vincula el empleado con una cuenta existente de la empresa. */
  userId?: string | null
  /** Crea además una cuenta de acceso usando el correo del empleado. */
  createUserAccount?: boolean
  /** Contraseña inicial de esa cuenta. Obligatoria si createUserAccount. */
  userPassword?: string
}

export type UpdateEmpleadoInput = Partial<CreateEmpleadoInput>

/** Miembro de la empresa, para el selector de cuenta vinculable. */
export interface TenantMemberOption {
  id: string
  email: string
  nombre: string
}

interface ApiMembership {
  user: { id: string; email: string; firstName: string; lastName: string; status: string }
}

/**
 * Cuentas de la empresa que pueden vincularse a un empleado. El backend rechaza
 * las ya vinculadas, así que se excluyen aquí para no ofrecerlas.
 */
export async function fetchCuentasVinculables(yaVinculadas: string[] = []): Promise<TenantMemberOption[]> {
  const { data } = await api.get<ApiMembership[]>('/tenants/current/members')
  return data
    .filter((m) => m.user && m.user.status === 'ACTIVE' && !yaVinculadas.includes(m.user.id))
    .map((m) => ({
      id: m.user.id,
      email: m.user.email,
      nombre: `${m.user.firstName} ${m.user.lastName}`,
    }))
}

export async function fetchEmpleados(): Promise<Empleado[]> {
  const { data } = await api.get<PaginatedResponse<ApiEmployee>>('/employees', {
    params: { limit: 200, page: 1 },
  })
  return data.data.map(mapEmployee)
}

export async function createEmpleado(input: CreateEmpleadoInput): Promise<Empleado> {
  const { data } = await api.post<ApiEmployee>('/employees', input)
  return mapEmployee(data)
}

export async function updateEmpleado(id: string, input: UpdateEmpleadoInput): Promise<Empleado> {
  const { data } = await api.patch<ApiEmployee>(`/employees/${id}`, input)
  return mapEmployee(data)
}

export async function deleteEmpleado(id: string): Promise<void> {
  await api.delete(`/employees/${id}`)
}
