/**
 * Phase 4 — Global app/UI state (Zustand).
 *
 * Cross-cutting UI concerns that aren't part of the session and aren't domain
 * data: theme preference, network status mirror, first-launch flags, etc.
 * No business logic.
 */
import { create } from 'zustand';

export type ColorSchemePreference = 'system' | 'light' | 'dark';

interface AppState {
  /** User's theme choice; 'system' follows the OS. */
  colorScheme: ColorSchemePreference;
  /** Mirror of connectivity, kept in sync by NetworkProvider. */
  isOnline: boolean;

  setColorScheme: (scheme: ColorSchemePreference) => void;
  setOnline: (online: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  colorScheme: 'system',
  isOnline: true,

  setColorScheme: (colorScheme) => set({ colorScheme }),
  setOnline: (isOnline) => set({ isOnline }),
}));
