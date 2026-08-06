import { api } from '@/lib/api-client'
import type { BusinessFeatures } from '@/types/business-config'

const ACCESS_TOKEN_KEY = 'access_token'

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  status: string
  createdAt: string
}

export interface Tenant {
  id: string
  name: string
  slug: string
  memberRole: string
  plan: string
}

export interface LoginResponse {
  accessToken: string
  user: AuthUser
  availableTenants: Tenant[]
}

export interface SelectTenantResponse {
  accessToken: string
  posOnly: boolean
  plan: string
  enabledModules: string[]
  businessVertical: string
  businessProfile: string
  posOperationMode: string
  enabledFeatures: string[]
  businessFeatures: BusinessFeatures
  tenant: Tenant
}

export interface CapabilitiesResponse {
  plan: string
  enabledModules: string[]
  effectiveModules: string[]
  maxUsers: number | null
  activeUsers: number
  overUserLimit: boolean
  businessVertical: string
  businessProfile: string
  posOperationMode: string
  enabledFeatures: string[]
  businessFeatures: BusinessFeatures
}

export interface Branch {
  id: string
  name: string
  code: string
  isMain: boolean
  status: string
  city?: string | null
  address?: string | null
}

export interface SelectBranchResponse {
  branchId: string
  accessToken: string
}

export interface ProfileResponse {
  user: AuthUser
  currentBranchId?: string
  permissions?: string[]
  roles?: { id: string; name: string; permissions: string[] }[]
}

export async function fetchMe(): Promise<ProfileResponse> {
  const { data } = await api.get<ProfileResponse>('/auth/me')
  return data
}

export async function fetchBranches(): Promise<Branch[]> {
  const { data } = await api.get<Branch[]>('/branches')
  return data
}

export async function selectBranch(branchId: string): Promise<SelectBranchResponse> {
  const { data } = await api.patch<SelectBranchResponse>(`/auth/select-branch/${branchId}`, {})
  return data
}

export async function fetchCapabilities(): Promise<CapabilitiesResponse> {
  const { data } = await api.get<CapabilitiesResponse>('/auth/me/capabilities')
  return data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
  return data
}

export async function selectTenant(slug: string, tempToken: string): Promise<SelectTenantResponse> {
  const { data } = await api.patch<SelectTenantResponse>(
    `/auth/select-tenant/${slug}`,
    {},
    { headers: { Authorization: `Bearer ${tempToken}` } }
  )
  return data
}
