/**
 * Secure persistence for the device identity & credentials (expo-secure-store;
 * never AsyncStorage). Holds the stable deviceId, the durable deviceToken and a
 * cached tenant/branch so the app can boot (and, in the future, operate offline)
 * even before the network validate completes.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  deviceId: 'orbix_device_id',
  deviceToken: 'orbix_device_token',
  tenant: 'orbix_device_tenant',
  branch: 'orbix_device_branch',
  activeBranch: 'orbix_active_branch',
} as const;

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) return void globalThis.localStorage?.setItem(key, value);
  await SecureStore.setItemAsync(key, value);
}
async function getItem(key: string): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}
async function deleteItem(key: string): Promise<void> {
  if (isWeb) return void globalThis.localStorage?.removeItem(key);
  await SecureStore.deleteItemAsync(key);
}

import type { RestaurantServiceMode } from './device-service';
export interface CachedTenant { id: string; name: string; slug: string; restaurantServiceMode?: RestaurantServiceMode }
export interface CachedBranch { id: string; name: string }

export const deviceStorage = {
  getDeviceId: () => getItem(KEYS.deviceId),
  setDeviceId: (id: string) => setItem(KEYS.deviceId, id),

  getDeviceToken: () => getItem(KEYS.deviceToken),

  async getTenant(): Promise<CachedTenant | null> {
    const raw = await getItem(KEYS.tenant);
    return raw ? (JSON.parse(raw) as CachedTenant) : null;
  },
  async getBranch(): Promise<CachedBranch | null> {
    const raw = await getItem(KEYS.branch);
    return raw ? (JSON.parse(raw) as CachedBranch) : null;
  },

  /** Persist credentials after a successful validate/activate. */
  async saveCredentials(deviceToken: string, tenant: CachedTenant | null, branch: CachedBranch | null): Promise<void> {
    await setItem(KEYS.deviceToken, deviceToken);
    if (tenant) await setItem(KEYS.tenant, JSON.stringify(tenant));
    if (branch) await setItem(KEYS.branch, JSON.stringify(branch));
    else await deleteItem(KEYS.branch);
  },

  async getActiveBranch(): Promise<CachedBranch | null> {
    const raw = await getItem(KEYS.activeBranch);
    return raw ? (JSON.parse(raw) as CachedBranch) : null;
  },
  async setActiveBranch(branch: CachedBranch): Promise<void> {
    await setItem(KEYS.activeBranch, JSON.stringify(branch));
  },
  async clearActiveBranch(): Promise<void> {
    await deleteItem(KEYS.activeBranch);
  },

  /** Unlink the device (keeps the stable deviceId so re-activation reuses it). */
  async clearCredentials(): Promise<void> {
    await Promise.all([
      deleteItem(KEYS.deviceToken),
      deleteItem(KEYS.tenant),
      deleteItem(KEYS.branch),
      deleteItem(KEYS.activeBranch),
    ]);
  },
} as const;
