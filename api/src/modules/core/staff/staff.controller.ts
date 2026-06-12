import { Controller, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { StaffService } from './staff.service';
import { PinLoginDto, AssignPinDto } from './dto/staff.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { TenantContextService } from '../../../common/context/tenant-context.service';

@ApiTags('Staff')
@Controller('staff')
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // Device-principal: no user JWT, just the deviceToken + PIN. Rate-limited.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('pin-login')
  @ApiOperation({ summary: 'Operative PIN login (device authorized) — returns operator + permissions' })
  pinLogin(@Body() dto: PinLoginDto) {
    return this.staffService.pinLogin(dto.deviceToken, dto.pin);
  }

  // ── Admin (web): manage employee PINs ────────────────────────────────────────
  @Patch('employees/:id/pin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign/replace an employee operative PIN (+ optional role)' })
  assignPin(@Param('id') id: string, @Body() dto: AssignPinDto) {
    return this.staffService.assignPin(this.tenantContext.requireTenantId(), id, dto.pin, dto.roleId);
  }

  @Delete('employees/:id/pin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear an employee operative PIN' })
  clearPin(@Param('id') id: string) {
    return this.staffService.clearPin(this.tenantContext.requireTenantId(), id);
  }
}
