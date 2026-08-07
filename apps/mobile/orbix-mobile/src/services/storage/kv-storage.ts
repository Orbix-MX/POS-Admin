/**
 * MMKV-backed key/value storage for non-sensitive state.
 *
 * Synchronous by design: the theme, the locale and the cached session must be
 * readable during the first render, before any effect runs, or the app flashes
 * default styling on every cold start.
 */
import { MMKV } from 'react-native-mmkv';

const mmkv = new MMKV({ id: 'orbix.app' });

export const kvStorage = {
  getString(key: string): string | undefined {
    return mmkv.getString(key);
  },

  setString(key: string, value: string): void {
    mmkv.set(key, value);
  },

  getBoolean(key: string): boolean | undefined {
    return mmkv.getBoolean(key);
  },

  setBoolean(key: string, value: boolean): void {
    mmkv.set(key, value);
  },

  /** Returns `undefined` (never throws) when the stored blob is corrupt. */
  getJson<T>(key: string): T | undefined {
    const raw = mmkv.getString(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      mmkv.delete(key);
      return undefined;
    }
  },

  setJson(key: string, value: unknown): void {
    mmkv.set(key, JSON.stringify(value));
  },

  remove(key: string): void {
    mmkv.delete(key);
  },

  clearAll(): void {
    mmkv.clearAll();
  },
} as const;

/** Adapter shaped for TanStack Query's `createSyncStoragePersister`. */
export const querySyncStorage = {
  getItem: (key: string): string | null => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string): void => mmkv.set(key, value),
  removeItem: (key: string): void => mmkv.delete(key),
};
