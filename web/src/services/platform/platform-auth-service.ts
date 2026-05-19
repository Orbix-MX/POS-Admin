import { platformApi, setPlatformToken, clearPlatformToken, getPlatformToken } from '@/lib/platform-api-client'

export interface PlatformUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'SUPER_ADMIN' | 'SUPPORT'
  status: string
  createdAt: string
}

export interface PlatformLoginResponse {
  accessToken: string
  user: PlatformUser
}

export async function platformLogin(email: string, password: string): Promise<PlatformLoginResponse> {
  const { data } = await platformApi.post<PlatformLoginResponse>('/platform/auth/login', { email, password })
  return data
}

export async function fetchPlatformMe(): Promise<PlatformUser> {
  const { data } = await platformApi.get<PlatformUser>('/platform/auth/me')
  return data
}

export { setPlatformToken, clearPlatformToken, getPlatformToken }
