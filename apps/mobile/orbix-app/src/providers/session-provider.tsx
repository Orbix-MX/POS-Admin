/**
 * Phase 7 — SessionProvider.
 *
 * Owns the session lifecycle and exposes the current session to the tree:
 *   user · tenant · branch · permissions · modules (+ plan / vertical / features).
 *
 * Responsibilities:
 *   - Bootstraps the session once on mount (restore tokens → fetch profile).
 *   - Reacts to API session events (expired / tenant-suspended) by resetting.
 *   - Controls the native splash screen until bootstrap settles.
 *
 * Session *data* lives in the Zustand auth store; this provider is the React
 * bridge + lifecycle owner, and `useSession()` is the read API for screens.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type PropsWithChildren,
} from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from '@/store/auth-store';
import { onSessionExpired, onTenantSuspended } from '@/services/api-client';
import type { AuthUser, TenantSummary, Branch } from '@/types/auth';
import type {
  TenantPlan,
  BusinessVertical,
  PosOperationMode,
  TenantFeature,
} from '@orbix/types';

void SplashScreen.preventAutoHideAsync();

export interface SessionContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;

  user: AuthUser | null;
  tenant: TenantSummary | null;
  branch: Branch | null;
  permissions: string[];
  modules: string[];

  plan: TenantPlan | null;
  businessVertical: BusinessVertical;
  posOperationMode: PosOperationMode;
  enabledFeatures: TenantFeature[];

  // flow flags
  needsTenantSelection: boolean;
  needsBranchSelection: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const bootstrapped = useRef(false);

  const session = useAuthStore(
    useShallow((s) => ({
      status: s.status,
      user: s.user,
      tenant: s.tenant,
      branch: s.branch,
      permissions: s.permissions,
      modules: s.modules,
      plan: s.plan,
      businessVertical: s.businessVertical,
      posOperationMode: s.posOperationMode,
      enabledFeatures: s.enabledFeatures,
      needsTenantSelection: s.needsTenantSelection,
      needsBranchSelection: s.needsBranchSelection,
    })),
  );

  // Bootstrap once.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void useAuthStore.getState().bootstrap();
  }, []);

  // React to API-driven session termination.
  useEffect(() => {
    const reset = () => useAuthStore.getState().reset();
    const offExpired = onSessionExpired(reset);
    const offSuspended = onTenantSuspended(reset);
    return () => {
      offExpired();
      offSuspended();
    };
  }, []);

  // Hide the splash once we know whether the user is logged in.
  useEffect(() => {
    if (session.status !== 'booting') {
      void SplashScreen.hideAsync();
    }
  }, [session.status]);

  const value: SessionContextValue = {
    isLoading: session.status === 'booting',
    isAuthenticated: session.status === 'authenticated',
    user: session.user,
    tenant: session.tenant,
    branch: session.branch,
    permissions: session.permissions,
    modules: session.modules,
    plan: session.plan,
    businessVertical: session.businessVertical,
    posOperationMode: session.posOperationMode,
    enabledFeatures: session.enabledFeatures,
    needsTenantSelection: session.needsTenantSelection,
    needsBranchSelection: session.needsBranchSelection,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
