import { create } from 'zustand'
import {
  login as loginApi,
  exchangeOAuthTicket,
  verifyMfaCode,
  logout as logoutApi,
  selectTenant as selectTenantApi,
  selectBranch as selectBranchApi,
  fetchCapabilities,
  fetchMe,
  fetchBranches,
  setAccessToken,
  clearAccessToken,
  setRefreshToken,
  clearRefreshToken,
  getAccessToken,
  getRefreshToken,
} from '@/services/core/auth-service'
import type { AuthUser, Tenant, Branch, LoginResponse } from '@/services/core/auth-service'
import { refreshSession } from '@/lib/session-refresh'
import { DEFAULT_BUSINESS_FEATURES, type BusinessFeatures } from '@/types/business-config'

interface AuthState {
  user: AuthUser | null
  tempToken: string | null
  availableTenants: Tenant[] | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  // Segundo paso del login cuando el usuario tiene MFA activo: contraseña u
  // OAuth ya se validaron, falta el código de 6 dígitos.
  mfaTicket: string | null
  plan: string | null
  enabledModules: string[]
  permissions: string[]
  overUserLimit: boolean
  capabilitiesLoaded: boolean
  businessVertical: string
  businessProfile: string
  posOperationMode: string
  enabledFeatures: string[]
  businessFeatures: BusinessFeatures

  // Branch state
  currentBranch: Branch | null
  availableBranches: Branch[] | null
  needsBranchSelection: boolean

  tenantSuspended: boolean

  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  loginWithOAuthTicket: (ticket: string) => Promise<void>
  verifyMfa: (code: string) => Promise<void>
  cancelMfa: () => void
  confirmTenant: (slug: string) => Promise<void>
  confirmBranch: (branchId: string) => Promise<void>
  logout: () => Promise<void>
  setTenantSuspended: (value: boolean) => void
}

/**
 * Aplica la respuesta de un login —por contraseña o por OAuth— al store.
 *
 * Con un solo tenant se encadena select-tenant + carga de sucursales y el
 * usuario entra directo. Con varios (o ninguno) se deja el JWT preliminar en
 * `tempToken` y decide la UI. Ambos caminos de acceso comparten esta función
 * para que no se separen con el tiempo.
 */
async function applySession(
  set: (partial: Partial<AuthState>) => void,
  session: LoginResponse,
) {
  // Contraseña/Google ya se validaron, pero falta el código MFA: no hay nada
  // más que aplicar todavía — ni access token, ni tenants — hasta que
  // `verifyMfa` complete el canje.
  if (session.mfaRequired) {
    set({ mfaTicket: session.mfaTicket ?? null, loading: false })
    return
  }

  // Sin `mfaRequired`, el contrato del API garantiza estos cuatro campos.
  const { accessToken, refreshToken, user, availableTenants } = session as Required<
    Pick<LoginResponse, 'accessToken' | 'user' | 'availableTenants'>
  > & LoginResponse

  // Se guarda antes de ramificar: el refresh token no depende del tenant, y con
  // varias empresas la selección puede tardar más que el access token en vencer.
  if (refreshToken) setRefreshToken(refreshToken)

  if (availableTenants.length !== 1) {
    set({ tempToken: accessToken, user, availableTenants, loading: false })
    return
  }

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
    businessProfile: res.businessProfile ?? 'RETAIL',
    posOperationMode: res.posOperationMode ?? 'QUICK_SALE',
    enabledFeatures: res.enabledFeatures ?? [],
    businessFeatures: res.businessFeatures ?? DEFAULT_BUSINESS_FEATURES,
  })
  await loadBranchesAndAutoSelect(set, profile?.currentBranchId)
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
  mfaTicket: null,
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
  businessProfile: 'RETAIL',
  posOperationMode: 'QUICK_SALE',
  enabledFeatures: [],
  businessFeatures: DEFAULT_BUSINESS_FEATURES,

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
    // Sin access token pero con refresh token: sesión recuperable. Pasa cuando
    // el access token se limpió y el navegador conserva el refresh. Si la
    // renovación falla, se sigue al camino normal de "no hay sesión".
    if (!getAccessToken() && getRefreshToken()) {
      await refreshSession().catch(() => {})
    }
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
        businessProfile: caps.businessProfile ?? 'RETAIL',
        posOperationMode: caps.posOperationMode ?? 'QUICK_SALE',
        enabledFeatures: caps.enabledFeatures ?? [],
        businessFeatures: caps.businessFeatures ?? DEFAULT_BUSINESS_FEATURES,
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
      await applySession(set, await loginApi(email, password))
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { message?: string; code?: string } } })?.response?.data
      const msg = data?.message ?? 'Credenciales incorrectas'
      set({ error: msg, loading: false })
    }
  },

  /**
   * Cierra el acceso con Google: canjea el ticket de un solo uso del callback y
   * continúa por el mismo camino que el login con contraseña — un solo tenant
   * entra directo, varios caen en la pantalla de selección.
   */
  loginWithOAuthTicket: async (ticket) => {
    set({ loading: true, error: null })
    try {
      await applySession(set, await exchangeOAuthTicket(ticket))
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { message?: string; code?: string } } })?.response?.data
      const msg = data?.message ?? 'No fue posible completar el acceso con Google'
      set({ error: msg, loading: false })
    }
  },

  /** Completa el login con el código MFA — segundo paso, tras `login`/`loginWithOAuthTicket`. */
  verifyMfa: async (code) => {
    const { mfaTicket } = get()
    if (!mfaTicket) return
    set({ loading: true, error: null })
    try {
      const session = await verifyMfaCode(mfaTicket, code)
      set({ mfaTicket: null })
      await applySession(set, session)
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { message?: string } } })?.response?.data
      set({ error: data?.message ?? 'Código incorrecto', loading: false })
    }
  },

  /** Vuelve a la pantalla de login sin completar el segundo paso. */
  cancelMfa: () => set({ mfaTicket: null, error: null }),

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
        businessProfile: res.businessProfile ?? 'RETAIL',
        posOperationMode: res.posOperationMode ?? 'QUICK_SALE',
        enabledFeatures: res.enabledFeatures ?? [],
        businessFeatures: res.businessFeatures ?? DEFAULT_BUSINESS_FEATURES,
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
    // El logout va antes de borrar nada: la petición necesita el access token
    // para autenticarse y el refresh token en el cuerpo para revocarse.
    await logoutApi().catch(() => {})
    clearAccessToken()
    clearRefreshToken()
    set({
      isAuthenticated: false,
      user: null,
      tempToken: null,
      mfaTicket: null,
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
      businessProfile: 'RETAIL',
      posOperationMode: 'QUICK_SALE',
      enabledFeatures: [],
      businessFeatures: DEFAULT_BUSINESS_FEATURES,
      tenantSuspended: false,
    })
  },
}))
