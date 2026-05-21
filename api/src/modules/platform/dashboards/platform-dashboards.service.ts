import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';
import type { WidgetType } from '@prisma/client';

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

type AddWidgetDto = {
  widgetType: WidgetType;
  title: string;
  subtitle?: string;
  endpoint: string;
  httpMethod?: string;
  defaultParams?: Record<string, unknown>;
  config?: Record<string, unknown>;
  refreshSeconds?: number;
  sortOrder?: number;
  colSpan?: number;
};

type UpdateWidgetDto = Partial<AddWidgetDto>;

@Injectable()
export class PlatformDashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  async listDashboards(tenantId: string) {
    return this.prisma.dashboard.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { widgets: true } },
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
        widgets: { orderBy: { sortOrder: 'asc' } },
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
    if (slugTaken) throw new ConflictException(`Slug '${dto.slug}' is already in use for this tenant`);

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

  async updateDashboard(tenantId: string, dashboardId: string, dto: UpdateDashboardDto) {
    const existing = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, tenantId },
    });
    if (!existing) throw new NotFoundException('Dashboard not found');

    if (dto.slug && dto.slug !== existing.slug) {
      const slugTaken = await this.prisma.dashboard.findUnique({
        where: { tenantId_slug: { tenantId, slug: dto.slug } },
      });
      if (slugTaken) throw new ConflictException(`Slug '${dto.slug}' is already in use for this tenant`);
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

  async addWidget(tenantId: string, dashboardId: string, dto: AddWidgetDto) {
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, tenantId },
    });
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    return this.prisma.widget.create({
      data: {
        dashboardId,
        tenantId,
        widgetType: dto.widgetType,
        title: dto.title,
        subtitle: dto.subtitle,
        endpoint: dto.endpoint,
        httpMethod: dto.httpMethod ?? 'GET',
        defaultParams: dto.defaultParams !== undefined
          ? (dto.defaultParams as Prisma.InputJsonValue)
          : undefined,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        refreshSeconds: dto.refreshSeconds,
        sortOrder: dto.sortOrder ?? 0,
        colSpan: dto.colSpan ?? 6,
      },
    });
  }

  async updateWidget(tenantId: string, widgetId: string, dto: UpdateWidgetDto) {
    const widget = await this.prisma.widget.findFirst({
      where: { id: widgetId, tenantId },
    });
    if (!widget) throw new NotFoundException('Widget not found');

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
        ...(dto.refreshSeconds !== undefined && { refreshSeconds: dto.refreshSeconds }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.colSpan !== undefined && { colSpan: dto.colSpan }),
      },
    });
  }

  async deleteWidget(tenantId: string, widgetId: string) {
    const widget = await this.prisma.widget.findFirst({
      where: { id: widgetId, tenantId },
    });
    if (!widget) throw new NotFoundException('Widget not found');

    await this.prisma.widget.delete({ where: { id: widgetId } });
    return { deleted: true };
  }

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
