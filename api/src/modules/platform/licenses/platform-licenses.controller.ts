import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PlatformJwtAuthGuard } from '../common/guards/platform-jwt-auth.guard';
import { CurrentPlatformUser } from '../common/decorators/current-platform-user.decorator';
import { LicenseService } from '../../../common/services/license.service';
import { CreateLicenseDto, RenewLicenseDto, SuspendLicenseDto } from './dto/license.dto';
import type { PlatformUser } from '@prisma/client';

type PlatformActor = Pick<PlatformUser, 'id'>;

@ApiTags('Platform Licenses')
@ApiBearerAuth()
@Controller('platform/tenants/:tenantId/license')
@Public()
@UseGuards(PlatformJwtAuthGuard)
export class PlatformLicensesController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get()
  @ApiOperation({ summary: 'Get the tenant current license + live validation' })
  async getCurrent(@Param('tenantId') tenantId: string) {
    const [license, validation] = await Promise.all([
      this.licenseService.getCurrentLicense(tenantId),
      this.licenseService.validateLicense(tenantId),
    ]);
    return { license, validation };
  }

  @Post()
  @ApiOperation({ summary: 'Issue a new license (supersedes the current one)' })
  create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateLicenseDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.licenseService.createLicense(
      tenantId,
      { ...dto, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined },
      actor.id,
    );
  }

  @Post('renew')
  @ApiOperation({ summary: 'Renew / extend the current license' })
  renew(
    @Param('tenantId') tenantId: string,
    @Body() dto: RenewLicenseDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.licenseService.renewLicense(
      tenantId,
      { ...dto, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined },
      actor.id,
    );
  }

  @Post('suspend')
  @ApiOperation({ summary: 'Suspend the current license' })
  suspend(
    @Param('tenantId') tenantId: string,
    @Body() dto: SuspendLicenseDto,
    @CurrentPlatformUser() actor: PlatformActor,
  ) {
    return this.licenseService.suspendLicense(tenantId, dto.reason, actor.id);
  }

  @Post('activate')
  @ApiOperation({ summary: 'Re-activate a suspended license' })
  activate(@Param('tenantId') tenantId: string, @CurrentPlatformUser() actor: PlatformActor) {
    return this.licenseService.activateLicense(tenantId, actor.id);
  }
}
