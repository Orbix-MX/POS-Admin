import { platformApi } from '@/lib/platform-api-client'
import type { TenantPlan } from './platform-tenants-service'

export type LicenseStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED'

export interface License {
  id: string
  tenantId: string
  licenseKey: string
  status: LicenseStatus
  plan: TenantPlan
  startsAt: string
  expiresAt: string | null
  maxUsers: number | null
  maxBranches: number | null
  maxDevices: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type LicenseInvalidReason = 'NO_LICENSE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED' | 'NOT_STARTED'

export interface LicenseValidation {
  valid: boolean
  reason?: LicenseInvalidReason
  status?: LicenseStatus
  expiresAt?: string | null
  licenseId?: string
}

export interface CreateLicenseInput {
  plan: TenantPlan
  status?: LicenseStatus
  trialDays?: number
  expiresAt?: string
  maxUsers?: number
  maxBranches?: number
  maxDevices?: number
  notes?: string
}

export interface RenewLicenseInput {
  extendDays?: number
  expiresAt?: string
  plan?: TenantPlan
  maxUsers?: number
  maxBranches?: number
  maxDevices?: number
  notes?: string
}

export async function fetchTenantLicense(
  tenantId: string,
): Promise<{ license: License | null; validation: LicenseValidation }> {
  const { data } = await platformApi.get(`/platform/tenants/${tenantId}/license`)
  return data
}

export async function createTenantLicense(tenantId: string, input: CreateLicenseInput): Promise<License> {
  const { data } = await platformApi.post(`/platform/tenants/${tenantId}/license`, input)
  return data
}

export async function renewTenantLicense(tenantId: string, input: RenewLicenseInput): Promise<License> {
  const { data } = await platformApi.post(`/platform/tenants/${tenantId}/license/renew`, input)
  return data
}

export async function suspendTenantLicense(tenantId: string, reason?: string): Promise<License> {
  const { data } = await platformApi.post(`/platform/tenants/${tenantId}/license/suspend`, { reason })
  return data
}

export async function activateTenantLicense(tenantId: string): Promise<License> {
  const { data } = await platformApi.post(`/platform/tenants/${tenantId}/license/activate`, {})
  return data
}
