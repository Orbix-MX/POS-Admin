/**
 * Theme resolution rules, isolated from React.
 *
 * Precedence for the active colour scheme:
 *   1. the user's explicit choice (light/dark), if any
 *   2. the tenant's enforced default, if it is not `system`
 *   3. the device scheme
 */
import { buildTheme } from '@/theme/build-theme';
import type { ColorSchemeName, OrbixTheme, TenantBranding, ThemeMode } from '@/theme/types';

import { themeStorage } from './theme-storage';

export const themeService = {
  /** The stored preference, or `system` on a fresh install. */
  getMode(): ThemeMode {
    return themeStorage.getMode() ?? 'system';
  },

  setMode(mode: ThemeMode): void {
    themeStorage.saveMode(mode);
  },

  resolveScheme(
    mode: ThemeMode,
    deviceScheme: ColorSchemeName,
    branding?: TenantBranding | null,
  ): ColorSchemeName {
    if (mode !== 'system') return mode;
    if (branding?.defaultMode && branding.defaultMode !== 'system') return branding.defaultMode;
    return deviceScheme;
  },

  /** Synchronous — safe to call during the first render. */
  getBranding(tenantId: string | undefined): TenantBranding | null {
    if (!tenantId) return null;
    return themeStorage.getBranding(tenantId);
  },

  buildTheme(scheme: ColorSchemeName, branding?: TenantBranding | null): OrbixTheme {
    return buildTheme(scheme, branding);
  },
} as const;
