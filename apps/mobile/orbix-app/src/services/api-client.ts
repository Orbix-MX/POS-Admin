/**
 * Phase 5 — API layer.
 *
 * Single axios instance every feature must use to talk to the NestJS API.
 * Responsibilities:
 *   - JWT: attaches the in-memory access token to every request.
 *   - Refresh: on a 401 it transparently exchanges the refresh token for a new
 *     access token (single-flight — concurrent 401s share one refresh) and
 *     replays the original request once.
 *   - Error handling: surfaces a normalized message and emits session-level
 *     events (expired / tenant-suspended) the auth store can react to.
 *
 * Tokens live both in an in-memory cache (sync access for the request
 * interceptor) and in SecureStore (durable). Always mutate them through
 * `persistTokens` / `clearTokens` so the two stay in sync.
 */
import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import { Env } from '@/constants/env';
import { tokenStorage } from './token-storage';
import type { RefreshResponse } from '@/types/auth';

// ─── In-memory token cache ───────────────────────────────────────────────────
let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;

/** Loads tokens from SecureStore into the cache (call once on app start). */
export async function hydrateTokens(): Promise<{ accessToken: string | null }> {
  const [accessToken, refreshToken] = await Promise.all([
    tokenStorage.getAccessToken(),
    tokenStorage.getRefreshToken(),
  ]);
  accessTokenCache = accessToken;
  refreshTokenCache = refreshToken;
  return { accessToken };
}

/** Persists tokens to cache + SecureStore. Pass refreshToken only when rotated. */
export async function persistTokens(accessToken: string, refreshToken?: string): Promise<void> {
  accessTokenCache = accessToken;
  if (refreshToken !== undefined) refreshTokenCache = refreshToken;
  await tokenStorage.setTokens(accessToken, refreshToken);
}

/** Clears tokens from cache + SecureStore. */
export async function clearTokens(): Promise<void> {
  accessTokenCache = null;
  refreshTokenCache = null;
  await tokenStorage.clear();
}

// ─── Session lifecycle events ────────────────────────────────────────────────
type Listener = () => void;
const sessionExpiredListeners = new Set<Listener>();
const tenantSuspendedListeners = new Set<Listener>();

/** Fired when the refresh flow fails — the auth store should reset to logged-out. */
export function onSessionExpired(fn: Listener): () => void {
  sessionExpiredListeners.add(fn);
  return () => sessionExpiredListeners.delete(fn);
}

/** Fired when the API reports the active tenant is suspended/inactive. */
export function onTenantSuspended(fn: Listener): () => void {
  tenantSuspendedListeners.add(fn);
  return () => tenantSuspendedListeners.delete(fn);
}

// ─── Axios instance ──────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: Env.apiUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/devices/validate',
  '/devices/activate',
  '/staff/pin-login',
];
function isAuthEndpoint(url?: string): boolean {
  return !!url && AUTH_ENDPOINTS.some((p) => url.includes(p));
}

/**
 * Attaches the device credential to every request as `X-Device-Token`. The
 * device is the API principal in the comandera; pass null to clear (unlink).
 * (Server-side device-auth on business endpoints is future work.)
 */
export function setDeviceAuthToken(token: string | null): void {
  if (token) apiClient.defaults.headers.common['X-Device-Token'] = token;
  else delete apiClient.defaults.headers.common['X-Device-Token'];
}

apiClient.interceptors.request.use((config) => {
  if (accessTokenCache) {
    config.headers.Authorization = `Bearer ${accessTokenCache}`;
  }
  return config;
});

// ─── Refresh (single-flight) ─────────────────────────────────────────────────
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshTokenCache) return null;

  // Coalesce concurrent refreshes into one network call.
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        // Bare axios (not the instance) so this request skips the interceptors
        // and can't recurse into another refresh.
        const { data } = await axios.post<RefreshResponse>(
          `${Env.apiUrl}/auth/refresh`,
          { refreshToken: refreshTokenCache },
          { timeout: 15_000 },
        );
        await persistTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      } catch {
        await clearTokens();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string; message?: string }>) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const code = error.response?.data?.code;

    // Tenant suspended/inactive → hard stop, surface to the app.
    if (status === 403 && code === 'TENANT_SUSPENDED' && !isAuthEndpoint(original?.url)) {
      tenantSuspendedListeners.forEach((fn) => fn());
      return Promise.reject(error);
    }

    // Expired access token → try a one-shot refresh + replay.
    if (status === 401 && original && !original._retry && !isAuthEndpoint(original.url)) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
      sessionExpiredListeners.forEach((fn) => fn());
    }

    return Promise.reject(error);
  },
);

/** Extracts a human-friendly message from an axios/API error. */
export function getApiErrorMessage(error: unknown, fallback = 'Algo salió mal'): string {
  if (axios.isAxiosError(error)) {
    // No response = couldn't reach the API (wrong URL / device can't see the
    // host / CORS on web). Surface that instead of a misleading domain message.
    if (!error.response) {
      return `No se pudo conectar con el servidor (${Env.apiUrl}). Verifica la red y la URL del API.`;
    }
    const data = error.response.data as { message?: string | string[] } | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg[0] ?? fallback;
    if (typeof msg === 'string') return msg;
  }
  return fallback;
}
