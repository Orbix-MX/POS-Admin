import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlanUpgradeRequestsController } from './plan-upgrade-requests.controller';
import { PlanUpgradeRequestsService } from './plan-upgrade-requests.service';

/** @odd planes-self-service T-002, T-003 */
@Module({
  controllers: [PlansController, PlanUpgradeRequestsController],
  providers: [PlanUpgradeRequestsService],
  exports: [PlanUpgradeRequestsService],
})
export class PlansModule {}
