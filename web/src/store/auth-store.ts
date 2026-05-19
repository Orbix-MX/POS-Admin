import { create } from 'zustand'
import {
  login as loginApi,
  logout as logoutApi,
  selectTenant as selectTenantApi,
  fetchCapabilities,
  fetchMe,
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
  plan: string | null
  enabledModules: string[]
  permissions: string[]
  overUserLimit: boolean
  capabilitiesLoaded: boolean

  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  confirmTenant: (slug: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tempToken: null,
  availableTenants: null,
  isAuthenticated: !!getAccessToken(),
  loading: false,
  error: null,
  plan: null,
  enabledModules: [],
  permissions: [],
  overUserLimit: false,
  capabilitiesLoaded: !getAccessToken(), // true if no token (not authenticated)

  init: async () => {
    if (!getAccessToken()) { set({ capabilitiesLoaded: true }); return }
    try {
      const [caps, profile] = await Promise.all([fetchCapabilities(), fetchMe()])
      set({
        plan: caps.plan ?? null,
        enabledModules: caps.effectiveModules ?? [],
        permissions: profile.permissions ?? [],
        overUserLimit: caps.overUserLimit ?? false,
        capabilitiesLoaded: true,
        user: profile.user,
      })
    } catch {
      set({ capabilitiesLoaded: true }) // interceptor handles 401 reload
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { accessToken, user, availableTenants } = await loginApi(email, password)

      if (availableTenants.length === 1) {
        const res = await selectTenantApi(availableTenants[0].slug, accessToken)
        setAccessToken(res.accessToken)
        // Load permissions now that tenant is selected and token is set
        const profile = await fetchMe().catch(() => null)
        set({
          isAuthenticated: true,
          user: profile?.user ?? user,
          permissions: profile?.permissions ?? [],
          tempToken: null,
          availableTenants: null,
          loading: false,
          plan: res.plan ?? null,
          enabledModules: res.enabledModules ?? [],
          capabilitiesLoaded: true,
        })
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
      const res = await selectTenantApi(slug, tempToken)
      setAccessToken(res.accessToken)
      // Load permissions now that tenant is selected and token is set
      const profile = await fetchMe().catch(() => null)
      set({
        isAuthenticated: true,
        user: profile?.user ?? get().user,
        permissions: profile?.permissions ?? [],
        tempToken: null,
        availableTenants: null,
        loading: false,
        plan: res.plan ?? null,
        enabledModules: res.enabledModules ?? [],
        capabilitiesLoaded: true,
      })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al seleccionar tienda'
      set({ error: msg, loading: false })
    }
  },

  logout: async () => {
    await logoutApi().catch(() => {})
    clearAccessToken()
    set({
      isAuthenticated: false,
      user: null,
      tempToken: null,
      availableTenants: null,
      error: null,
      plan: null,
      enabledModules: [],
      permissions: [],
      overUserLimit: false,
      capabilitiesLoaded: true,
    })
  },
}))
