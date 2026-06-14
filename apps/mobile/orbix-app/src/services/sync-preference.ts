/**
 * Persisted user preference for syncing over cellular data.
 *
 * Default is "ask": the app must not consume mobile data without explicit
 * authorization. Once the user authorizes it, the choice is remembered across
 * launches so we don't nag on every cellular reconnect.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'orbix_sync_cellular_allowed';
const isWeb = Platform.OS === 'web';

/** True when the user has authorized syncing over cellular data. */
export async function getCellularSyncAllowed(): Promise<boolean> {
  const raw = isWeb
    ? globalThis.localStorage?.getItem(KEY) ?? null
    : await SecureStore.getItemAsync(KEY);
  return raw === 'true';
}

export async function setCellularSyncAllowed(allowed: boolean): Promise<void> {
  const value = allowed ? 'true' : 'false';
  if (isWeb) { globalThis.localStorage?.setItem(KEY, value); return; }
  await SecureStore.setItemAsync(KEY, value);
}
