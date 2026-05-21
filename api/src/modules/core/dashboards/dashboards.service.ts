import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TenantRole } from '@prisma/client';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { AssignDashboardRoleDto } from './dto/assign-dashboard-role.dto';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';

@Injectable()
export class DashboardsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
  ) {}

  // ── Role filtering helpers ──────────────────────────────────────────────────

  private isOwner(): boolean {
    return this.tenantContext.getTenantRole() === TenantRole.OWNER;
  }

  private async getUserRoleIds(): Promise<string[]> {
    const userId = this.auditContext.getUserId();
    const tenantId = this.tenantContext.requireTenantId();
    if (!userId) return [];
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, tenantId },
      select: { roleId: true },
    });
    return assignments.map(a => a.roleId);
  }

  private dashboardRoleFilter(roleIds: string[]): Prisma.DashboardWhereInput {
    return {
      OR: [
        { roles: { none: {} } },
        { roles: { some: { roleId: { in: roleIds }, canView: true } } },
      ],
    };
  }

  private widgetRoleFilter(roleIds: string[]): Prisma.WidgetWhereInput {
    return {
      OR: [
        { roles: { none: {} } },
        { roles: { some: { roleId: { in: roleIds } } } },
      ],
    };
  }

  // ── Dashboard CRUD ──────────────────────────────────────────────────────────

  async findAll() {
    const tenantId = this.tenantContext.requireTenantId();
    const roleFilter = this.isOwner()
      ? {}
      : this.dashboardRoleFilter(await this.getUserRoleIds());

    return this.prisma.dashboard.findMany({
      where: { tenantId, isActive: true, ...roleFilter },
      include: { _count: { select: { widgets: true } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findActive() {
    const tenantId = this.tenantContext.requireTenantId();
    const [bypass, roleIds] = this.isOwner()
      ? [true, [] as string[]]
      : [false, await this.getUserRoleIds()];

    const dashboardWhere = (extra: Prisma.DashboardWhereInput): Prisma.DashboardWhereInput => ({
      tenantId,
      isActive: true,
      ...extra,
      ...(bypass ? {} : this.dashboardRoleFilter(roleIds)),
    });

    const widgetWhere: Prisma.WidgetWhereInput = {
      isActive: true,
      ...(bypass ? {} : this.widgetRoleFilter(roleIds)),
    };

    const dashboard =
      (await this.prisma.dashboard.findFirst({
        where: dashboardWhere({ isDefault: true }),
        include: {
          widgets: { where: widgetWhere, orderBy: { sortOrder: 'asc' } },
          layouts: true,
        },
      })) ??
      (await this.prisma.dashboard.findFirst({
        where: dashboardWhere({}),
        include: {
          widgets: { where: widgetWhere, orderBy: { sortOrder: 'asc' } },
          layouts: true,
        },
        orderBy: { createdAt: 'asc' },
      }));

    if (!dashboard) throw new NotFoundException('No active dashboard found');
    return this.format(dashboard);
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const roleFilter = this.isOwner()
      ? {}
      : this.dashboardRoleFilter(await this.getUserRoleIds());

    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id, tenantId, ...roleFilter },
      include: {
        widgets: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        layouts: true,
      },
    });
    if (!dashboard) throw new NotFoundException('Dashboard not found');
    return this.format(dashboard);
  }

  async create(dto: CreateDashboardDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();

    const existing = await this.prisma.dashboard.findUnique({
      where: { tenantId_slug: { tenantId, slug: dto.slug } },
    });
    if (existing) throw new ConflictException('A dashboard with this slug already exists');

    if (dto.isDefault) {
      await this.prisma.dashboard.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.dashboard.create({
      data: {
        tenantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
        isDefault: dto.isDefault ?? false,
        icon: dto.icon ?? null,
        createdById: userId ?? null,
        updatedById: userId ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateDashboardDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();

    const dashboard = await this.prisma.dashboard.findFirst({ where: { id, tenantId } });
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    if (dto.slug && dto.slug !== dashboard.slug) {
      const existing = await this.prisma.dashboard.findUnique({
        where: { tenantId_slug: { tenantId, slug: dto.slug } },
      });
      if (existing) throw new ConflictException('A dashboard with this slug already exists');
    }

    if (dto.isDefault) {
      await this.prisma.dashboard.updateMany({
        where: { tenantId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.dashboard.update({
      where: { id },
      data: { ...dto, updatedById: userId ?? null },
    });
  }

  async updateLayout(id: string, dto: UpdateLayoutDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const dashboard = await this.prisma.dashboard.findFirst({ where: { id, tenantId } });
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    await this.prisma.$transaction(
      Object.entries(dto.layouts).map(([breakpoint, layout]) =>
        this.prisma.dashboardLayout.upsert({
          where: { dashboardId_breakpoint: { dashboardId: id, breakpoint } },
          create: { dashboardId: id, breakpoint, layout: layout as Prisma.InputJsonValue },
          update: { layout: layout as Prisma.InputJsonValue },
        }),
      ),
    );

    return { updated: true };
  }

  async remove(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dashboard = await this.prisma.dashboard.findFirst({ where: { id, tenantId } });
    if (!dashboard) throw new NotFoundException('Dashboard not found');
    return this.prisma.dashboard.update({ where: { id }, data: { isActive: false } });
  }

  async createWidget(dashboardId: string, dto: CreateWidgetDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();

    const dashboard = await this.prisma.dashboard.findFirst({ where: { id: dashboardId, tenantId } });
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    return this.prisma.widget.create({
      data: {
        dashboardId,
        tenantId,
        widgetType: dto.widgetType,
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        endpoint: dto.endpoint,
        httpMethod: dto.httpMethod ?? 'GET',
        defaultParams: dto.defaultParams ? (dto.defaultParams as Prisma.InputJsonValue) : undefined,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        refreshSeconds: dto.refreshSeconds ?? null,
        sortOrder: dto.sortOrder ?? 0,
        createdById: userId ?? null,
        updatedById: userId ?? null,
      },
    });
  }

  // ── Dashboard role management ───────────────────────────────────────────────

  async listDashboardRoles(dashboardId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dashboard = await this.prisma.dashboard.findFirst({ where: { id: dashboardId, tenantId } });
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    return this.prisma.dashboardRole.findMany({
      where: { dashboardId },
      include: { role: { select: { id: true, name: true, color: true } } },
    });
  }

  async assignDashboardRole(dashboardId: string, dto: AssignDashboardRoleDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const dashboard = await this.prisma.dashboard.findFirst({ where: { id: dashboardId, tenantId } });
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, tenantId } });
    if (!role) throw new NotFoundException('Role not found');

    return this.prisma.dashboardRole.upsert({
      where: { dashboardId_roleId: { dashboardId, roleId: dto.roleId } },
      create: {
        dashboardId,
        roleId: dto.roleId,
        canView: dto.canView ?? true,
        canEdit: dto.canEdit ?? false,
      },
      update: {
        canView: dto.canView ?? true,
        canEdit: dto.canEdit ?? false,
      },
      include: { role: { select: { id: true, name: true, color: true } } },
    });
  }

  async removeDashboardRole(dashboardId: string, roleId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dashboard = await this.prisma.dashboard.findFirst({ where: { id: dashboardId, tenantId } });
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    await this.prisma.dashboardRole.deleteMany({ where: { dashboardId, roleId } });
    return { removed: true };
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private format(dashboard: any) {
    const { layouts, ...rest } = dashboard;
    const layoutMap: Record<string, unknown> = {};
    for (const l of layouts) {
      layoutMap[l.breakpoint] = l.layout;
    }
    return { ...rest, layouts: layoutMap };
  }
}
