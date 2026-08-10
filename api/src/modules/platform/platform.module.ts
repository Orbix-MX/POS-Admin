import { Module } from '@nestjs/common';
import { PlatformAuthModule } from './auth/platform-auth.module';
import { PlatformTenantsModule } from './tenants/platform-tenants.module';
import { PlatformBranchesModule } from './branches/platform-branches.module';
import { PlatformDashboardsModule } from './dashboards/platform-dashboards.module';
import { PlatformLicensesModule } from './licenses/platform-licenses.module';
import { PlatformDomainsModule } from './domains/platform-domains.module';

@Module({
  imports: [PlatformAuthModule, PlatformTenantsModule, PlatformBranchesModule, PlatformDashboardsModule, PlatformLicensesModule, PlatformDomainsModule],
})
export class PlatformModule {}
