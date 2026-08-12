import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';
import { DomainResolverService } from '../services/domain-resolver.service';

/**
 * Resolves the tenant for a public storefront request from its Origin header
 * instead of a client-supplied tenantId, and stamps it on the request as
 * `resolvedTenantId` for `@ResolvedTenant()` to read. See DomainResolverService.
 */
@Injectable()
export class StoreDomainGuard implements CanActivate {
  constructor(private domainResolver: DomainResolverService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const origin = request.headers.origin || request.headers.referer;

    const tenantId = await this.domainResolver.resolveTenantIdByOrigin(origin);
    if (!tenantId) {
      throw new NotFoundException('Tienda no encontrada para este dominio');
    }

    request.resolvedTenantId = tenantId;
    return true;
  }
}
