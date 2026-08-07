/**
 * In-memory token holder shared by the axios interceptors and the auth layer.
 *
 * The interceptor runs on every request and cannot await the keychain, so the
 * tokens are mirrored here after being read once at boot. This module owns no
 * persistence — `AuthService` keeps it in sync with `secureStorage`.
 *
 * It also carries the "session died" signal: when a refresh definitively fails,
 * the interceptor has no way to navigate, so it notifies subscribers instead.
 */
type UnauthorizedListener = () => void;

let accessToken: string | null = null;
let refreshToken: string | null = null;
const listeners = new Set<UnauthorizedListener>();

export const authTokenStore = {
  getAccessToken: (): string | null => accessToken,
  getRefreshToken: (): string | null => refreshToken,

  set(tokens: { accessToken: string | null; refreshToken?: string | null }): void {
    accessToken = tokens.accessToken;
    if (tokens.refreshToken !== undefined) refreshToken = tokens.refreshToken;
  },

  clear(): void {
    accessToken = null;
    refreshToken = null;
  },

  /** Subscribe to irrecoverable auth failures. Returns an unsubscribe fn. */
  onUnauthorized(listener: UnauthorizedListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  emitUnauthorized(): void {
    for (const listener of listeners) listener();
  },
} as const;
