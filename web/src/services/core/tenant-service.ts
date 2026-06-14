import { api } from '@/lib/api-client'

export type RestaurantServiceMode = 'TABLE_SERVICE' | 'COUNTER_SERVICE' | 'HYBRID'

export interface TenantInfo {
  name: string
  displayName?: string
  logoUrl?: string
  bannerUrl?: string
  phone?: string
  email?: string
  address?: string
  rfc?: string
  timezone?: string
  currency?: string
  restaurantServiceMode?: RestaurantServiceMode
}

export async function fetchTenantInfo(): Promise<TenantInfo> {
  const { data } = await api.get<TenantInfo>('tenants/current/info')
  return data
}

export async function updateTenantInfo(dto: Partial<TenantInfo>): Promise<TenantInfo> {
  const { data } = await api.patch<TenantInfo>('tenants/current/info', dto)
  return data
}

export async function uploadTenantLogo(file: File): Promise<{ logoUrl: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post<{ logoUrl: string }>('tenants/current/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function uploadTenantBanner(file: File): Promise<{ bannerUrl: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post<{ bannerUrl: string }>('tenants/current/banner', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteTenantLogo(): Promise<void> {
  await api.delete('tenants/current/logo')
}

export async function deleteTenantBanner(): Promise<void> {
  await api.delete('tenants/current/banner')
}
