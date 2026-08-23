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

/**
 * Wraps `expo-image-picker`'s permission + launch dance behind one call, so
 * the screen only deals with "got an asset or didn't" — never the permission
 * state machine.
 */
export async function pickLogoImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0] ?? null;
}
