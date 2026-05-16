import { api } from '@/lib/api-client'
export type { Proveedor } from '@/types/erp'
import type { Proveedor } from '@/types/erp'

interface ApiSupplier {
  id: string
  name: string
  contactName?: string | null
  email: string
  phone?: string | null
  city?: string | null
  category?: string | null
  paymentTerms?: string | null
  status: 'ACTIVE' | 'INACTIVE'
  totalOrders: number
  totalSpent: string | number
  createdAt: string
}

interface PaginatedResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

function mapSupplier(s: ApiSupplier): Proveedor {
  const spent = parseFloat(String(s.totalSpent ?? 0))
  return {
    id: s.id,
    nombre: s.name,
    contacto: s.contactName ?? '',
    email: s.email,
    telefono: s.phone ?? '',
    ciudad: s.city ?? '',
    categoria: s.category ?? '',
    comprasTotal: `$${spent.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
    ordenes: s.totalOrders ?? 0,
    estado: s.status === 'ACTIVE' ? 'Activo' : 'Inactivo',
    plazo: s.paymentTerms ?? '',
    // raw fields para edición
    name: s.name,
    contactName: s.contactName,
    phone: s.phone,
    city: s.city,
    category: s.category,
    paymentTerms: s.paymentTerms,
    status: s.status,
  }
}

export interface CreateProveedorInput {
  name: string
  contactName?: string
  email: string
  phone?: string
  city?: string
  category?: string
  paymentTerms?: string
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface UpdateProveedorInput {
  name?: string
  contactName?: string
  email?: string
  phone?: string
  city?: string
  category?: string
  paymentTerms?: string
  status?: 'ACTIVE' | 'INACTIVE'
}

export async function fetchProveedores(): Promise<Proveedor[]> {
  const { data } = await api.get<PaginatedResponse<ApiSupplier>>('/suppliers', {
    params: { limit: 100, page: 1 },
  })
  return data.data.map(mapSupplier)
}

export async function fetchProveedor(id: string): Promise<Proveedor> {
  const { data } = await api.get<ApiSupplier>(`/suppliers/${id}`)
  return mapSupplier(data)
}

export async function createProveedor(input: CreateProveedorInput): Promise<Proveedor> {
  const { data } = await api.post<ApiSupplier>('/suppliers', input)
  return mapSupplier(data)
}

export async function updateProveedor(id: string, input: UpdateProveedorInput): Promise<Proveedor> {
  const { data } = await api.patch<ApiSupplier>(`/suppliers/${id}`, input)
  return mapSupplier(data)
}

export async function deleteProveedor(id: string): Promise<void> {
  await api.delete(`/suppliers/${id}`)
}
