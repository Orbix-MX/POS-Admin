import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LicenseService } from '../../../common/services/license.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AllowInvalidLicense } from '../../../common/decorators/allow-invalid-license.decorator';
import { NoPermissionsRequired } from '../../../common/decorators/no-permissions-required.decorator';

/**
 * Tenant-facing, read-only license view. Returns a masked key + live validation
 * + device usage. Marked @AllowInvalidLicense so the tenant can still see (and
 * learn to renew) an expired/suspended license from inside the app.
 */
@ApiTags('License')
@ApiBearerAuth()
@Controller('license')
@AllowInvalidLicense()
export class LicenseController {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @NoPermissionsRequired()
  @Get()
  @ApiOperation({ summary: 'Get the current tenant license overview (masked, read-only)' })
  getOverview() {
    return this.licenseService.getLicenseOverview(this.tenantContext.requireTenantId());
  }
}
