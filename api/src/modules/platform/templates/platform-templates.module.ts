import { Module } from '@nestjs/common';
import { PlatformTemplatesController } from './platform-templates.controller';
import { PlatformTenantSiteController } from './platform-tenant-site.controller';
import { PlatformTemplatesService } from './platform-templates.service';
import { SiteModule } from '../../core/site/site.module';

@Module({
  imports: [SiteModule],
  controllers: [PlatformTemplatesController, PlatformTenantSiteController],
  providers: [PlatformTemplatesService],
})
export class PlatformTemplatesModule {}
