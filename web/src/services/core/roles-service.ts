import { api } from '@/lib/api-client'

export interface Permiso {
  id: string
  key: string
  name: string
  description?: string | null
  module: string
  action: string
}

export interface PermisoGrupo {
  module: string
  permissions: Permiso[]
}

export interface Rol {
  id: string
  name: string
  description?: string | null
  color?: string | null
  isSystem: boolean
  permissionsCount: number
  usersCount: number
  permissions?: { permission: Permiso }[]
  createdAt: string
}

interface ApiRole {
  id: string
  name: string
  description?: string | null
  color?: string | null
  isSystem: boolean
  createdAt: string
  _count?: { permissions: number; userAssignments: number }
  permissions?: { permission: Permiso }[]
}

function mapRole(r: ApiRole): Rol {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    isSystem: r.isSystem,
    permissionsCount: r._count?.permissions ?? r.permissions?.length ?? 0,
    usersCount: r._count?.userAssignments ?? 0,
    permissions: r.permissions,
    createdAt: r.createdAt,
  }
}

export interface CreateRolInput {
  name: string
  description?: string
  color?: string
  permissionIds?: string[]
}

export interface UpdateRolInput {
  name?: string
  description?: string
  color?: string
  permissionIds?: string[]
}

export async function fetchRoles(): Promise<Rol[]> {
  const { data } = await api.get<ApiRole[]>('/roles')
  return data.map(mapRole)
}

export async function fetchRol(id: string): Promise<Rol> {
  const { data } = await api.get<ApiRole>(`/roles/${id}`)
  return mapRole(data)
}

export async function createRol(input: CreateRolInput): Promise<Rol> {
  const { data } = await api.post<ApiRole>('/roles', input)
  return mapRole(data)
}

export async function updateRol(id: string, input: UpdateRolInput): Promise<Rol> {
  const { data } = await api.patch<ApiRole>(`/roles/${id}`, input)
  return mapRole(data)
}

export async function deleteRol(id: string): Promise<void> {
  await api.delete(`/roles/${id}`)
}

export async function setRolPermisos(id: string, permissionIds: string[]): Promise<void> {
  await api.put(`/roles/${id}/permissions`, { permissionIds })
}

export async function fetchPermisos(): Promise<PermisoGrupo[]> {
  const { data } = await api.get<PermisoGrupo[]>('/permissions')
  return data
}

export async function fetchPermisosFlat(): Promise<Permiso[]> {
  const { data } = await api.get<Permiso[]>('/permissions/flat')
  return data
}

export interface RoleTemplate {
  key: string
  name: string
  description: string
  color: string
  permissionCount: number
}

export async function fetchRoleTemplates(): Promise<RoleTemplate[]> {
  const { data } = await api.get<RoleTemplate[]>('/roles/templates')
  return data
}

export async function applyRoleTemplate(key: string): Promise<Rol> {
  const { data } = await api.post<ApiRole>(`/roles/templates/${key}/apply`)
  return mapRole(data)
}
