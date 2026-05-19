import {
  Controller, Get, Post, Patch, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PlatformJwtAuthGuard } from '../common/guards/platform-jwt-auth.guard';
import { CurrentPlatformUser } from '../common/decorators/current-platform-user.decorator';
import { PlatformBranchesService } from './platform-branches.service';
import { CreatePlatformBranchDto, UpdateBranchStatusDto, UpdateBranchLimitsDto } from './dto/platform-branch.dto';
import type { PlatformUser } from '@prisma/client';

type PlatformActor = Pick<PlatformUser, 'id' | 'email' | 'firstName' | 'lastName'>;

@ApiTags('Platform Branches')
@ApiBearerAuth()
@Controller('platform/tenants/:tenantId')
@Public()
@UseGuards(PlatformJwtAuthGuard)
export class PlatformBranchesController {
  constructor(private readonly platformBranchesService: PlatformBranchesService) {}

  @Get('branches')
  @ApiOperation({ summary: 'List branches + capacity for a tenant' })
  getBranches(@Param('tenantId') tenantId: string) {
    return this.platformBranchesService.getBranches(tenantId);
  }

  @Post('branches')
  @ApiOperation({ summary: 'Create a branch for a tenant (validates plan limit)' })
  createBranch(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreatePlatformBranchDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.platformBranchesService.createBranch(tenantId, dto, actor);
  }

  @Patch('branches/:branchId/status')
  @ApiOperation({ summary: 'Change branch status (protect last active branch)' })
  updateBranchStatus(
    @Param('tenantId') tenantId: string,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchStatusDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.platformBranchesService.updateBranchStatus(tenantId, branchId, dto, actor);
  }

  @Patch('branch-limits')
  @ApiOperation({ summary: 'Update extra branch limit for a tenant' })
  updateBranchLimits(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateBranchLimitsDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.platformBranchesService.updateBranchLimits(tenantId, dto, actor);
  }
}
