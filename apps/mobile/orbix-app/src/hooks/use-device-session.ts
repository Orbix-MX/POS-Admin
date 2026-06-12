/**
 * Read API for the device session. Screens use this for derived session state;
 * actions live on the device store (useDeviceStore).
 */
import { useShallow } from 'zustand/react/shallow';
import { useDeviceStore } from '@/store/device-store';

// Stable fallback: a fresh [] per snapshot defeats useShallow's equality check
// (Object.is on the array ref) and triggers an infinite re-render loop.
const NO_PERMISSIONS: string[] = [];

export function useDeviceSession() {
  return useDeviceStore(
    useShallow((s) => ({
      phase: s.phase,
      isBooting: s.phase === 'booting',
      isRegistered: s.phase === 'locked' || s.phase === 'ready',
      hasOperator: s.phase === 'ready',
      tenant: s.tenant,
      branch: s.branch,
      licenseStatus: s.licenseStatus,
      operator: s.operator,
      permissions: s.operator?.permissions ?? NO_PERMISSIONS,
      role: s.operator?.role ?? null,
    })),
  );
}
