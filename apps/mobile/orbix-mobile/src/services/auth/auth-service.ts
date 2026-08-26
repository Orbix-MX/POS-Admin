/**
 * Owns the session lifecycle: token persistence, auto-login and the refresh
 * handler the axios interceptor calls on a 401.
 *
 * Deliberately framework-free — `AuthProvider` is a thin React shell over this.
 */
import type { MfaConfirmResponseDto, MfaSetupResponseDto } from '@/dto/auth.dto';
import type { GoogleSignInRequestDto } from '@/dto/onboarding.dto';
import type { Session, TenantSummary } from '@/models/session';
import {
  authRepository,
  type AuthResult,
  type MfaRequiredResult,
  type RegisterInput,
} from '@/repositories/auth-repository';
import { authTokenStore, setRefreshHandler } from '@/services/api';
import { secureStorage } from '@/services/storage/secure-storage';

import { sessionStorage } from './session-storage';

function sessionFromAuthResult(result: AuthResult): Session {
  return {
    user: result.user,
    tenant: result.tenant,
    availableTenants: result.availableTenants,
    permissions: [],
    roles: [],
  };
}

async function persistTokens(accessToken: string, refreshToken: string | null): Promise<void> {
  authTokenStore.set({ accessToken, refreshToken });
  await secureStorage.setTokens({ accessToken, refreshToken });
}

export const authService = {
  /**
   * Wires the interceptor's refresh callback. Called once at app start, before
   * any request can fire.
   */
  initialize(): void {
    setRefreshHandler(async () => {
      const refreshToken = authTokenStore.getRefreshToken();
      if (!refreshToken) return null;
      try {
        const rotated = await authRepository.refresh(refreshToken);
        await persistTokens(rotated.accessToken, rotated.refreshToken);
        return rotated.accessToken;
      } catch {
        // The refresh token was revoked or expired: the session is over.
        await authService.clearLocalSession();
        return null;
      }
    });
  },

  /**
   * Restores a session at cold start.
   *
   * Returns the cached session immediately if the network is unavailable — the
   * app is offline-first, and an expired access token will be refreshed lazily
   * by the interceptor on the first real request.
   */
  async restore(): Promise<Session | null> {
    const tokens = await secureStorage.getTokens();
    if (!tokens) return null;

    authTokenStore.set(tokens);

    try {
      const session = await authRepository.getProfile();
      sessionStorage.saveSession(session);
      return session;
    } catch {
      return sessionStorage.getSession();
    }
  },

  async register(input: RegisterInput): Promise<Session> {
    const result = await authRepository.register(input);
    await persistTokens(result.accessToken, result.refreshToken);
    const session = sessionFromAuthResult(result);
    sessionStorage.saveSession(session);
    return session;
  },

  async login(email: string, password: string): Promise<Session | MfaRequiredResult> {
    const outcome = await authRepository.login({ email, password });
    return authService.applyLoginOutcome(outcome);
  },

  /** `request` comes from `useGoogleAuth` once the PKCE dance with Google finished. */
  async loginWithGoogle(request: GoogleSignInRequestDto): Promise<Session | MfaRequiredResult> {
    const outcome = await authRepository.googleSignIn(request);
    return authService.applyLoginOutcome(outcome);
  },

  /** Shared by `login` and `loginWithGoogle` — same session-vs-MFA branch either way. */
  async applyLoginOutcome(outcome: AuthResult | MfaRequiredResult): Promise<Session | MfaRequiredResult> {
    if ('mfaRequired' in outcome) return outcome;
    await persistTokens(outcome.accessToken, outcome.refreshToken);
    const session = sessionFromAuthResult(outcome);
    sessionStorage.saveSession(session);
    return session;
  },

  /** Second step of login when `mfaRequired` came back true. */
  async verifyMfa(mfaTicket: string, code: string): Promise<Session> {
    const result = await authRepository.verifyMfa(mfaTicket, code);
    await persistTokens(result.accessToken, result.refreshToken);
    const session = sessionFromAuthResult(result);
    sessionStorage.saveSession(session);
    return session;
  },

  /** `POST /auth/mfa/setup` — generates a new TOTP secret; not active until `confirmMfa`. */
  async setupMfa(): Promise<MfaSetupResponseDto> {
    return authRepository.setupMfa();
  },

  /** Confirms setup with the first code and returns fresh backup codes. */
  async confirmMfa(code: string): Promise<MfaConfirmResponseDto> {
    return authRepository.confirmMfa(code);
  },

  /** Requires a valid TOTP/backup code — the API re-checks it server-side either way. */
  async disableMfa(code: string): Promise<void> {
    await authRepository.disableMfa(code);
  },

  /**
   * Step 2 of the API's staged auth: exchanges the preliminary JWT for one that
   * carries `tenantId`, and records the choice so the next launch restores it.
   */
  async selectTenant(session: Session, tenant: TenantSummary): Promise<Session> {
    const result = await authRepository.selectTenant(tenant.slug);
    await secureStorage.setAccessToken(result.accessToken);
    authTokenStore.set({ accessToken: result.accessToken });

    const next: Session = {
      ...session,
      tenant: result.tenant,
      capabilities: result.capabilities,
    };
    sessionStorage.saveSession(next);
    sessionStorage.saveActiveContext({ tenantSlug: result.tenant.slug });
    return next;
  },

  async selectBranch(session: Session, branchId: string): Promise<Session> {
    const result = await authRepository.selectBranch(branchId);
    await secureStorage.setAccessToken(result.accessToken);
    authTokenStore.set({ accessToken: result.accessToken });

    const next: Session = { ...session, branchId: result.branchId };
    sessionStorage.saveSession(next);
    sessionStorage.saveActiveContext({
      tenantSlug: session.tenant?.slug,
      branchId: result.branchId,
    });
    return next;
  },

  /** Best-effort server logout; the local session is cleared either way. */
  async logout(): Promise<void> {
    try {
      await authRepository.logout(authTokenStore.getRefreshToken());
    } catch {
      // Revoking server-side is a courtesy — never block the user from leaving.
    } finally {
      await authService.clearLocalSession();
    }
  },

  async clearLocalSession(): Promise<void> {
    authTokenStore.clear();
    sessionStorage.clear();
    await secureStorage.clear();
  },
} as const;
