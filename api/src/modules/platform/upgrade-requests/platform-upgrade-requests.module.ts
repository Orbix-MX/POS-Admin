import { Module } from '@nestjs/common';
import { PlansModule } from '../../core/plans/plans.module';
import { PlatformUpgradeRequestsController } from './platform-upgrade-requests.controller';

/** @odd planes-self-service T-003 */
@Module({
  imports: [PlansModule],
  controllers: [PlatformUpgradeRequestsController],
})
export class PlatformUpgradeRequestsModule {}
