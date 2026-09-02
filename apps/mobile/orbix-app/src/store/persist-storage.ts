/**
 * Cross-platform storage adapter for zustand's `persist` middleware.
 * Native → expo-secure-store; web → localStorage. Used to durably keep user
 * preferences (theme, etc.) across app restarts.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

const isWeb = Platform.OS === 'web';

export const persistStorage: StateStorage = {
  getItem: async (name) => {
    if (isWeb) return globalThis.localStorage?.getItem(name) ?? null;
    return SecureStore.getItemAsync(name);
  },
  setItem: async (name, value) => {
    if (isWeb) { globalThis.localStorage?.setItem(name, value); return; }
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name) => {
    if (isWeb) { globalThis.localStorage?.removeItem(name); return; }
    await SecureStore.deleteItemAsync(name);
  },
};
