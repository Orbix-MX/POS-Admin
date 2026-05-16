import { api } from '@/lib/api-client'
export type { Cliente } from '@/types/erp'
import type { Cliente } from '@/types/erp'

interface ApiCustomer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  company?: string | null
  city?: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
  type: 'NEW' | 'REGULAR' | 'VIP' | 'WHOLESALE'
  totalOrders: number
  totalSpent: string | number
  hasCredit: boolean
  creditLimit?: string | number | null
  creditDays: number
  createdAt: string
  _count?: { orders: number; addresses: number }
}

interface PaginatedResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

function mapCustomer(c: ApiCustomer): Cliente {
  const spent = parseFloat(String(c.totalSpent ?? 0))
  return {
    id: c.id,
    nombre: `${c.firstName} ${c.lastName}`.trim(),
    empresa: c.company ?? '',
    email: c.email,
    telefono: c.phone ?? '',
    ciudad: c.city ?? '',
    totalCompras: `$${spent.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
    pedidos: c._count?.orders ?? c.totalOrders ?? 0,
    estado: c.status === 'ACTIVE' ? 'Activo' : 'Inactivo',
    desde: new Date(c.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }),
    // raw fields para edición
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    company: c.company,
    city: c.city,
    status: c.status,
    type: c.type,
    hasCredit: c.hasCredit ?? false,
    creditLimit: c.creditLimit != null ? parseFloat(String(c.creditLimit)) : null,
    creditDays: c.creditDays ?? 0,
  }
}

export interface CreateClienteInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  company?: string
  city?: string
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
  type?: 'NEW' | 'REGULAR' | 'VIP' | 'WHOLESALE'
  hasCredit?: boolean
  creditLimit?: number
  creditDays?: number
}

export interface UpdateClienteInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  city?: string
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
  type?: 'NEW' | 'REGULAR' | 'VIP' | 'WHOLESALE'
  hasCredit?: boolean
  creditLimit?: number | null
  creditDays?: number
}

export async function fetchClientes(): Promise<Cliente[]> {
  const { data } = await api.get<PaginatedResponse<ApiCustomer>>('/customers', {
    params: { limit: 100, page: 1 },
  })
  return data.data.map(mapCustomer)
}

export async function fetchCliente(id: string): Promise<Cliente> {
  const { data } = await api.get<ApiCustomer>(`/customers/${id}`)
  return mapCustomer(data)
}

export async function createCliente(input: CreateClienteInput): Promise<Cliente> {
  const { data } = await api.post<ApiCustomer>('/customers', input)
  return mapCustomer(data)
}

export async function updateCliente(id: string, input: UpdateClienteInput): Promise<Cliente> {
  const { data } = await api.patch<ApiCustomer>(`/customers/${id}`, input)
  return mapCustomer(data)
}

export async function deleteCliente(id: string): Promise<void> {
  await api.delete(`/customers/${id}`)
}
