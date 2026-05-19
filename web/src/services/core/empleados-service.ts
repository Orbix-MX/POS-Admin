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
}

export type UpdateEmpleadoInput = Partial<CreateEmpleadoInput>

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
