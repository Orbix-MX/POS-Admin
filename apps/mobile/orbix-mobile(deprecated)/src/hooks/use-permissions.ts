/**
 * Permission checks against the session.
 *
 * Nothing is hardcoded: the keys come from `GET /auth/me` (`permissions[]`,
 * the union of role assignments and individual grants computed by the API's
 * `PermissionsGuard`). `SUPER_ADMIN` bypasses every check, matching the server.
 */
import { useCallback, useMemo } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { TenantRole, UserRole } from '@/types/api';

export interface PermissionsApi {
  permissions: string[];
  /** e.g. `can('products:create')`. */
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
  canAll: (...permissions: string[]) => boolean;
  isSuperAdmin: boolean;
  isOwner: boolean;
  tenantRole?: TenantRole;
}

export function usePermissions(): PermissionsApi {
  const { session } = useAuth();

  const permissions = useMemo(() => session?.permissions ?? [], [session?.permissions]);
  const isSuperAdmin = session?.user.role === UserRole.SUPER_ADMIN;
  const tenantRole = session?.tenant?.memberRole;

  const can = useCallback(
    (permission: string) => isSuperAdmin || permissions.includes(permission),
    [isSuperAdmin, permissions],
  );

  const canAny = useCallback(
    (...required: string[]) => isSuperAdmin || required.some((item) => permissions.includes(item)),
    [isSuperAdmin, permissions],
  );

  const canAll = useCallback(
    (...required: string[]) => isSuperAdmin || required.every((item) => permissions.includes(item)),
    [isSuperAdmin, permissions],
  );

  return {
    permissions,
    can,
    canAny,
    canAll,
    isSuperAdmin,
    isOwner: tenantRole === TenantRole.OWNER,
    tenantRole,
  };
}
