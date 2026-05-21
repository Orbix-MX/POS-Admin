import { Module } from '@nestjs/common';
import { PlatformAuthModule } from './auth/platform-auth.module';
import { PlatformTenantsModule } from './tenants/platform-tenants.module';
import { PlatformBranchesModule } from './branches/platform-branches.module';
import { PlatformDashboardsModule } from './dashboards/platform-dashboards.module';

@Module({
  imports: [PlatformAuthModule, PlatformTenantsModule, PlatformBranchesModule, PlatformDashboardsModule],
})
export class PlatformModule {}
