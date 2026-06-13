/**
 * Read API for the device session. Screens use this for derived session state;
 * actions live on the device store (useDeviceStore).
 */
import { useShallow } from 'zustand/react/shallow';
import { useDeviceStore } from '@/store/device-store';

// Stable fallbacks: fresh [] per snapshot defeats useShallow's equality check.
const NO_PERMISSIONS: string[] = [];
const NO_BRANCHES: import('@/services/device-service').DeviceBranch[] = [];

export function useDeviceSession() {
  return useDeviceStore(
    useShallow((s) => ({
      phase: s.phase,
      isBooting: s.phase === 'booting',
      isRegistered: s.phase === 'locked' || s.phase === 'ready',
      hasOperator: s.phase === 'ready',
      tenant: s.tenant,
      branch: s.branch,
      activeBranch: s.activeBranch,
      availableBranches: s.availableBranches.length > 0 ? s.availableBranches : NO_BRANCHES,
      licenseStatus: s.licenseStatus,
      operator: s.operator,
      permissions: s.operator?.permissions ?? NO_PERMISSIONS,
      role: s.operator?.role ?? null,
    })),
  );
}
