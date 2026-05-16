import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // ── Super-admin endpoints ──────────────────────────────────────────────────

  @Post()
  @RequirePermissions('tenants:manage')
  @ApiOperation({ summary: 'Create a new tenant (super-admin only)' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @RequirePermissions('tenants:manage')
  @ApiOperation({ summary: 'List all tenants (super-admin only)' })
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('tenants:manage')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('tenants:manage')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tenants:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }

  // ── Current-tenant settings ────────────────────────────────────────────────

  @Get('current/settings')
  @ApiOperation({ summary: 'Get settings for the current tenant' })
  getMySettings() {
    return this.tenantsService.getSettings();
  }

  @Patch('current/settings')
  @ApiOperation({ summary: 'Merge-patch settings for the current tenant' })
  updateMySettings(@Body() patch: Record<string, unknown>) {
    return this.tenantsService.updateSettings(patch);
  }

  // ── Current-tenant member management ──────────────────────────────────────

  @Get('current/members')
  @ApiOperation({ summary: 'List members of the current tenant' })
  listMembers() {
    return this.tenantsService.listMembers();
  }

  @Post('current/members/:userId')
  @ApiOperation({ summary: 'Add a user to the current tenant' })
  addMember(@Param('userId') userId: string, @Body('role') role?: string) {
    return this.tenantsService.addMember(userId, role as any);
  }

  @Delete('current/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a user from the current tenant' })
  removeMember(@Param('userId') userId: string) {
    return this.tenantsService.removeMember(userId);
  }
}
