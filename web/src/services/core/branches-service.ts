import { api } from '@/lib/api-client'

export interface Branch {
  id: string
  tenantId: string
  name: string
  code: string
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  phone: string | null
  email: string | null
  managerId: string | null
  isMain: boolean
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'CLOSED'
  createdAt: string
  updatedAt: string
  manager?: { id: string; firstName: string; lastName: string; email: string } | null
  memberships?: BranchMember[]
  _count?: { orders: number; inventory: number; memberships: number }
}

export interface BranchMember {
  branchId: string
  userId: string
  isPrimary: boolean
  assignedAt: string
  user?: { id: string; firstName: string; lastName: string; email: string; status: string }
}

export interface CreateBranchInput {
  name: string
  code: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  phone?: string
  email?: string
  managerId?: string
  isMain?: boolean
}

export interface UpdateBranchInput extends Partial<CreateBranchInput> {
  status?: Branch['status']
}

export async function fetchBranches(): Promise<Branch[]> {
  const { data } = await api.get<Branch[]>('/branches')
  return data
}

export async function fetchBranch(id: string): Promise<Branch> {
  const { data } = await api.get<Branch>(`/branches/${id}`)
  return data
}

export async function createBranch(input: CreateBranchInput): Promise<Branch> {
  const { data } = await api.post<Branch>('/branches', input)
  return data
}

export async function updateBranch(id: string, input: UpdateBranchInput): Promise<Branch> {
  const { data } = await api.patch<Branch>(`/branches/${id}`, input)
  return data
}

export async function deleteBranch(id: string): Promise<void> {
  await api.delete(`/branches/${id}`)
}

export async function setMainBranch(id: string): Promise<Branch> {
  const { data } = await api.patch<Branch>(`/branches/${id}/set-main`, {})
  return data
}

export async function addBranchMember(branchId: string, userId: string, isPrimary = false): Promise<void> {
  await api.post(`/branches/${branchId}/members/${userId}`, { isPrimary })
}

export async function removeBranchMember(branchId: string, userId: string): Promise<void> {
  await api.delete(`/branches/${branchId}/members/${userId}`)
}
