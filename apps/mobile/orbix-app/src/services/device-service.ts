/**
 * Device-first auth service. The device is the principal: it validates/activates
 * to obtain a durable deviceToken, then the operator logs in with a PIN. No
 * email/password anywhere.
 */
import { apiClient } from './api-client';
import { getDeviceMeta, type DeviceMeta } from '@/utils/device-info';

export interface LicenseStatus {
  valid: boolean;
  reason?: 'NO_LICENSE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED' | 'NOT_STARTED';
  status?: string;
  expiresAt?: string | null;
}
export type RestaurantServiceMode = 'TABLE_SERVICE' | 'COUNTER_SERVICE' | 'HYBRID';

export interface DeviceTenant {
  id: string;
  name: string;
  slug: string;
  restaurantServiceMode?: RestaurantServiceMode;
  kitchenEnabled?: boolean;
  /**
   * Effective module list (plan ∪ enabled) from the API. All navigation/flow
   * decisions derive from this — never hardcode tenant checks. May be undefined
   * when booting from a stale offline cache (see deriveModules in capabilities).
   */
  modules?: string[];
}
export interface DeviceBranch { id: string; name: string }

export interface ValidateResponse {
  registered: boolean;
  tenant?: DeviceTenant | null;
  branch?: DeviceBranch | null;
  deviceToken?: string;
  licenseStatus?: LicenseStatus;
}

export interface ActivateResponse {
  deviceToken: string;
  tenant: DeviceTenant | null;
  branch: DeviceBranch | null;
  licenseStatus: LicenseStatus;
}

export interface Operator {
  accessToken: string;
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string };
  role: { id: string; name: string } | null;
  permissions: string[];
  branchId: string | null;
  availableBranches: DeviceBranch[];
}

export async function validateDevice(deviceId: string, appVersion?: string): Promise<ValidateResponse> {
  const { data } = await apiClient.post<ValidateResponse>('/devices/validate', { deviceId, appVersion });
  return data;
}

export async function activateDevice(params: {
  deviceId: string;
  activationToken?: string;
  licenseKey?: string;
  meta?: DeviceMeta;
}): Promise<ActivateResponse> {
  const meta = params.meta ?? getDeviceMeta();
  const { data } = await apiClient.post<ActivateResponse>('/devices/activate', {
    deviceId: params.deviceId,
    activationToken: params.activationToken,
    licenseKey: params.licenseKey,
    type: 'MOBILE_COMANDERA',
    ...meta,
  });
  return data;
}

export async function pinLogin(deviceToken: string, pin: string): Promise<Operator> {
  const { data } = await apiClient.post<Operator>('/staff/pin-login', { deviceToken, pin });
  return data;
}
