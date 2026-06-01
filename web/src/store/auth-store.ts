import { create } from 'zustand'
import {
  login as loginApi,
  logout as logoutApi,
  selectTenant as selectTenantApi,
  selectBranch as selectBranchApi,
  fetchCapabilities,
  fetchMe,
  fetchBranches,
  setAccessToken,
  clearAccessToken,
  getAccessToken,
} from '@/services/core/auth-service'
import type { AuthUser, Tenant, Branch } from '@/services/core/auth-service'

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
  businessVertical: string
  posOperationMode: string
  enabledFeatures: string[]

  // Branch state
  currentBranch: Branch | null
  availableBranches: Branch[] | null
  needsBranchSelection: boolean

  tenantSuspended: boolean

  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  confirmTenant: (slug: string) => Promise<void>
  confirmBranch: (branchId: string) => Promise<void>
  logout: () => Promise<void>
  setTenantSuspended: (value: boolean) => void
}

async function loadBranchesAndAutoSelect(
  set: (partial: Partial<AuthState>) => void,
  currentBranchId?: string,
) {
  try {
    const branches = await fetchBranches()
    const activeBranches = branches.filter((b) => b.status === 'ACTIVE')

    if (activeBranches.length === 0) {
      set({ availableBranches: [], currentBranch: null, needsBranchSelection: false })
      return
    }

    // If only one active branch, auto-select it
    if (activeBranches.length === 1) {
      const branch = activeBranches[0]
      const res = await selectBranchApi(branch.id)
      setAccessToken(res.accessToken)
      set({ currentBranch: branch, availableBranches: activeBranches, needsBranchSelection: false })
      return
    }

    // Multiple branches — restore last selected or require selection
    const restored = currentBranchId
      ? activeBranches.find((b) => b.id === currentBranchId) ?? null
      : null

    if (restored) {
      // Already selected in JWT, no need to re-select
      set({ currentBranch: restored, availableBranches: activeBranches, needsBranchSelection: false })
    } else {
      set({ currentBranch: null, availableBranches: activeBranches, needsBranchSelection: true })
    }
  } catch {
    set({ availableBranches: [], needsBranchSelection: false })
  }
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
  capabilitiesLoaded: !getAccessToken(),
  businessVertical: 'RETAIL',
  posOperationMode: 'QUICK_SALE',
  enabledFeatures: [],

  currentBranch: null,
  availableBranches: null,
  needsBranchSelection: false,
  tenantSuspended: false,

  setTenantSuspended: (value) => set({
    tenantSuspended: value,
    isAuthenticated: false,
    capabilitiesLoaded: true,
  }),

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
        businessVertical: caps.businessVertical ?? 'RETAIL',
        posOperationMode: caps.posOperationMode ?? 'QUICK_SALE',
        enabledFeatures: caps.enabledFeatures ?? [],
      })
      // Restore branch selection
      await loadBranchesAndAutoSelect(set, profile.currentBranchId)
    } catch {
      set({ capabilitiesLoaded: true })
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { accessToken, user, availableTenants } = await loginApi(email, password)

      if (availableTenants.length === 1) {
        const res = await selectTenantApi(availableTenants[0].slug, accessToken)
        setAccessToken(res.accessToken)
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
          businessVertical: res.businessVertical ?? 'RETAIL',
          posOperationMode: res.posOperationMode ?? 'QUICK_SALE',
          enabledFeatures: res.enabledFeatures ?? [],
        })
        await loadBranchesAndAutoSelect(set, profile?.currentBranchId)
      } else {
        set({ tempToken: accessToken, user, availableTenants, loading: false })
      }
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { message?: string; code?: string } } })?.response?.data
      const msg = data?.message ?? 'Credenciales incorrectas'
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
        businessVertical: res.businessVertical ?? 'RETAIL',
        posOperationMode: res.posOperationMode ?? 'QUICK_SALE',
        enabledFeatures: res.enabledFeatures ?? [],
      })
      await loadBranchesAndAutoSelect(set, profile?.currentBranchId)
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { message?: string; code?: string } } })?.response?.data
      const msg = data?.message ?? 'Error al seleccionar tienda'
      set({ error: msg, loading: false })
    }
  },

  confirmBranch: async (branchId) => {
    set({ loading: true, error: null })
    try {
      const res = await selectBranchApi(branchId)
      setAccessToken(res.accessToken)
      const { availableBranches } = get()
      const branch = availableBranches?.find((b) => b.id === branchId) ?? null
      set({ currentBranch: branch, needsBranchSelection: false, loading: false })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al seleccionar sucursal'
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
      currentBranch: null,
      availableBranches: null,
      needsBranchSelection: false,
      businessVertical: 'RETAIL',
      posOperationMode: 'QUICK_SALE',
      enabledFeatures: [],
      tenantSuspended: false,
    })
  },
}))
