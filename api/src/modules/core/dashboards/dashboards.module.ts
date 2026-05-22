import { Module } from '@nestjs/common';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { WidgetsController } from './widgets.controller';
import { WidgetsService } from './widgets.service';

@Module({
  controllers: [DashboardsController, WidgetsController],
  providers: [DashboardsService, WidgetsService],
})
export class DashboardsModule {}
