/**
 * Auth endpoints. Thin HTTP layer over `apiClient` mirroring the NestJS
 * two-step auth flow: login → select-tenant → select-branch.
 *
 * Token persistence (SecureStore + cache) is handled here via `persistTokens`
 * so callers (the auth store) don't deal with storage directly.
 */
import { apiClient, persistTokens, clearTokens } from './api-client';
import type {
  AuthResponse,
  ProfileResponse,
  CapabilitiesResponse,
  SelectTenantResponse,
  SelectBranchResponse,
  Branch,
} from '@/types/auth';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  // Preliminary token (no tenant yet) — still needed to call select-tenant.
  await persistTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function selectTenant(slug: string): Promise<SelectTenantResponse> {
  const { data } = await apiClient.patch<SelectTenantResponse>(`/auth/select-tenant/${slug}`, {});
  await persistTokens(data.accessToken);
  return data;
}

export async function selectBranch(branchId: string): Promise<SelectBranchResponse> {
  const { data } = await apiClient.patch<SelectBranchResponse>(`/auth/select-branch/${branchId}`, {});
  await persistTokens(data.accessToken);
  return data;
}

export async function fetchProfile(): Promise<ProfileResponse> {
  const { data } = await apiClient.get<ProfileResponse>('/auth/me');
  return data;
}

export async function fetchCapabilities(): Promise<CapabilitiesResponse> {
  const { data } = await apiClient.get<CapabilitiesResponse>('/auth/me/capabilities');
  return data;
}

export async function fetchBranches(): Promise<Branch[]> {
  const { data } = await apiClient.get<Branch[]>('/branches');
  return data;
}

export async function logout(refreshToken?: string): Promise<void> {
  await apiClient.post('/auth/logout', { refreshToken }).catch(() => undefined);
  await clearTokens();
}
