import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { NO_PERMISSIONS_REQUIRED_KEY } from '../decorators/no-permissions-required.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { EffectivePermissionsService } from '../services/effective-permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly effectivePermissions: EffectivePermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Fail closed: a handler that declares no permissions is only reachable if it
    // says so explicitly. Allowing by default meant a forgotten
    // @RequirePermissions silently opened the endpoint to every authenticated
    // user of the tenant — which is how the PIN admin endpoints stayed open.
    if (!requiredPermissions || requiredPermissions.length === 0) {
      // `@Public()` already means "no session, no permissions" — JwtAuthGuard let
      // the request through and there is no user to check. Denying here would
      // break login, device activation and the storefront.
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      const allowsNoPermissions = this.reflector.getAllAndOverride<boolean>(
        NO_PERMISSIONS_REQUIRED_KEY,
        [context.getHandler(), context.getClass()],
      );

      return isPublic === true || allowsNoPermissions === true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // SUPER_ADMIN bypasses all permission checks
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // DEVICE_OPERATOR: permissions come directly from the JWT payload (employee role).
    if (user.role === 'DEVICE_OPERATOR') {
      const operatorPerms: string[] = user.permissions ?? [];
      return this.matches(requiredPermissions, operatorPerms);
    }

    // tenantId comes from the JWT (set by JwtStrategy)
    const tenantId: string | undefined = user.tenantId;
    if (!tenantId) {
      return false;
    }

    // Resolution and caching both live in EffectivePermissionsService, so the
    // guard and the services that grant permissions agree on one answer — and an
    // invalidation from any of them is seen here immediately.
    const effectivePermissions = await this.effectivePermissions.getFor(user.id, tenantId);

    return this.matches(requiredPermissions, effectivePermissions);
  }

  /** Each entry is a single perm ('a:b') or a pipe-separated OR group ('a:b|a:c'). */
  private matches(required: string[], held: string[]): boolean {
    return required.every((permOrGroup) =>
      permOrGroup.split('|').some((perm) => held.includes(perm)),
    );
  }
}
