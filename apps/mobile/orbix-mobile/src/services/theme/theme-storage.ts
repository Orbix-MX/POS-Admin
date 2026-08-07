/**
 * Persistence for theming. Pure storage — no network, no React.
 *
 * Split out from `ThemeRepository` (which owns the network) so the provider can
 * hydrate synchronously on first render without pulling axios into that path.
 */
import { StorageKeys } from '@/constants/storage-keys';
import { kvStorage } from '@/services/storage/kv-storage';
import type { TenantBranding, ThemeMode } from '@/theme/types';

type BrandingCache = Record<string, TenantBranding>;

export const themeStorage = {
  getBranding(tenantId: string): TenantBranding | null {
    const cache = kvStorage.getJson<BrandingCache>(StorageKeys.branding);
    return cache?.[tenantId] ?? null;
  },

  saveBranding(branding: TenantBranding): void {
    const cache = kvStorage.getJson<BrandingCache>(StorageKeys.branding) ?? {};
    cache[branding.tenantId] = branding;
    kvStorage.setJson(StorageKeys.branding, cache);
  },

  clearBranding(): void {
    kvStorage.remove(StorageKeys.branding);
  },

  getMode(): ThemeMode | null {
    const stored = kvStorage.getString(StorageKeys.themeMode);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return null;
  },

  saveMode(mode: ThemeMode): void {
    kvStorage.setString(StorageKeys.themeMode, mode);
  },
} as const;
