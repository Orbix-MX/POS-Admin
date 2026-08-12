import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Tenant id resolved by StoreDomainGuard from the request's Origin. */
export const ResolvedTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return request.resolvedTenantId;
});
