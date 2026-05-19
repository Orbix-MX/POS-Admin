import { create } from 'zustand'
import {
  platformLogin, fetchPlatformMe,
  setPlatformToken, clearPlatformToken, getPlatformToken,
} from '@/services/platform/platform-auth-service'
import type { PlatformUser } from '@/services/platform/platform-auth-service'

interface PlatformAuthState {
  user: PlatformUser | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null

  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const usePlatformAuthStore = create<PlatformAuthState>((set) => ({
  user: null,
  isAuthenticated: !!getPlatformToken(),
  loading: false,
  error: null,

  init: async () => {
    if (!getPlatformToken()) return
    try {
      const user = await fetchPlatformMe()
      set({ user, isAuthenticated: true })
    } catch {
      clearPlatformToken()
      set({ isAuthenticated: false, user: null })
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { accessToken, user } = await platformLogin(email, password)
      setPlatformToken(accessToken)
      set({ isAuthenticated: true, user, loading: false })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Credenciales incorrectas'
      set({ error: msg, loading: false })
    }
  },

  logout: () => {
    clearPlatformToken()
    set({ isAuthenticated: false, user: null, error: null })
  },
}))
