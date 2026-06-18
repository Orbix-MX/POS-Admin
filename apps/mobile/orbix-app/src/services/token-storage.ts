/**
 * Phase 6 — Secure credential storage.
 *
 * Access and refresh tokens are stored with `expo-secure-store` (Keychain on
 * iOS, Keystore-backed encrypted prefs on Android) — never AsyncStorage.
 * On web (where SecureStore is unavailable) we fall back to localStorage so the
 * app still runs under `expo start --web` during development.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'orbix_access_token';
const REFRESH_TOKEN_KEY = 'orbix_refresh_token';

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const tokenStorage = {
  getAccessToken: () => getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => getItem(REFRESH_TOKEN_KEY),

  setAccessToken: (token: string) => setItem(ACCESS_TOKEN_KEY, token),
  setRefreshToken: (token: string) => setItem(REFRESH_TOKEN_KEY, token),

  /** Persist both tokens at once (login / refresh). */
  async setTokens(accessToken: string, refreshToken?: string): Promise<void> {
    await setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) await setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  /** Wipe all stored credentials (logout / 401). */
  async clear(): Promise<void> {
    await Promise.all([deleteItem(ACCESS_TOKEN_KEY), deleteItem(REFRESH_TOKEN_KEY)]);
  },
} as const;
