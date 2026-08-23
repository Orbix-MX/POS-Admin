import type { TenantInfoDto, TenantSettingsDto, UpdateTenantInfoRequest } from '@/dto/tenants.dto';
import { http } from '@/services/api';

/** What `expo-image-picker` hands back for the asset we upload as the logo. */
export interface LogoAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export const tenantRepository = {
  getInfo(): Promise<TenantInfoDto> {
    return http.get<TenantInfoDto>('/tenants/current/info');
  },

  updateInfo(patch: UpdateTenantInfoRequest): Promise<TenantInfoDto> {
    return http.patch<TenantInfoDto>('/tenants/current/info', patch);
  },

  /**
   * Multipart, field name `file` — matches the API's `FileInterceptor('file', …)`.
   * RN's `FormData` accepts a plain `{ uri, name, type }` object in place of a
   * `Blob`; axios's RN adapter streams it directly from disk.
   */
  uploadLogo(asset: LogoAsset): Promise<TenantInfoDto> {
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName ?? 'logo.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);

    return http.post<TenantInfoDto>('/tenants/current/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteLogo(): Promise<void> {
    return http.delete<void>('/tenants/current/logo');
  },

  /**
   * `Tenant.settings` is an untyped JSON blob server-side
   * (`updateMySettings(patch: Record<string, unknown>)` — a real merge-patch,
   * not a stub): whatever key this app writes here round-trips for real and
   * is shared by every device on the tenant, unlike the `kvStorage` prefs in
   * `use-settings-prefs.ts`, which are this device's alone.
   */
  getSettings(): Promise<TenantSettingsDto> {
    return http.get<TenantSettingsDto>('/tenants/current/settings');
  },

  updateSettings(patch: Partial<TenantSettingsDto>): Promise<TenantSettingsDto> {
    return http.patch<TenantSettingsDto>('/tenants/current/settings', patch);
  },
} as const;
