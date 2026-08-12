/**
 * Tenant settings (Panel de Permisos) — same merge-patch JSON the web app's
 * Configuración edits (`/tenants/current/settings`). Individual business-decision
 * toggles, not RBAC. Mirrors `TenantBusinessSettings` on the device-session side,
 * which is a read-only snapshot cached at PIN login; this service is the live
 * read/write path used by the settings screen itself.
 */
import { apiClient } from './api-client';

export interface TenantSettings {
  requireCounterReference?: boolean;
  [key: string]: unknown;
}

export async function fetchTenantSettings(): Promise<TenantSettings> {
  const { data } = await apiClient.get<TenantSettings>('/tenants/current/settings');
  return data;
}

export async function updateTenantSettings(patch: Partial<TenantSettings>): Promise<TenantSettings> {
  const { data } = await apiClient.patch<TenantSettings>('/tenants/current/settings', patch);
  return data;
}
