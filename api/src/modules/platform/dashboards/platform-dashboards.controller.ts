import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PlatformJwtAuthGuard } from '../common/guards/platform-jwt-auth.guard';
import { PlatformDashboardsService } from './platform-dashboards.service';
import type { WidgetType } from '@prisma/client';

@ApiTags('Platform Dashboards')
@ApiBearerAuth()
@Controller('platform/tenants/:tenantId')
@Public()
@UseGuards(PlatformJwtAuthGuard)
export class PlatformDashboardsController {
  constructor(private readonly platformDashboardsService: PlatformDashboardsService) {}

  // ──────────────────────────────────────────────
  // Dashboard CRUD
  // ──────────────────────────────────────────────

  @Get('dashboards')
  @ApiOperation({ summary: 'List all dashboards for a tenant' })
  listDashboards(@Param('tenantId') tenantId: string) {
    return this.platformDashboardsService.listDashboards(tenantId);
  }

  @Get('dashboards/:id')
  @ApiOperation({ summary: 'Get a single dashboard with widgets and role assignments' })
  getDashboard(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.platformDashboardsService.getDashboard(tenantId, id);
  }

  @Post('dashboards')
  @ApiOperation({ summary: 'Create a dashboard for a tenant' })
  createDashboard(
    @Param('tenantId') tenantId: string,
    @Body() body: { name: string; slug: string; description?: string; isDefault?: boolean; icon?: string },
  ) {
    return this.platformDashboardsService.createDashboard(tenantId, body);
  }

  @Patch('dashboards/:id')
  @ApiOperation({ summary: 'Update a dashboard' })
  updateDashboard(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; slug: string; description: string; isDefault: boolean; icon: string; isActive: boolean }>,
  ) {
    return this.platformDashboardsService.updateDashboard(tenantId, id, body);
  }

  @Delete('dashboards/:id')
  @ApiOperation({ summary: 'Delete a dashboard (hard delete)' })
  deleteDashboard(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.platformDashboardsService.deleteDashboard(tenantId, id);
  }

  // ──────────────────────────────────────────────
  // Widget management
  // ──────────────────────────────────────────────

  @Post('dashboards/:dashboardId/widgets')
  @ApiOperation({ summary: 'Add a widget to a dashboard' })
  addWidget(
    @Param('tenantId') tenantId: string,
    @Param('dashboardId') dashboardId: string,
    @Body() body: {
      widgetType: WidgetType;
      title: string;
      subtitle?: string;
      endpoint: string;
      httpMethod?: string;
      defaultParams?: Record<string, unknown>;
      config?: Record<string, unknown>;
      refreshSeconds?: number;
      sortOrder?: number;
    },
  ) {
    return this.platformDashboardsService.addWidget(tenantId, dashboardId, body);
  }

  @Patch('dashboards/:dashboardId/widgets/:widgetId')
  @ApiOperation({ summary: 'Update a widget' })
  updateWidget(
    @Param('tenantId') tenantId: string,
    @Param('widgetId') widgetId: string,
    @Body() body: Partial<{
      widgetType: WidgetType;
      title: string;
      subtitle: string;
      endpoint: string;
      httpMethod: string;
      defaultParams: Record<string, unknown>;
      config: Record<string, unknown>;
      refreshSeconds: number;
      sortOrder: number;
    }>,
  ) {
    return this.platformDashboardsService.updateWidget(tenantId, widgetId, body);
  }

  @Delete('dashboards/:dashboardId/widgets/:widgetId')
  @ApiOperation({ summary: 'Delete a widget' })
  deleteWidget(
    @Param('tenantId') tenantId: string,
    @Param('widgetId') widgetId: string,
  ) {
    return this.platformDashboardsService.deleteWidget(tenantId, widgetId);
  }

  // ──────────────────────────────────────────────
  // Role picker + dashboard role assignments
  // ──────────────────────────────────────────────

  @Get('roles')
  @ApiOperation({ summary: 'List tenant roles (for the role-assignment picker)' })
  listTenantRoles(@Param('tenantId') tenantId: string) {
    return this.platformDashboardsService.listTenantRoles(tenantId);
  }

  @Post('dashboards/:id/roles')
  @ApiOperation({ summary: 'Assign a role to a dashboard (upsert)' })
  assignDashboardRole(
    @Param('id') dashboardId: string,
    @Body() body: { roleId: string; canView?: boolean; canEdit?: boolean },
  ) {
    return this.platformDashboardsService.assignDashboardRole(
      dashboardId,
      body.roleId,
      body.canView,
      body.canEdit,
    );
  }

  @Delete('dashboards/:id/roles/:roleId')
  @ApiOperation({ summary: 'Remove a role from a dashboard' })
  removeDashboardRole(
    @Param('id') dashboardId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.platformDashboardsService.removeDashboardRole(dashboardId, roleId);
  }
}
