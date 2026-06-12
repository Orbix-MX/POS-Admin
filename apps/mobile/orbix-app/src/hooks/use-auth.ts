/**
 * Action-oriented view of the auth store for screens driving the auth flow
 * (login / select-tenant / select-branch / logout). Read-only session data
 * should come from `useSession()`; this hook is for the mutating actions and
 * their transient state (loading / error / available options).
 */
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/store/auth-store';

export function useAuth() {
  return useAuthStore(
    useShallow((s) => ({
      loading: s.loading,
      error: s.error,
      availableTenants: s.availableTenants,
      availableBranches: s.availableBranches,
      needsTenantSelection: s.needsTenantSelection,
      needsBranchSelection: s.needsBranchSelection,

      login: s.login,
      selectTenant: s.selectTenant,
      selectBranch: s.selectBranch,
      logout: s.logout,
      clearError: s.clearError,
    })),
  );
}
