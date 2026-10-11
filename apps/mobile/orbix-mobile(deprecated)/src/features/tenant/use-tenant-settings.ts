/**
 * Configuración's data layer: read/write `TenantInfo` (name, phone, address,
 * currency, logo) and `TenantSettings` (the free-form `Tenant.settings` blob —
 * today just `decimalPlaces`). Gated on the same permissions the API itself
 * enforces (`tenant:view`/`tenant:edit`/`tenant:branding`,
 * `settings:view`/`settings:manage`), so a role without them never even fires
 * the request.
 */
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TenantSettingsDto, UpdateTenantInfoRequest } from '@/dto/tenants.dto';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { tenantRepository } from '@/repositories/tenant-repository';
import { queryKeys } from '@/services/query/query-keys';
import { pickImageFromLibrary } from '@/utils/pick-image';

export function useTenantInfo() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const tenantId = session?.tenant?.id;

  return useQuery({
    queryKey: queryKeys.tenant.info(tenantId ?? 'none'),
    queryFn: () => tenantRepository.getInfo(),
    enabled: Boolean(tenantId) && can('tenant:view'),
    staleTime: 60 * 1000,
  });
}

export function useUpdateTenantInfo() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = session?.tenant?.id;

  return useMutation({
    mutationFn: (patch: UpdateTenantInfoRequest) => tenantRepository.updateInfo(patch),
    onSuccess: (info) => {
      queryClient.setQueryData(queryKeys.tenant.info(tenantId ?? 'none'), info);
    },
  });
}

export function useUploadLogo() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = session?.tenant?.id;

  return useMutation({
    mutationFn: (asset: ImagePicker.ImagePickerAsset) =>
      tenantRepository.uploadLogo({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType }),
    onSuccess: (info) => {
      queryClient.setQueryData(queryKeys.tenant.info(tenantId ?? 'none'), info);
    },
  });
}

export function useDeleteLogo() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = session?.tenant?.id;

  return useMutation({
    mutationFn: () => tenantRepository.deleteLogo(),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.tenant.info(tenantId ?? 'none'), (current: unknown) =>
        current ? { ...(current as object), logoUrl: undefined } : current,
      );
    },
  });
}

export function useTenantSettings() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const tenantId = session?.tenant?.id;

  return useQuery({
    queryKey: queryKeys.tenant.settings(tenantId ?? 'none'),
    queryFn: () => tenantRepository.getSettings(),
    enabled: Boolean(tenantId) && can('settings:view'),
    staleTime: 60 * 1000,
  });
}

export function useUpdateTenantSettings() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = session?.tenant?.id;

  return useMutation({
    mutationFn: (patch: Partial<TenantSettingsDto>) => tenantRepository.updateSettings(patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.tenant.settings(tenantId ?? 'none'), settings);
    },
  });
}

/** Logo cuadrado; el selector en sí vive en `utils/pick-image.ts`. */
export function pickLogoImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  return pickImageFromLibrary({ aspect: [1, 1] });
}
