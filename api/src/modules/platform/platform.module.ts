import { Module } from '@nestjs/common';
import { PlatformAuthModule } from './auth/platform-auth.module';
import { PlatformTenantsModule } from './tenants/platform-tenants.module';
import { PlatformBranchesModule } from './branches/platform-branches.module';

@Module({
  imports: [PlatformAuthModule, PlatformTenantsModule, PlatformBranchesModule],
})
export class PlatformModule {}
