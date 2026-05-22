import { Module } from '@nestjs/common';
import { PlatformDashboardsController } from './platform-dashboards.controller';
import { PlatformDashboardsService } from './platform-dashboards.service';

@Module({
  controllers: [PlatformDashboardsController],
  providers: [PlatformDashboardsService],
})
export class PlatformDashboardsModule {}
