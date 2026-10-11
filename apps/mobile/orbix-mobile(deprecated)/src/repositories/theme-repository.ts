/**
 * Tenant branding: fetches from the API and hands persistence to `themeStorage`.
 *
 * Repository = remote source of truth. Storage = local cache. Keeping them
 * apart means the theme provider can hydrate synchronously from storage without
 * ever touching the network layer.
 */
import type { TenantBrandingResponseDto } from '@/dto/onboarding.dto';
import { ApiError, http } from '@/services/api';
import { themeStorage } from '@/services/theme/theme-storage';
import type { TenantBranding, TenantThemeOverride, ThemeMode } from '@/theme/types';

/**
 * The API may add tokens this client version does not know. Casting is safe
 * because `applyOverride` copies only keys that exist on the base theme, so
 * unknown ones are inert rather than corrupting.
 */
function toOverride(raw: Record<string, unknown> | undefined): TenantThemeOverride | undefined {
  return raw as TenantThemeOverride | undefined;
}

function toBranding(dto: TenantBrandingResponseDto): TenantBranding {
  return {
    tenantId: dto.tenantId,
    logoUrl: dto.logoUrl,
    defaultMode: dto.defaultMode as ThemeMode | undefined,
    light: toOverride(dto.light),
    dark: toOverride(dto.dark),
    updatedAt: dto.updatedAt,
  };
}

export const themeRepository = {
  /**
   * TODO(backend): `GET /api/tenants/current/branding` — contract in
   * `TenantBrandingResponseDto`. `GET /tenants/current/info` already returns the
   * logo and banner; branding extends it with the palette.
   *
   * Until it exists the call 404s and the tenant keeps the default Orbix
   * palette — the correct outcome for a tenant that never customised anything.
   */
  async fetchCurrent(tenantId: string): Promise<TenantBranding | null> {
    try {
      const branding = toBranding(await http.get<TenantBrandingResponseDto>('/tenants/current/branding'));
      themeStorage.saveBranding(branding);
      return branding;
    } catch (error) {
      if (error instanceof ApiError && (error.kind === 'notFound' || error.kind === 'forbidden')) {
        return themeStorage.getBranding(tenantId);
      }
      throw error;
    }
  },
} as const;
