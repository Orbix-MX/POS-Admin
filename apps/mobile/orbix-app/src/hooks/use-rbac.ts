/**
 * Phase 8 — Session-bound RBAC.
 *
 * Wraps the pure helpers in `utils/rbac` with the current session's permissions,
 * modules and role, so screens can write `can('orders:create')` /
 * `hasModule(SystemModule.COMANDA)` / `hasRole('OWNER')` without plumbing.
 *
 * SUPER_ADMIN bypasses permission and module checks (mirrors the API guard).
 */
import { useMemo } from 'react';

import { useSession } from '@/providers/session-provider';
import {
  hasPermission,
  hasModule,
  hasRole,
  isBypassRole,
  type PermissionMatch,
} from '@/utils/rbac';
import type { SystemModule } from '@orbix/types';

export function useRbac() {
  const { permissions, modules, user, tenant } = useSession();

  return useMemo(() => {
    const bypass = isBypassRole(user?.role);

    return {
      /** Check permission key(s) against the current session. */
      can: (required: string | string[], mode: PermissionMatch = 'all') =>
        bypass || hasPermission(permissions, required, mode),

      /** Check whether the tenant has the given module(s) enabled. */
      hasModule: (
        required: string | SystemModule | (string | SystemModule)[],
        mode: PermissionMatch = 'any',
      ) => bypass || hasModule(modules, required, mode),

      /** Check the platform-level user role. */
      hasRole: (allowed: string | string[]) => hasRole(user?.role, allowed),

      /** Check the per-tenant membership role (OWNER/ADMIN/MANAGER/STAFF). */
      hasTenantRole: (allowed: string | string[]) => hasRole(tenant?.memberRole, allowed),

      isSuperAdmin: bypass,
    };
  }, [permissions, modules, user?.role, tenant?.memberRole]);
}
