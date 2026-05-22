import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
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

  // ─── Dashboard CRUD ────────────────────────────────────────────────────────

  @Get('dashboards')
  @ApiOperation({ summary: 'List all dashboards for a tenant' })
  listDashboards(@Param('tenantId') tenantId: string) {
    return this.platformDashboardsService.listDashboards(tenantId);
  }

  @Get('dashboards/:dashboardId')
  @ApiOperation({ summary: 'Get a single dashboard with widgets and role assignments' })
  getDashboard(
    @Param('tenantId') tenantId: string,
    @Param('dashboardId') dashboardId: string,
  ) {
    return this.platformDashboardsService.getDashboard(tenantId, dashboardId);
  }

  @Post('dashboards')
  @ApiOperation({ summary: 'Create a dashboard for a tenant' })
  createDashboard(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      name: string;
      slug: string;
      description?: string;
      isDefault?: boolean;
      icon?: string;
    },
  ) {
    return this.platformDashboardsService.createDashboard(tenantId, body);
  }

  @Patch('dashboards/:dashboardId')
  @ApiOperation({ summary: 'Update a dashboard' })
  updateDashboard(
    @Param('tenantId') tenantId: string,
    @Param('dashboardId') dashboardId: string,
    @Body()
    body: Partial<{
      name: string;
      slug: string;
      description: string;
      isDefault: boolean;
      icon: string;
      isActive: boolean;
    }>,
  ) {
    return this.platformDashboardsService.updateDashboard(tenantId, dashboardId, body);
  }

  @Delete('dashboards/:dashboardId')
  @ApiOperation({ summary: 'Delete a dashboard (hard delete)' })
  deleteDashboard(
    @Param('tenantId') tenantId: string,
    @Param('dashboardId') dashboardId: string,
  ) {
    return this.platformDashboardsService.deleteDashboard(tenantId, dashboardId);
  }

  // ─── Widget library (tenant-scoped) ───────────────────────────────────────

  @Get('widgets')
  @ApiOperation({ summary: 'List all widgets in the tenant library' })
  listWidgets(@Param('tenantId') tenantId: string) {
    return this.platformDashboardsService.listWidgets(tenantId);
  }

  @Post('widgets')
  @ApiOperation({ summary: 'Create a widget in the tenant library' })
  createWidget(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      widgetType: WidgetType;
      title: string;
      subtitle?: string;
      endpoint: string;
      httpMethod?: string;
      defaultParams?: Record<string, unknown>;
      config?: Record<string, unknown>;
      refreshSeconds?: number;
    },
  ) {
    return this.platformDashboardsService.createWidget(tenantId, body);
  }

  @Patch('widgets/:widgetId')
  @ApiOperation({ summary: 'Update a widget in the tenant library' })
  updateWidget(
    @Param('tenantId') tenantId: string,
    @Param('widgetId') widgetId: string,
    @Body()
    body: Partial<{
      widgetType: WidgetType;
      title: string;
      subtitle: string;
      endpoint: string;
      httpMethod: string;
      defaultParams: Record<string, unknown>;
      config: Record<string, unknown>;
      refreshSeconds: number;
    }>,
  ) {
    return this.platformDashboardsService.updateWidget(tenantId, widgetId, body);
  }

  @Delete('widgets/:widgetId')
  @ApiOperation({ summary: 'Delete a widget from the tenant library' })
  deleteWidget(
    @Param('tenantId') tenantId: string,
    @Param('widgetId') widgetId: string,
  ) {
    return this.platformDashboardsService.deleteWidget(tenantId, widgetId);
  }

  // ─── Dashboard↔Widget links ────────────────────────────────────────────────

  @Get('dashboards/:dashboardId/widgets')
  @ApiOperation({ summary: 'List widgets assigned to a dashboard' })
  listDashboardWidgets(
    @Param('tenantId') tenantId: string,
    @Param('dashboardId') dashboardId: string,
  ) {
    return this.platformDashboardsService.listDashboardWidgets(tenantId, dashboardId);
  }

  @Post('dashboards/:dashboardId/widgets/:widgetId')
  @ApiOperation({ summary: 'Assign a library widget to a dashboard' })
  addWidgetToDashboard(
    @Param('tenantId') tenantId: string,
    @Param('dashboardId') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Body() body: { sortOrder?: number; colSpan?: number },
  ) {
    return this.platformDashboardsService.addWidgetToDashboard(
      tenantId,
      dashboardId,
      widgetId,
      body,
    );
  }

  @Patch('dashboards/:dashboardId/widgets/:widgetId')
  @ApiOperation({ summary: 'Update a dashboard-widget link (sortOrder, colSpan, isActive)' })
  updateDashboardWidget(
    @Param('tenantId') tenantId: string,
    @Param('dashboardId') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Body() body: { sortOrder?: number; colSpan?: number; isActive?: boolean },
  ) {
    return this.platformDashboardsService.updateDashboardWidget(
      tenantId,
      dashboardId,
      widgetId,
      body,
    );
  }

  @Delete('dashboards/:dashboardId/widgets/:widgetId')
  @ApiOperation({ summary: 'Remove a widget from a dashboard (does not delete the widget)' })
  removeWidgetFromDashboard(
    @Param('tenantId') tenantId: string,
    @Param('dashboardId') dashboardId: string,
    @Param('widgetId') widgetId: string,
  ) {
    return this.platformDashboardsService.removeWidgetFromDashboard(
      tenantId,
      dashboardId,
      widgetId,
    );
  }

  @Put('dashboards/:dashboardId/widgets/reorder')
  @ApiOperation({ summary: 'Reorder widgets on a dashboard' })
  reorderDashboardWidgets(
    @Param('tenantId') tenantId: string,
    @Param('dashboardId') dashboardId: string,
    @Body() body: { widgetIds: string[] },
  ) {
    return this.platformDashboardsService.reorderDashboardWidgets(
      tenantId,
      dashboardId,
      body.widgetIds,
    );
  }

  // ─── Roles ─────────────────────────────────────────────────────────────────

  @Get('roles')
  @ApiOperation({ summary: 'List tenant roles (for the role-assignment picker)' })
  listTenantRoles(@Param('tenantId') tenantId: string) {
    return this.platformDashboardsService.listTenantRoles(tenantId);
  }

  @Post('dashboards/:dashboardId/roles')
  @ApiOperation({ summary: 'Assign a role to a dashboard (upsert)' })
  assignDashboardRole(
    @Param('dashboardId') dashboardId: string,
    @Body() body: { roleId: string; canView?: boolean; canEdit?: boolean },
  ) {
    return this.platformDashboardsService.assignDashboardRole(
      dashboardId,
      body.roleId,
      body.canView,
      body.canEdit,
    );
  }

  @Delete('dashboards/:dashboardId/roles/:roleId')
  @ApiOperation({ summary: 'Remove a role from a dashboard' })
  removeDashboardRole(
    @Param('dashboardId') dashboardId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.platformDashboardsService.removeDashboardRole(dashboardId, roleId);
  }
}
