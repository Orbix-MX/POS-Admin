/**
 * Phase 8 — operator-bound RBAC for the comandera. Permissions/role come from
 * the PIN-authenticated operator (device store). Pure helpers live in utils/rbac.
 */
import { useMemo } from 'react';

import { useDeviceSession } from '@/hooks/use-device-session';
import { hasPermission, hasRole, type PermissionMatch } from '@/utils/rbac';

export function useRbac() {
  const { permissions, role } = useDeviceSession();

  return useMemo(
    () => ({
      /** Check permission key(s) against the current operator. */
      can: (required: string | string[], mode: PermissionMatch = 'all') =>
        hasPermission(permissions, required, mode),
      /** Check the operator's role name. */
      hasRole: (allowed: string | string[]) => hasRole(role?.name, allowed),
      roleName: role?.name ?? null,
    }),
    [permissions, role],
  );
}
