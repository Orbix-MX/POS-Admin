/**
 * React shell over `authService`.
 *
 * Holds the session in state and exposes the operations screens need. All the
 * actual logic (token persistence, refresh, staged tenant selection) lives in
 * the service so it stays testable without a renderer.
 */
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { AuthStatus, Session, TenantSummary } from '@/models/session';
import { authTokenStore } from '@/services/api';
import { authService } from '@/services/auth/auth-service';
import { sessionStorage } from '@/services/auth/session-storage';
import type { RegisterInput } from '@/repositories/auth-repository';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  /** True once a tenant is selected — i.e. the JWT carries `tenantId`. */
  hasTenant: boolean;
  register: (input: RegisterInput) => Promise<Session>;
  login: (email: string, password: string) => Promise<Session>;
  logout: () => Promise<void>;
  selectTenant: (tenant: TenantSummary) => Promise<Session>;
  selectBranch: (branchId: string) => Promise<Session>;
  /** Replaces the session after a flow that mints its own token (onboarding). */
  applySession: (session: Session) => void;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);

  // Guards against a late `restore()` resolving after a logout raced it.
  const restoreToken = useRef(0);

  useEffect(() => {
    authService.initialize();

    const generation = ++restoreToken.current;
    void (async () => {
      const restored = await authService.restore();
      if (generation !== restoreToken.current) return;
      setSession(restored);
      setStatus(restored ? 'authenticated' : 'unauthenticated');
    })();
  }, []);

  // The axios interceptor cannot navigate; it signals here instead.
  useEffect(
    () =>
      authTokenStore.onUnauthorized(() => {
        restoreToken.current++;
        setSession(null);
        setStatus('unauthenticated');
      }),
    [],
  );

  const register = useCallback(async (input: RegisterInput) => {
    const next = await authService.register(input);
    setSession(next);
    setStatus('authenticated');
    return next;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const next = await authService.login(email, password);
    setSession(next);
    setStatus('authenticated');
    return next;
  }, []);

  const logout = useCallback(async () => {
    restoreToken.current++;
    await authService.logout();
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  const selectTenant = useCallback(
    async (tenant: TenantSummary) => {
      if (!session) throw new Error('Cannot select a tenant without a session.');
      const next = await authService.selectTenant(session, tenant);
      setSession(next);
      return next;
    },
    [session],
  );

  const selectBranch = useCallback(
    async (branchId: string) => {
      if (!session) throw new Error('Cannot select a branch without a session.');
      const next = await authService.selectBranch(session, branchId);
      setSession(next);
      return next;
    },
    [session],
  );

  const applySession = useCallback((next: Session) => {
    sessionStorage.saveSession(next);
    setSession(next);
    setStatus('authenticated');
  }, []);

  const refresh = useCallback(async () => {
    const restored = await authService.restore();
    setSession(restored);
    setStatus(restored ? 'authenticated' : 'unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      hasTenant: Boolean(session?.tenant),
      register,
      login,
      logout,
      selectTenant,
      selectBranch,
      applySession,
      refresh,
    }),
    [status, session, register, login, logout, selectTenant, selectBranch, applySession, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
