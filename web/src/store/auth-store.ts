import { create } from 'zustand'
import {
  login as loginApi,
  selectTenant as selectTenantApi,
  setAccessToken,
  clearAccessToken,
  getAccessToken,
} from '@/services/core/auth-service'
import type { AuthUser, Tenant } from '@/services/core/auth-service'

interface AuthState {
  user: AuthUser | null
  tempToken: string | null
  availableTenants: Tenant[] | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  confirmTenant: (slug: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tempToken: null,
  availableTenants: null,
  isAuthenticated: !!getAccessToken(),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { accessToken, user, availableTenants } = await loginApi(email, password)

      if (availableTenants.length === 1) {
        const { accessToken: finalToken } = await selectTenantApi(availableTenants[0].slug, accessToken)
        setAccessToken(finalToken)
        set({ isAuthenticated: true, user, tempToken: null, availableTenants: null, loading: false })
      } else {
        set({ tempToken: accessToken, user, availableTenants, loading: false })
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Credenciales incorrectas'
      set({ error: msg, loading: false })
    }
  },

  confirmTenant: async (slug) => {
    const { tempToken } = get()
    if (!tempToken) return
    set({ loading: true, error: null })
    try {
      const { accessToken: finalToken } = await selectTenantApi(slug, tempToken)
      setAccessToken(finalToken)
      set({ isAuthenticated: true, tempToken: null, availableTenants: null, loading: false })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al seleccionar tienda'
      set({ error: msg, loading: false })
    }
  },

  logout: () => {
    clearAccessToken()
    set({ isAuthenticated: false, user: null, tempToken: null, availableTenants: null, error: null })
  },
}))
