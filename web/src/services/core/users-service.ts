import { api } from '@/lib/api-client'

interface ApiUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF'
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  createdAt: string
  _count?: { roleAssignments: number; permissionGrants: number }
}

interface PaginatedResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: string
  rolRaw: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF'
  estado: 'Activo' | 'Inactivo' | 'Suspendido'
  statusRaw: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  desde: string
  firstName: string
  lastName: string
  roleId?: string
}

const ROL_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  STAFF: 'Personal',
}

const STATUS_MAP: Record<string, 'Activo' | 'Inactivo' | 'Suspendido'> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  SUSPENDED: 'Suspendido',
}

function mapUser(u: ApiUser): Usuario {
  return {
    id: u.id,
    nombre: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email,
    rol: ROL_LABELS[u.role] ?? u.role,
    rolRaw: u.role,
    estado: STATUS_MAP[u.status] ?? 'Activo',
    statusRaw: u.status,
    desde: new Date(u.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }),
    firstName: u.firstName,
    lastName: u.lastName,
  }
}

export interface CreateUsuarioInput {
  email: string
  password: string
  firstName: string
  lastName: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF'
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
}

export interface UpdateUsuarioInput {
  email?: string
  firstName?: string
  lastName?: string
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF'
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
}

export async function fetchUsuarios(): Promise<Usuario[]> {
  const { data } = await api.get<PaginatedResponse<ApiUser>>('/users', { params: { limit: 100, page: 1 } })
  return data.data.map(mapUser)
}

export async function fetchUsuario(id: string): Promise<Usuario> {
  const { data } = await api.get<ApiUser>(`/users/${id}`)
  return mapUser(data)
}

export async function createUsuario(input: CreateUsuarioInput): Promise<Usuario> {
  const { data } = await api.post<ApiUser>('/users', input)
  return mapUser(data)
}

export async function updateUsuario(id: string, input: UpdateUsuarioInput): Promise<Usuario> {
  const { data } = await api.patch<ApiUser>(`/users/${id}`, input)
  return mapUser(data)
}

export async function deleteUsuario(id: string): Promise<void> {
  await api.delete(`/users/${id}`)
}

export async function setUserRoles(id: string, roleIds: string[]): Promise<void> {
  await api.put(`/users/${id}/roles`, { roleIds })
}
