import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { DevicesService } from './devices.service';
import { AuthService } from '../auth/auth.service';
import { ActivateDeviceDto } from './dto/activate-device.dto';
import { EnrollDeviceDto } from './dto/enroll-device.dto';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly authService: AuthService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post('enrollment-token')
  @ApiOperation({ summary: 'Generate a short-lived QR enrollment token for this tenant (admin)' })
  createEnrollmentToken() {
    return this.authService.createEnrollmentToken(
      this.tenantContext.requireTenantId(),
      this.tenantContext.getBranchId(),
    );
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('enroll')
  @ApiOperation({ summary: 'Enroll a device into a tenant using a QR enrollment token (app)' })
  async enroll(@Body() dto: EnrollDeviceDto) {
    const { tenantId } = await this.authService.consumeEnrollmentToken(dto.token);
    return this.devicesService.enroll(tenantId, { deviceId: dto.deviceId, name: dto.name, type: dto.type });
  }

  @Post('activate')
  @ApiOperation({ summary: 'Activate / register the current device under the tenant license' })
  activate(@Body() dto: ActivateDeviceDto) {
    return this.devicesService.activate(this.tenantContext.requireTenantId(), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List devices registered for the active tenant' })
  list() {
    return this.devicesService.list(this.tenantContext.requireTenantId());
  }

  @Post(':deviceId/heartbeat')
  @ApiOperation({ summary: 'Device liveness ping (revalidates license)' })
  heartbeat(@Param('deviceId') deviceId: string) {
    return this.devicesService.heartbeat(this.tenantContext.requireTenantId(), deviceId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a device' })
  revoke(@Param('id') id: string) {
    return this.devicesService.revoke(this.tenantContext.requireTenantId(), id);
  }
}
