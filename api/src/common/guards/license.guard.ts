import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicenseService } from '../services/license.service';
import { ALLOW_INVALID_LICENSE_KEY } from '../decorators/allow-invalid-license.decorator';

/**
 * Global guard (runs after JwtAuthGuard) that blocks tenant-scoped requests when
 * the tenant's license is not valid. Bypassed when:
 *   - the request has no tenant context (super-admin / pre-tenant flows), or
 *   - the handler is marked @AllowInvalidLicense() (recovery endpoints).
 *
 * Emits a 403 with a LICENSE_* code the client can react to, mirroring the
 * existing TENANT_SUSPENDED contract.
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly license: LicenseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const exempt = this.reflector.getAllAndOverride<boolean>(ALLOW_INVALID_LICENSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (exempt) return true;

    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.user?.tenantId;
    if (!tenantId) return true; // no tenant context → nothing to license-check

    const result = await this.license.validateLicense(tenantId);
    if (!result.valid) {
      throw new ForbiddenException({
        statusCode: 403,
        code: `LICENSE_${result.reason}`,
        message: this.license.reasonMessage(result.reason),
      });
    }
    return true;
  }
}
