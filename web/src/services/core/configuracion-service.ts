import { api } from '@/lib/api-client'

export interface TenantSettings {
  cashChangeCurrency?: 'MXN' | 'USD'
  [key: string]: unknown
}

export async function fetchSettings(): Promise<TenantSettings> {
  const { data } = await api.get<TenantSettings>('/tenants/current/settings')
  return data
}

export async function updateSettings(patch: Partial<TenantSettings>): Promise<TenantSettings> {
  const { data } = await api.patch<TenantSettings>('/tenants/current/settings', patch)
  return data
}
