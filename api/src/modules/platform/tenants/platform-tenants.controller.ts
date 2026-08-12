import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PlatformJwtAuthGuard } from '../common/guards/platform-jwt-auth.guard';
import { CurrentPlatformUser } from '../common/decorators/current-platform-user.decorator';
import { PlatformTenantsService } from './platform-tenants.service';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';
import {
  UpdateTenantStatusDto,
  UpdateTenantPlanDto,
  UpdateTenantModulesDto,
  UpdateTenantLimitsDto,
  UpdateTenantVerticalDto,
  UpdateTenantProfileDto,
} from './dto/update-tenant.dto';
import { PlatformTenantsQueryDto } from './dto/platform-tenants-query.dto';
import type { PlatformUser } from '@prisma/client';

type PlatformActor = Pick<PlatformUser, 'id' | 'email' | 'firstName' | 'lastName'>;

@ApiTags('Platform Tenants')
@ApiBearerAuth()
@Controller('platform/tenants')
@Public()
@UseGuards(PlatformJwtAuthGuard)
export class PlatformTenantsController {
  constructor(private readonly platformTenantsService: PlatformTenantsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Platform dashboard stats' })
  getDashboardStats() {
    return this.platformTenantsService.getDashboardStats();
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants' })
  findAll(@Query() query: PlatformTenantsQueryDto) {
    return this.platformTenantsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant details' })
  findOne(@Param('id') id: string) {
    return this.platformTenantsService.findOne(id);
  }

  @Post('provision')
  @ApiOperation({ summary: 'Provision new tenant (creates tenant + branch + admin user)' })
  provision(
    @Body() dto: ProvisionTenantDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.platformTenantsService.provision(dto, actor);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change tenant status (suspend, activate, disable...)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.platformTenantsService.updateStatus(id, dto, actor);
  }

  @Patch(':id/plan')
  @ApiOperation({ summary: 'Change tenant plan' })
  updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdateTenantPlanDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.platformTenantsService.updatePlan(id, dto, actor);
  }

  @Patch(':id/modules')
  @ApiOperation({ summary: 'Update tenant enabled modules' })
  updateModules(
    @Param('id') id: string,
    @Body() dto: UpdateTenantModulesDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.platformTenantsService.updateModules(id, dto, actor);
  }

  @Patch(':id/limits')
  @ApiOperation({ summary: 'Override tenant user limits' })
  updateLimits(
    @Param('id') id: string,
    @Body() dto: UpdateTenantLimitsDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.platformTenantsService.updateLimits(id, dto, actor);
  }

  @Patch(':id/vertical')
  @ApiOperation({ summary: 'Update tenant business vertical, POS mode, and enabled features' })
  updateVertical(
    @Param('id') id: string,
    @Body() dto: UpdateTenantVerticalDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.platformTenantsService.updateVertical(id, dto, actor);
  }

  @Patch(':id/profile')
  @ApiOperation({ summary: 'Update tenant business profile (architecture base)' })
  updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateTenantProfileDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.platformTenantsService.updateProfile(id, dto, actor);
  }

  @Get(':id/audit')
  @ApiOperation({ summary: 'Get platform audit log for a tenant' })
  getAuditLogs(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.platformTenantsService.getAuditLogs(id, page, limit);
  }
}
