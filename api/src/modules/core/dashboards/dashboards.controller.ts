import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { DashboardsService } from './dashboards.service';
import { AssignDashboardRoleDto } from './dto/assign-dashboard-role.dto';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';

@ApiTags('Dashboards')
@ApiBearerAuth()
@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get()
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'List dashboards visible to the current user' })
  findAll() {
    return this.dashboardsService.findAll();
  }

  @Get('active')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get active dashboard with widgets filtered by role' })
  findActive() {
    return this.dashboardsService.findActive();
  }

  @Get(':id')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get a specific dashboard by id' })
  findOne(@Param('id') id: string) {
    return this.dashboardsService.findOne(id);
  }

  @Post()
  @RequirePermissions('dashboard:manage')
  @ApiOperation({ summary: 'Create a new dashboard' })
  create(@Body() dto: CreateDashboardDto) {
    return this.dashboardsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('dashboard:manage')
  @ApiOperation({ summary: 'Update dashboard metadata' })
  update(@Param('id') id: string, @Body() dto: UpdateDashboardDto) {
    return this.dashboardsService.update(id, dto);
  }

  @Patch(':id/layout')
  @RequirePermissions('dashboard:edit|dashboard:manage')
  @ApiOperation({ summary: 'Persist grid layout for all breakpoints' })
  updateLayout(@Param('id') id: string, @Body() dto: UpdateLayoutDto) {
    return this.dashboardsService.updateLayout(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('dashboard:manage')
  @ApiOperation({ summary: 'Soft-delete a dashboard' })
  remove(@Param('id') id: string) {
    return this.dashboardsService.remove(id);
  }

  @Post(':dashboardId/widgets')
  @RequirePermissions('dashboard:manage')
  @ApiOperation({ summary: 'Add a widget to a dashboard' })
  createWidget(
    @Param('dashboardId') dashboardId: string,
    @Body() dto: CreateWidgetDto,
  ) {
    return this.dashboardsService.createWidget(dashboardId, dto);
  }

  // ── Role management ─────────────────────────────────────────────────────────

  @Get(':id/roles')
  @RequirePermissions('dashboard:manage')
  @ApiOperation({ summary: 'List role assignments for a dashboard' })
  listRoles(@Param('id') id: string) {
    return this.dashboardsService.listDashboardRoles(id);
  }

  @Post(':id/roles')
  @RequirePermissions('dashboard:manage')
  @ApiOperation({ summary: 'Assign a role to a dashboard (upsert)' })
  assignRole(@Param('id') id: string, @Body() dto: AssignDashboardRoleDto) {
    return this.dashboardsService.assignDashboardRole(id, dto);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermissions('dashboard:manage')
  @ApiOperation({ summary: 'Remove a role from a dashboard' })
  removeRole(@Param('id') id: string, @Param('roleId') roleId: string) {
    return this.dashboardsService.removeDashboardRole(id, roleId);
  }
}
