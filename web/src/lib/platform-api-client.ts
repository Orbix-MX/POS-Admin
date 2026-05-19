import axios from 'axios'

const PLATFORM_TOKEN_KEY = 'platform_access_token'

export function getPlatformToken(): string | null {
  return window.localStorage.getItem(PLATFORM_TOKEN_KEY)
}

export function setPlatformToken(token: string): void {
  window.localStorage.setItem(PLATFORM_TOKEN_KEY, token)
}

export function clearPlatformToken(): void {
  window.localStorage.removeItem(PLATFORM_TOKEN_KEY)
}

export const platformApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

platformApi.interceptors.request.use((config) => {
  const token = getPlatformToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

platformApi.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      clearPlatformToken()
      window.location.href = '/platform/login'
    }
    return Promise.reject(error)
  }
)
