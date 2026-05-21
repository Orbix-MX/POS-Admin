import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';
import type { WidgetType } from '@prisma/client';

// ─── Dashboard DTOs ──────────────────────────────────────────────────────────

type CreateDashboardDto = {
  name: string;
  slug: string;
  description?: string;
  isDefault?: boolean;
  icon?: string;
};

type UpdateDashboardDto = Partial<{
  name: string;
  slug: string;
  description: string;
  isDefault: boolean;
  icon: string;
  isActive: boolean;
}>;

// ─── Widget library DTOs ─────────────────────────────────────────────────────

type CreateWidgetDto = {
  widgetType: WidgetType;
  title: string;
  subtitle?: string;
  endpoint: string;
  httpMethod?: string;
  defaultParams?: Record<string, unknown>;
  config?: Record<string, unknown>;
  refreshSeconds?: number;
};

type UpdateWidgetDto = Partial<CreateWidgetDto>;

// ─── DashboardWidget link DTOs ───────────────────────────────────────────────

type AddWidgetToDashboardDto = {
  sortOrder?: number;
  colSpan?: number;
};

type UpdateDashboardWidgetDto = Partial<{
  sortOrder: number;
  colSpan: number;
  isActive: boolean;
}>;

@Injectable()
export class PlatformDashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Dashboard CRUD ────────────────────────────────────────────────────────

  async listDashboards(tenantId: string) {
    return this.prisma.dashboard.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { dashboardWidgets: true } },
        roles: {
          include: {
            role: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });
  }

  async getDashboard(tenantId: string, dashboardId: string) {
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, tenantId },
      include: {
        dashboardWidgets: {
          orderBy: { sortOrder: 'asc' },
          include: { widget: true },
        },
        roles: {
          include: {
            role: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    if (!dashboard) throw new NotFoundException('Dashboard not found');
    return dashboard;
  }

  async createDashboard(tenantId: string, dto: CreateDashboardDto) {
    const slugTaken = await this.prisma.dashboard.findUnique({
      where: { tenantId_slug: { tenantId, slug: dto.slug } },
    });
    if (slugTaken)
      throw new ConflictException(`Slug '${dto.slug}' is already in use for this tenant`);

    if (dto.isDefault) {
      return this.prisma.$transaction(async (tx) => {
        await tx.dashboard.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
        return tx.dashboard.create({
          data: {
            tenantId,
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            isDefault: true,
            icon: dto.icon,
          },
        });
      });
    }

    return this.prisma.dashboard.create({
      data: {
        tenantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        isDefault: dto.isDefault ?? false,
        icon: dto.icon,
      },
    });
  }

  async updateDashboard(
    tenantId: string,
    dashboardId: string,
    dto: UpdateDashboardDto,
  ) {
    const existing = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, tenantId },
    });
    if (!existing) throw new NotFoundException('Dashboard not found');

    if (dto.slug && dto.slug !== existing.slug) {
      const slugTaken = await this.prisma.dashboard.findUnique({
        where: { tenantId_slug: { tenantId, slug: dto.slug } },
      });
      if (slugTaken)
        throw new ConflictException(`Slug '${dto.slug}' is already in use for this tenant`);
    }

    if (dto.isDefault) {
      return this.prisma.$transaction(async (tx) => {
        await tx.dashboard.updateMany({
          where: { tenantId, isDefault: true, id: { not: dashboardId } },
          data: { isDefault: false },
        });
        return tx.dashboard.update({
          where: { id: dashboardId },
          data: dto,
        });
      });
    }

    return this.prisma.dashboard.update({
      where: { id: dashboardId },
      data: dto,
    });
  }

  async deleteDashboard(tenantId: string, dashboardId: string) {
    const existing = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, tenantId },
    });
    if (!existing) throw new NotFoundException('Dashboard not found');

    await this.prisma.dashboard.delete({ where: { id: dashboardId } });
    return { deleted: true };
  }

  // ─── Widget library (tenant-scoped) ───────────────────────────────────────

  async listWidgets(tenantId: string) {
    return this.prisma.widget.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createWidget(tenantId: string, dto: CreateWidgetDto) {
    return this.prisma.widget.create({
      data: {
        tenantId,
        widgetType: dto.widgetType,
        title: dto.title,
        subtitle: dto.subtitle,
        endpoint: dto.endpoint,
        httpMethod: dto.httpMethod ?? 'GET',
        defaultParams:
          dto.defaultParams !== undefined
            ? (dto.defaultParams as Prisma.InputJsonValue)
            : undefined,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        refreshSeconds: dto.refreshSeconds,
      },
    });
  }

  async updateWidget(
    tenantId: string,
    widgetId: string,
    dto: UpdateWidgetDto,
  ) {
    const widget = await this.prisma.widget.findFirst({
      where: { id: widgetId },
    });
    if (!widget || widget.tenantId !== tenantId)
      throw new NotFoundException('Widget not found');

    return this.prisma.widget.update({
      where: { id: widgetId },
      data: {
        ...(dto.widgetType !== undefined && { widgetType: dto.widgetType }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
        ...(dto.endpoint !== undefined && { endpoint: dto.endpoint }),
        ...(dto.httpMethod !== undefined && { httpMethod: dto.httpMethod }),
        ...(dto.defaultParams !== undefined && {
          defaultParams: dto.defaultParams as Prisma.InputJsonValue,
        }),
        ...(dto.config !== undefined && {
          config: dto.config as Prisma.InputJsonValue,
        }),
        ...(dto.refreshSeconds !== undefined && {
          refreshSeconds: dto.refreshSeconds,
        }),
      },
    });
  }

  async deleteWidget(tenantId: string, widgetId: string) {
    const widget = await this.prisma.widget.findFirst({
      where: { id: widgetId },
    });
    if (!widget || widget.tenantId !== tenantId)
      throw new NotFoundException('Widget not found');

    await this.prisma.widget.delete({ where: { id: widgetId } });
    return { deleted: true };
  }

  // ─── Dashboard↔Widget links (DashboardWidget) ─────────────────────────────

  async listDashboardWidgets(tenantId: string, dashboardId: string) {
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, tenantId },
    });
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    return this.prisma.dashboardWidget.findMany({
      where: { dashboardId },
      orderBy: { sortOrder: 'asc' },
      include: { widget: true },
    });
  }

  async addWidgetToDashboard(
    tenantId: string,
    dashboardId: string,
    widgetId: string,
    dto: AddWidgetToDashboardDto,
  ) {
    const [dashboard, widget] = await Promise.all([
      this.prisma.dashboard.findFirst({ where: { id: dashboardId, tenantId } }),
      this.prisma.widget.findFirst({ where: { id: widgetId } }),
    ]);

    if (!dashboard) throw new NotFoundException('Dashboard not found');
    if (!widget || widget.tenantId !== tenantId)
      throw new NotFoundException('Widget not found');

    return this.prisma.dashboardWidget.upsert({
      where: { dashboardId_widgetId: { dashboardId, widgetId } },
      create: {
        dashboardId,
        widgetId,
        isActive: true,
        sortOrder: dto.sortOrder ?? 0,
        colSpan: dto.colSpan ?? 6,
      },
      update: {
        isActive: true,
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.colSpan !== undefined && { colSpan: dto.colSpan }),
      },
    });
  }

  async updateDashboardWidget(
    tenantId: string,
    dashboardId: string,
    widgetId: string,
    dto: UpdateDashboardWidgetDto,
  ) {
    const [dashboard, widget] = await Promise.all([
      this.prisma.dashboard.findFirst({ where: { id: dashboardId, tenantId } }),
      this.prisma.widget.findFirst({ where: { id: widgetId } }),
    ]);

    if (!dashboard) throw new NotFoundException('Dashboard not found');
    if (!widget || widget.tenantId !== tenantId)
      throw new NotFoundException('Widget not found');

    const link = await this.prisma.dashboardWidget.findUnique({
      where: { dashboardId_widgetId: { dashboardId, widgetId } },
    });
    if (!link) throw new NotFoundException('Widget is not assigned to this dashboard');

    return this.prisma.dashboardWidget.update({
      where: { dashboardId_widgetId: { dashboardId, widgetId } },
      data: {
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.colSpan !== undefined && { colSpan: dto.colSpan }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async removeWidgetFromDashboard(
    tenantId: string,
    dashboardId: string,
    widgetId: string,
  ) {
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, tenantId },
    });
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    const link = await this.prisma.dashboardWidget.findUnique({
      where: { dashboardId_widgetId: { dashboardId, widgetId } },
    });
    if (!link) throw new NotFoundException('Widget is not assigned to this dashboard');

    await this.prisma.dashboardWidget.delete({
      where: { dashboardId_widgetId: { dashboardId, widgetId } },
    });
    return { deleted: true };
  }

  async reorderDashboardWidgets(
    tenantId: string,
    dashboardId: string,
    orderedWidgetIds: string[],
  ) {
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, tenantId },
    });
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    await this.prisma.$transaction(
      orderedWidgetIds.map((widgetId, index) =>
        this.prisma.dashboardWidget.updateMany({
          where: { dashboardId, widgetId },
          data: { sortOrder: index },
        }),
      ),
    );

    return this.prisma.dashboardWidget.findMany({
      where: { dashboardId },
      orderBy: { sortOrder: 'asc' },
      include: { widget: true },
    });
  }

  // ─── Roles ─────────────────────────────────────────────────────────────────

  async listTenantRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      select: { id: true, name: true, color: true, isSystem: true },
      orderBy: { name: 'asc' },
    });
  }

  async assignDashboardRole(
    dashboardId: string,
    roleId: string,
    canView = true,
    canEdit = false,
  ) {
    return this.prisma.dashboardRole.upsert({
      where: { dashboardId_roleId: { dashboardId, roleId } },
      create: { dashboardId, roleId, canView, canEdit },
      update: { canView, canEdit },
    });
  }

  async removeDashboardRole(dashboardId: string, roleId: string) {
    const existing = await this.prisma.dashboardRole.findUnique({
      where: { dashboardId_roleId: { dashboardId, roleId } },
    });
    if (!existing) throw new NotFoundException('Role assignment not found');

    await this.prisma.dashboardRole.delete({
      where: { dashboardId_roleId: { dashboardId, roleId } },
    });
    return { deleted: true };
  }
}
