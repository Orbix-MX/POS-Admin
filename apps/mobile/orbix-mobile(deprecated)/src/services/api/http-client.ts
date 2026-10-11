/**
 * The single axios instance for the whole app.
 *
 * Screens never import this — they go through hooks → repositories → here.
 *
 * Interceptors, in order:
 *   request  — Bearer token, Accept-Language, offline short-circuit
 *   response — normalise errors, refresh-and-retry exactly once on 401
 */
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '@/constants/env';

import { ApiError, toApiError } from './api-error';
import { authTokenStore } from './auth-token-store';
import { networkStatus } from './network-status';

/** Endpoints that must never carry a stale Bearer or trigger a refresh loop. */
const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/google'];

interface RetryableConfig extends InternalAxiosRequestConfig {
  /** Guards against an infinite refresh↔retry loop. */
  _retriedAfterRefresh?: boolean;
  /** Set by repositories that must bypass the offline short-circuit. */
  _allowOffline?: boolean;
}

function isPublicPath(url: string | undefined): boolean {
  if (!url) return false;
  return PUBLIC_PATHS.some((path) => url.startsWith(path));
}

export const httpClient: AxiosInstance = axios.create({
  baseURL: env.apiUrl,
  timeout: env.apiTimeout,
  headers: { 'Content-Type': 'application/json' },
});

/** Set by the i18n layer so the API can localize validation messages. */
let acceptLanguage: string = env.defaultLocale;
export function setAcceptLanguage(locale: string): void {
  acceptLanguage = locale;
}

/* ── Request ─────────────────────────────────────────────────────────────── */

httpClient.interceptors.request.use((config: RetryableConfig) => {
  // Failing fast while offline beats waiting out the full timeout, and gives
  // the UI a precise error to render.
  if (!networkStatus.isOnline() && !config._allowOffline) {
    throw new ApiError('network', 'No internet connection.');
  }

  config.headers.set('Accept-Language', acceptLanguage);

  const token = authTokenStore.getAccessToken();
  if (token && !isPublicPath(config.url)) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

/* ── Response: refresh-and-retry ─────────────────────────────────────────── */

/**
 * A single in-flight refresh shared by every concurrent 401. Without this, N
 * parallel requests would each rotate the refresh token and invalidate one
 * another — the API rotates on every use.
 */
let refreshInFlight: Promise<string | null> | null = null;

/** Injected by `AuthService` to avoid a circular import. */
let refreshHandler: (() => Promise<string | null>) | null = null;
export function setRefreshHandler(handler: () => Promise<string | null>): void {
  refreshHandler = handler;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshHandler) return null;
  refreshInFlight ??= refreshHandler().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const apiError = toApiError(error);
    const config = (error as { config?: RetryableConfig }).config;

    const canRetry =
      apiError.kind === 'unauthorized' &&
      config !== undefined &&
      !config._retriedAfterRefresh &&
      !isPublicPath(config.url) &&
      authTokenStore.getRefreshToken() !== null;

    if (!canRetry) {
      if (apiError.kind === 'unauthorized' && !isPublicPath(config?.url)) {
        authTokenStore.emitUnauthorized();
      }
      return Promise.reject(apiError);
    }

    const newToken = await refreshAccessToken();
    if (!newToken) {
      authTokenStore.emitUnauthorized();
      return Promise.reject(apiError);
    }

    const retryConfig: RetryableConfig = { ...config, _retriedAfterRefresh: true };
    retryConfig.headers.set('Authorization', `Bearer ${newToken}`);
    return httpClient.request(retryConfig);
  },
);

/* ── Thin typed helpers ──────────────────────────────────────────────────── */

export const http = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const { data } = await httpClient.get<T>(url, config);
    return data;
  },
  async post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const { data } = await httpClient.post<T>(url, body, config);
    return data;
  },
  async patch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const { data } = await httpClient.patch<T>(url, body, config);
    return data;
  },
  async put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const { data } = await httpClient.put<T>(url, body, config);
    return data;
  },
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const { data } = await httpClient.delete<T>(url, config);
    return data;
  },
} as const;
