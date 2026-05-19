import { platformApi } from '@/lib/platform-api-client'

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELLED' | 'EXPIRED' | 'DISABLED'
export type TenantPlan = 'FREE' | 'STARTER' | 'PRO' | 'PLUS' | 'ENTERPRISE'

export interface PlatformTenant {
  id: string
  name: string
  slug: string
  status: TenantStatus
  plan: TenantPlan
  enabledModules: string[]
  overUserLimit: boolean
  userLimitOverride: number | null
  ownerUserId: string | null
  trialEndsAt: string | null
  createdAt: string
  updatedAt: string
  _count?: { memberships: number; branches: number }
}

export interface PlatformDashboardStats {
  tenants: { total: number; active: number; trial: number; suspended: number }
  users: { total: number }
  branches: { total: number }
  byPlan: { plan: TenantPlan; count: number }[]
}

export interface ProvisionTenantInput {
  tenant: {
    name: string
    slug: string
    plan: TenantPlan
    status?: TenantStatus
    enabledModules?: string[]
  }
  branch: {
    name: string
    code: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    phone?: string
  }
  adminUser: {
    email: string
    firstName: string
    lastName: string
    password: string
  }
  trialDays?: number
  notes?: string
}

export interface PlatformAuditLog {
  id: string
  tenantId: string | null
  action: string
  entityType: string
  entityId: string
  before: unknown
  after: unknown
  notes: string | null
  createdAt: string
  platformUser: { id: string; email: string; firstName: string; lastName: string } | null
}

export interface ListResponse<T> {
  data: T[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export async function fetchDashboardStats(): Promise<PlatformDashboardStats> {
  const { data } = await platformApi.get<PlatformDashboardStats>('/platform/tenants/dashboard')
  return data
}

export async function fetchTenants(params?: {
  page?: number; limit?: number; status?: string; plan?: string; search?: string
}): Promise<ListResponse<PlatformTenant>> {
  const { data } = await platformApi.get<ListResponse<PlatformTenant>>('/platform/tenants', { params })
  return data
}

export async function fetchTenant(id: string): Promise<PlatformTenant & {
  branches: { id: string; name: string; code: string; status: string; isMain: boolean }[]
  _count: { memberships: number; orders: number; products: number }
}> {
  const { data } = await platformApi.get(`/platform/tenants/${id}`)
  return data
}

export async function provisionTenant(input: ProvisionTenantInput) {
  const { data } = await platformApi.post('/platform/tenants/provision', input)
  return data
}

export async function updateTenantStatus(id: string, status: TenantStatus, reason?: string) {
  const { data } = await platformApi.patch(`/platform/tenants/${id}/status`, { status, reason })
  return data
}

export async function updateTenantPlan(id: string, plan: TenantPlan, notes?: string) {
  const { data } = await platformApi.patch(`/platform/tenants/${id}/plan`, { plan, notes })
  return data
}

export async function updateTenantModules(id: string, enabledModules: string[]) {
  const { data } = await platformApi.patch(`/platform/tenants/${id}/modules`, { enabledModules })
  return data
}

export async function updateTenantLimits(id: string, userLimitOverride: number | null) {
  const { data } = await platformApi.patch(`/platform/tenants/${id}/limits`, { userLimitOverride })
  return data
}

export async function fetchTenantAudit(id: string, page = 1): Promise<ListResponse<PlatformAuditLog>> {
  const { data } = await platformApi.get<ListResponse<PlatformAuditLog>>(`/platform/tenants/${id}/audit`, { params: { page } })
  return data
}

// ─── Branch types ─────────────────────────────────────────────────────────────

export type BranchStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'CLOSED'

export interface PlatformBranch {
  id: string
  name: string
  code: string
  status: BranchStatus
  isMain: boolean
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  phone: string | null
  email: string | null
  createdAt: string
}

export interface BranchCapacity {
  maxBranches: number | null
  activeBranches: number
  extraBranchLimit: number
  hasCapacity: boolean
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
}

// ─── Branch API calls ─────────────────────────────────────────────────────────

export async function fetchTenantBranches(tenantId: string): Promise<{ branches: PlatformBranch[]; capacity: BranchCapacity }> {
  const { data } = await platformApi.get(`/platform/tenants/${tenantId}/branches`)
  return data
}

export async function createTenantBranch(tenantId: string, input: CreateBranchInput): Promise<PlatformBranch> {
  const { data } = await platformApi.post(`/platform/tenants/${tenantId}/branches`, input)
  return data
}

export async function updateTenantBranchStatus(
  tenantId: string,
  branchId: string,
  status: BranchStatus,
  reason?: string,
): Promise<PlatformBranch> {
  const { data } = await platformApi.patch(`/platform/tenants/${tenantId}/branches/${branchId}/status`, { status, reason })
  return data
}

export async function updateTenantBranchLimits(
  tenantId: string,
  extraBranchLimit: number,
  notes?: string,
) {
  const { data } = await platformApi.patch(`/platform/tenants/${tenantId}/branch-limits`, { extraBranchLimit, notes })
  return data
}
