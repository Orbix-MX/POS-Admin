import axios from 'axios'
import { getAccessToken, clearAccessToken } from '@/services/core/auth-service'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  },
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      clearAccessToken()
      window.location.reload()
    }
    if (error.response?.status === 403 && error.response?.data?.code === 'TENANT_SUSPENDED') {
      const url: string = error.config?.url ?? ''
      const isAuthFlow = url.includes('/auth/login') || url.includes('/auth/select-tenant')
      if (!isAuthFlow) {
        clearAccessToken()
        window.dispatchEvent(new CustomEvent('tenant:suspended'))
      }
    }
    return Promise.reject(error)
  }
)
