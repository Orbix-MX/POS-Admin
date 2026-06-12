import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { DevicesService } from './devices.service';
import { AuthService } from '../auth/auth.service';
import { ActivateDeviceDto } from './dto/activate-device.dto';
import { ValidateDeviceDto } from './dto/validate-device.dto';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Devices')
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly authService: AuthService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // ── Public (app) ────────────────────────────────────────────────────────────
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('validate')
  @ApiOperation({ summary: 'Validate this device on app start (registered? tenant/branch/token/license)' })
  validate(@Body() dto: ValidateDeviceDto) {
    return this.devicesService.validate(dto.deviceId, dto.appVersion);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('activate')
  @ApiOperation({ summary: 'Activate a device via QR token or license key (app)' })
  activate(@Body() dto: ActivateDeviceDto) {
    return this.devicesService.activate(dto);
  }

  // ── Tenant admin (web) ────────────────────────────────────────────────────────
  @Post('enrollment-token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a short-lived QR enrollment token for this tenant (admin)' })
  createEnrollmentToken() {
    return this.authService.createEnrollmentToken(
      this.tenantContext.requireTenantId(),
      this.tenantContext.getBranchId(),
    );
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List devices registered for the active tenant' })
  list() {
    return this.devicesService.list(this.tenantContext.requireTenantId());
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a device' })
  revoke(@Param('id') id: string) {
    return this.devicesService.revoke(this.tenantContext.requireTenantId(), id);
  }
}
