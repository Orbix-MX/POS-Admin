/**
 * Device-first session state. Replaces the old user login flow.
 *
 * Phases: booting → (unregistered | locked) → ready
 *   - booting:      validating the device on launch
 *   - unregistered: device unknown → must activate (QR / license key)
 *   - locked:       device authorized → waiting for operator PIN
 *   - ready:        operator signed in → app usable
 *
 * The deviceToken is the durable principal (SecureStore); the operator (employee
 * + permissions) is in-memory only and cleared on sign-out.
 * `activeBranch` is persisted separately so it survives PIN logout.
 */
import { create } from 'zustand';
import {
  validateDevice,
  activateDevice,
  pinLogin as pinLoginApi,
  type DeviceTenant,
  type DeviceBranch,
  type LicenseStatus,
  type Operator,
} from '@/services/device-service';
import { setDeviceAuthToken, getApiErrorMessage } from '@/services/api-client';
import { deviceStorage } from '@/services/device-storage';
import { getOrCreateDeviceId, getAppVersion } from '@/utils/device-info';

export type DevicePhase = 'booting' | 'unregistered' | 'locked' | 'ready';

interface DeviceState {
  phase: DevicePhase;
  loading: boolean;
  error: string | null;

  deviceToken: string | null;
  tenant: DeviceTenant | null;
  branch: DeviceBranch | null;
  licenseStatus: LicenseStatus | null;
  operator: Operator | null;

  // Multi-branch session
  activeBranch: DeviceBranch | null;
  availableBranches: DeviceBranch[];

  bootstrap: () => Promise<void>;
  activateWithToken: (activationToken: string) => Promise<boolean>;
  activateWithLicenseKey: (licenseKey: string) => Promise<boolean>;
  pinLogin: (pin: string) => Promise<boolean>;
  switchBranch: (branch: DeviceBranch) => Promise<void>;
  signOutOperator: () => void;
  unlinkDevice: () => Promise<void>;
  clearError: () => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  phase: 'booting',
  loading: false,
  error: null,
  deviceToken: null,
  tenant: null,
  branch: null,
  licenseStatus: null,
  operator: null,
  activeBranch: null,
  availableBranches: [],

  bootstrap: async () => {
    set({ phase: 'booting', error: null });
    const deviceId = await getOrCreateDeviceId();
    try {
      const res = await validateDevice(deviceId, getAppVersion());
      if (res.registered && res.deviceToken) {
        setDeviceAuthToken(res.deviceToken);
        await deviceStorage.saveCredentials(res.deviceToken, res.tenant ?? null, res.branch ?? null);

        // Restore persisted active branch; validate it's still valid after full login
        const persistedBranch = await deviceStorage.getActiveBranch();

        set({
          deviceToken: res.deviceToken,
          tenant: res.tenant ?? null,
          branch: res.branch ?? null,
          licenseStatus: res.licenseStatus ?? null,
          activeBranch: persistedBranch ?? res.branch ?? null,
          phase: 'locked',
        });
      } else {
        set({ phase: 'unregistered' });
      }
    } catch (e) {
      // Offline fallback: boot from cached credentials if we have them.
      const cachedToken = await deviceStorage.getDeviceToken();
      if (cachedToken) {
        const [tenant, branch, activeBranch] = await Promise.all([
          deviceStorage.getTenant(),
          deviceStorage.getBranch(),
          deviceStorage.getActiveBranch(),
        ]);
        setDeviceAuthToken(cachedToken);
        set({ deviceToken: cachedToken, tenant, branch, licenseStatus: null, activeBranch: activeBranch ?? branch, phase: 'locked' });
      } else {
        set({ phase: 'unregistered', error: getApiErrorMessage(e, 'No se pudo validar el dispositivo') });
      }
    }
  },

  activateWithToken: (activationToken) => activate(set, { activationToken }),
  activateWithLicenseKey: (licenseKey) => activate(set, { licenseKey }),

  pinLogin: async (pin) => {
    const { deviceToken } = get();
    if (!deviceToken) return false;
    set({ loading: true, error: null });
    try {
      const operator = await pinLoginApi(deviceToken, pin);
      const { availableBranches, branchId } = operator;

      // Restore last active branch if still in the available list; otherwise use default
      const persisted = await deviceStorage.getActiveBranch();
      const restoredBranch =
        persisted && availableBranches.some((b) => b.id === persisted.id)
          ? persisted
          : availableBranches.find((b) => b.id === branchId) ?? availableBranches[0] ?? null;

      if (restoredBranch) await deviceStorage.setActiveBranch(restoredBranch);

      set({
        operator,
        availableBranches,
        activeBranch: restoredBranch,
        phase: 'ready',
        loading: false,
      });
      return true;
    } catch (e) {
      set({ error: getApiErrorMessage(e, 'PIN incorrecto'), loading: false });
      return false;
    }
  },

  switchBranch: async (branch) => {
    await deviceStorage.setActiveBranch(branch);
    set({ activeBranch: branch });
  },

  signOutOperator: () => {
    void deviceStorage.clearActiveBranch();
    set({ operator: null, availableBranches: [], activeBranch: null, phase: 'locked', error: null });
  },

  unlinkDevice: async () => {
    setDeviceAuthToken(null);
    await deviceStorage.clearCredentials();
    set({
      deviceToken: null,
      tenant: null,
      branch: null,
      licenseStatus: null,
      operator: null,
      activeBranch: null,
      availableBranches: [],
      phase: 'unregistered',
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));

async function activate(
  set: (partial: Partial<DeviceState>) => void,
  creds: { activationToken?: string; licenseKey?: string },
): Promise<boolean> {
  set({ loading: true, error: null });
  try {
    const deviceId = await getOrCreateDeviceId();
    const res = await activateDevice({ deviceId, ...creds });
    setDeviceAuthToken(res.deviceToken);
    await deviceStorage.saveCredentials(res.deviceToken, res.tenant, res.branch);
    set({
      deviceToken: res.deviceToken,
      tenant: res.tenant,
      branch: res.branch,
      activeBranch: res.branch,
      licenseStatus: res.licenseStatus,
      phase: 'locked',
      loading: false,
    });
    return true;
  } catch (e) {
    set({ error: getApiErrorMessage(e, 'No se pudo activar el dispositivo'), loading: false });
    return false;
  }
}
