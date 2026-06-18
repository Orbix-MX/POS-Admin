import { api } from '@/lib/api-client'

export type LicenseStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED'
export type LicenseInvalidReason = 'NO_LICENSE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED' | 'NOT_STARTED'

export interface LicenseOverview {
  license: {
    keyMasked: string
    status: LicenseStatus
    plan: string
    startsAt: string
    expiresAt: string | null
    maxUsers: number | null
    maxBranches: number | null
    maxDevices: number | null
  } | null
  validation: {
    valid: boolean
    reason?: LicenseInvalidReason
    status?: LicenseStatus
    expiresAt?: string | null
  }
  devices: { active: number; max: number | null }
}

export type DeviceType = 'WEB' | 'POS_DESKTOP' | 'MOBILE_COMANDERA' | 'OTHER'
export type DeviceStatus = 'ACTIVE' | 'REVOKED' | 'PENDING'

export interface Device {
  id: string
  deviceId: string
  name: string | null
  type: DeviceType
  status: DeviceStatus
  lastSeenAt: string | null
  activatedAt: string
}

export interface EnrollmentToken {
  token: string
  expiresAt: string
  expiresInSeconds: number
}

/** Read-only license overview for the current tenant (masked key). */
export async function fetchMyLicense(): Promise<LicenseOverview> {
  const { data } = await api.get<LicenseOverview>('/license')
  return data
}

/** Generate a short-lived QR enrollment token to register a device. */
export async function createEnrollmentToken(): Promise<EnrollmentToken> {
  const { data } = await api.post<EnrollmentToken>('/devices/enrollment-token', {})
  return data
}

export async function fetchDevices(): Promise<Device[]> {
  const { data } = await api.get<Device[]>('/devices')
  return data
}

export async function revokeDevice(id: string): Promise<void> {
  await api.delete(`/devices/${id}`)
}
