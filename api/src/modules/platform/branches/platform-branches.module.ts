import { Module } from '@nestjs/common';
import { PlatformBranchesController } from './platform-branches.controller';
import { PlatformBranchesService } from './platform-branches.service';

@Module({
  controllers: [PlatformBranchesController],
  providers: [PlatformBranchesService],
})
export class PlatformBranchesModule {}
