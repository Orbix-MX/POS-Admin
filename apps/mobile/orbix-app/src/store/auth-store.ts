/**
 * Phase 4 — Global auth/session state (Zustand).
 *
 * Single source of truth for the session. Holds the data the rest of the app
 * reads through `SessionProvider` (user / tenant / branch / permissions /
 * modules) and the actions that drive the NestJS two-step auth flow
 * (login → select-tenant → select-branch).
 *
 * This is session orchestration only — no domain/business logic lives here.
 */
import { create } from 'zustand';
import {
  login as loginApi,
  selectTenant as selectTenantApi,
  selectBranch as selectBranchApi,
  fetchProfile,
  fetchCapabilities,
  fetchBranches,
  logout as logoutApi,
} from '@/services/auth-service';
import { hydrateTokens, getApiErrorMessage } from '@/services/api-client';
import { tokenStorage } from '@/services/token-storage';
import type {
  AuthUser,
  TenantSummary,
  Branch,
} from '@/types/auth';
import type {
  TenantPlan,
  BusinessVertical,
  PosOperationMode,
  TenantFeature,
} from '@orbix/types';

export type SessionStatus = 'booting' | 'unauthenticated' | 'authenticated';

interface AuthState {
  status: SessionStatus;
  loading: boolean;
  error: string | null;

  user: AuthUser | null;
  availableTenants: TenantSummary[] | null;
  tenant: TenantSummary | null;
  needsTenantSelection: boolean;

  availableBranches: Branch[] | null;
  branch: Branch | null;
  needsBranchSelection: boolean;

  permissions: string[];
  modules: string[];
  plan: TenantPlan | null;
  businessVertical: BusinessVertical;
  posOperationMode: PosOperationMode;
  enabledFeatures: TenantFeature[];

  // actions
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  selectTenant: (slug: string) => Promise<void>;
  selectBranch: (branchId: string) => Promise<void>;
  logout: () => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

const initialSession = {
  user: null,
  availableTenants: null,
  tenant: null,
  needsTenantSelection: false,
  availableBranches: null,
  branch: null,
  needsBranchSelection: false,
  permissions: [] as string[],
  modules: [] as string[],
  plan: null as TenantPlan | null,
  businessVertical: 'RESTAURANT' as BusinessVertical,
  posOperationMode: 'TABLE_SERVICE' as PosOperationMode,
  enabledFeatures: [] as TenantFeature[],
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'booting',
  loading: false,
  error: null,
  ...initialSession,

  /** Restore a persisted session on app start. */
  bootstrap: async () => {
    const { accessToken } = await hydrateTokens();
    if (!accessToken) {
      set({ status: 'unauthenticated' });
      return;
    }
    try {
      const [profile, caps] = await Promise.all([fetchProfile(), fetchCapabilities()]);
      set({
        user: profile.user,
        permissions: profile.permissions ?? [],
        tenant: profile.currentTenant ?? null,
        modules: caps.effectiveModules ?? [],
        plan: caps.plan ?? null,
        businessVertical: caps.businessVertical,
        posOperationMode: caps.posOperationMode,
        enabledFeatures: caps.enabledFeatures ?? [],
        status: 'authenticated',
      });
      await resolveBranches(set, profile.currentBranchId);
    } catch {
      // Token invalid/expired and refresh failed → treat as logged out.
      await tokenStorage.clear();
      set({ ...initialSession, status: 'unauthenticated' });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await loginApi(email, password);
      const tenants = res.availableTenants ?? [];

      // Single tenant → auto-select to streamline onboarding.
      if (tenants.length === 1) {
        set({ user: res.user });
        await get().selectTenant(tenants[0].slug);
        set({ loading: false });
        return;
      }

      set({
        user: res.user,
        availableTenants: tenants,
        needsTenantSelection: tenants.length > 1,
        status: tenants.length > 1 ? 'booting' : 'unauthenticated',
        loading: false,
      });
    } catch (e) {
      set({ error: getApiErrorMessage(e, 'Credenciales incorrectas'), loading: false });
    }
  },

  selectTenant: async (slug) => {
    set({ loading: true, error: null });
    try {
      const res = await selectTenantApi(slug);
      const [profile, caps] = await Promise.all([
        fetchProfile().catch(() => null),
        fetchCapabilities().catch(() => null),
      ]);
      set({
        tenant: res.tenant,
        plan: res.plan,
        // capabilities is authoritative for effective modules; fall back to the
        // select-tenant payload if that call failed.
        modules: caps?.effectiveModules ?? res.enabledModules,
        businessVertical: res.businessVertical,
        posOperationMode: res.posOperationMode,
        enabledFeatures: res.enabledFeatures,
        permissions: profile?.permissions ?? [],
        user: profile?.user ?? get().user,
        availableTenants: null,
        needsTenantSelection: false,
        status: 'authenticated',
        loading: false,
      });
      await resolveBranches(set, profile?.currentBranchId);
    } catch (e) {
      set({ error: getApiErrorMessage(e, 'Error al seleccionar la empresa'), loading: false });
    }
  },

  selectBranch: async (branchId) => {
    set({ loading: true, error: null });
    try {
      await selectBranchApi(branchId);
      const branch = get().availableBranches?.find((b) => b.id === branchId) ?? null;
      set({ branch, needsBranchSelection: false, loading: false });
    } catch (e) {
      set({ error: getApiErrorMessage(e, 'Error al seleccionar la sucursal'), loading: false });
    }
  },

  logout: async () => {
    const refreshToken = (await tokenStorage.getRefreshToken()) ?? undefined;
    await logoutApi(refreshToken);
    get().reset();
  },

  /** Local-only reset (used on logout and on session-expired events). */
  reset: () => set({ ...initialSession, status: 'unauthenticated', error: null, loading: false }),

  clearError: () => set({ error: null }),
}));

/**
 * Loads the tenant's branches and either auto-selects the only/last one or
 * flags that a manual selection is required. Mirrors the web behavior.
 */
async function resolveBranches(
  set: (partial: Partial<AuthState>) => void,
  currentBranchId?: string,
): Promise<void> {
  try {
    const branches = (await fetchBranches()).filter((b) => b.status === 'ACTIVE');

    if (branches.length === 0) {
      set({ availableBranches: [], branch: null, needsBranchSelection: false });
      return;
    }

    if (branches.length === 1) {
      await selectBranchApi(branches[0].id);
      set({ availableBranches: branches, branch: branches[0], needsBranchSelection: false });
      return;
    }

    const restored = currentBranchId ? branches.find((b) => b.id === currentBranchId) ?? null : null;
    set({
      availableBranches: branches,
      branch: restored,
      needsBranchSelection: !restored,
    });
  } catch {
    set({ availableBranches: [], needsBranchSelection: false });
  }
}
