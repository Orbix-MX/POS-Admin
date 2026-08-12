import { Module } from '@nestjs/common';
import { PlatformDomainsController } from './platform-domains.controller';
import { PlatformDomainsService } from './platform-domains.service';

@Module({
  controllers: [PlatformDomainsController],
  providers: [PlatformDomainsService],
})
export class PlatformDomainsModule {}
