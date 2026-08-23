import { api } from '@/lib/api-client'
import type { BusinessFeatures } from '@/types/business-config'

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

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

// El refresh token vive junto al access token, en localStorage. No es la opción
// más dura —una cookie HttpOnly resistiría XSS, y así lo hace Noura— pero el
// access token ya está ahí: guardarlo aparte no añadiría seguridad real y sí
// exigiría cookies de sesión en un API que hoy es puro Bearer.
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function clearRefreshToken(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(REFRESH_TOKEN_KEY)
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
  /** Token opaco rotativo. Solo lo devuelven /auth/login y /auth/oauth/exchange. */
  refreshToken?: string
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
  // El refresh token se manda para que el API lo revoque en el servidor: sin
  // esto seguiría siendo canjeable durante 30 días aunque el navegador lo borre.
  const refreshToken = getRefreshToken()
  await api.post('/auth/logout', refreshToken ? { refreshToken } : {})
}

/**
 * URL a la que mandar el navegador para entrar con Google. El `redirect` le dice
 * al API a qué app volver tras el consentimiento; el API lo valida contra su
 * propia allowlist (OAUTH_ALLOWED_REDIRECTS), así que un valor arbitrario aquí
 * no consigue nada.
 */
export function googleAuthUrl(): string {
  const base = import.meta.env.VITE_API_URL as string
  return `${base}/auth/google?redirect=${encodeURIComponent(window.location.origin)}`
}

/** Canjea el ticket del callback de OAuth por la sesión (mismo shape que login). */
export async function exchangeOAuthTicket(ticket: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/oauth/exchange', { ticket })
  return data
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

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/forgot-password', { email })
  return data
}

export async function checkPasswordResetToken(token: string): Promise<{ valid: true }> {
  const { data } = await api.get<{ valid: true }>(`/auth/reset-password/${token}`)
  return data
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(`/auth/reset-password/${token}`, { newPassword })
  return data
}
