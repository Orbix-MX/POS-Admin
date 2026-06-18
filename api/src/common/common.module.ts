import { Global, Module } from '@nestjs/common';
import { AuditContextService } from './context/audit-context.service';
import { TenantContextService } from './context/tenant-context.service';
import { AuditService } from './services/audit.service';
import { PlanLimitsService } from './services/plan-limits.service';
import { LicenseService } from './services/license.service';

/**
 * Global module so that AuditContextService and TenantContextService
 * are provided as true singletons across the entire application.
 * This is critical for AsyncLocalStorage — every module must share
 * the same instance so the context set by the interceptor is visible
 * inside any service.
 */
@Global()
@Module({
  providers: [AuditContextService, TenantContextService, AuditService, PlanLimitsService, LicenseService],
  exports: [AuditContextService, TenantContextService, AuditService, PlanLimitsService, LicenseService],
})
export class CommonModule {}
