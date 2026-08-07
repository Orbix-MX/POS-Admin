/**
 * Keychain/Keystore-backed storage for credentials.
 *
 * Only tokens go here. Reads are async and comparatively slow, so the app reads
 * them once at boot (`AuthProvider`) and keeps the access token in memory for
 * the axios interceptor.
 */
import * as SecureStore from 'expo-secure-store';

import { SecureKeys, type SecureKey } from '@/constants/storage-keys';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function getItem(key: SecureKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, options);
  } catch {
    // A corrupted keychain entry (e.g. after a restore from backup) must not
    // brick the app — treat it as "not signed in".
    return null;
  }
}

async function setItem(key: SecureKey, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, options);
}

async function removeItem(key: SecureKey): Promise<void> {
  await SecureStore.deleteItemAsync(key, options);
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
}

export const secureStorage = {
  async getTokens(): Promise<StoredTokens | null> {
    const [accessToken, refreshToken] = await Promise.all([
      getItem(SecureKeys.accessToken),
      getItem(SecureKeys.refreshToken),
    ]);
    if (!accessToken) return null;
    return { accessToken, refreshToken };
  },

  async setTokens({ accessToken, refreshToken }: StoredTokens): Promise<void> {
    await setItem(SecureKeys.accessToken, accessToken);
    if (refreshToken) {
      await setItem(SecureKeys.refreshToken, refreshToken);
    } else {
      await removeItem(SecureKeys.refreshToken);
    }
  },

  /** Replaces just the access token — used after select-tenant/select-branch. */
  async setAccessToken(accessToken: string): Promise<void> {
    await setItem(SecureKeys.accessToken, accessToken);
  },

  async clear(): Promise<void> {
    await Promise.all([removeItem(SecureKeys.accessToken), removeItem(SecureKeys.refreshToken)]);
  },
} as const;
