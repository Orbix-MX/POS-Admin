import { SetMetadata } from '@nestjs/common';

export const NO_PERMISSIONS_REQUIRED_KEY = 'noPermissionsRequired';

/**
 * Marks a handler that any authenticated user of the tenant may reach.
 *
 * `PermissionsGuard` denies by default when a handler declares no permissions,
 * so an endpoint that genuinely needs no specific permission has to say so out
 * loud. That way a forgotten `@RequirePermissions` fails closed (a 403 someone
 * reports) instead of silently exposing the endpoint.
 *
 * This is NOT `@Public()`: authentication is still required. Use it only when
 * the handler either exposes nothing sensitive (e.g. the caller's own tenant
 * license) or resolves authorization internally by other means (e.g. the cash
 * flow, which asks a supervisor for a PIN inside the service).
 */
export const NoPermissionsRequired = () => SetMetadata(NO_PERMISSIONS_REQUIRED_KEY, true);
