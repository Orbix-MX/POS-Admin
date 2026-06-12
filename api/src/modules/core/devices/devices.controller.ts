import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { ActivateDeviceDto } from './dto/activate-device.dto';
import { TenantContextService } from '../../../common/context/tenant-context.service';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly tenantContext: TenantContextService,
  ) {}

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
