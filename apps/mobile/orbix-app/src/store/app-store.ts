/**
 * Phase 4 — Global app/UI state (Zustand).
 *
 * Cross-cutting UI concerns that aren't part of the session and aren't domain
 * data: theme preference, network status mirror, first-launch flags, etc.
 * No business logic.
 *
 * User preferences (e.g. theme) are PERSISTED to the device so they survive app
 * restarts. Runtime-only signals (network status) are excluded via `partialize`.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { persistStorage } from './persist-storage';

export type ColorSchemePreference = 'system' | 'light' | 'dark';

interface AppState {
  /** User's theme choice; 'system' follows the OS. Persisted. */
  colorScheme: ColorSchemePreference;
  /** Mirror of connectivity, kept in sync by NetworkProvider. Not persisted. */
  isOnline: boolean;

  setColorScheme: (scheme: ColorSchemePreference) => void;
  setOnline: (online: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      colorScheme: 'system',
      isOnline: true,

      setColorScheme: (colorScheme) => set({ colorScheme }),
      setOnline: (isOnline) => set({ isOnline }),
    }),
    {
      name: 'orbix_app_preferences',
      storage: createJSONStorage(() => persistStorage),
      // Persist only durable user preferences — never runtime signals.
      partialize: (state) => ({ colorScheme: state.colorScheme }),
    },
  ),
);
