import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TenantRole, WidgetType } from '@prisma/client';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { AssignWidgetRoleDto } from './dto/assign-widget-role.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import {
  WidgetDisplayConfig,
  WidgetMeta,
  WidgetResponse,
} from './types/widget-response.type';

@Injectable()
export class WidgetsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
  ) {}

  // ── Role helpers ────────────────────────────────────────────────────────────

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

  private async widgetAccessFilter(): Promise<Prisma.WidgetWhereInput> {
    if (this.isOwner()) return {};
    const roleIds = await this.getUserRoleIds();
    return {
      OR: [
        { roles: { none: {} } },
        { roles: { some: { roleId: { in: roleIds } } } },
      ],
    };
  }

  // ── Widget CRUD ─────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const widget = await this.prisma.widget.findFirst({ where: { id, tenantId, isActive: true } });
    if (!widget) throw new NotFoundException('Widget not found');
    return widget;
  }

  async getData(
    id: string,
    query: Record<string, string>,
    authHeader: string | undefined,
  ): Promise<WidgetResponse> {
    const tenantId = this.tenantContext.requireTenantId();
    const roleFilter = await this.widgetAccessFilter();

    const widget = await this.prisma.widget.findFirst({
      where: { id, tenantId, isActive: true, ...roleFilter },
    });
    if (!widget) throw new NotFoundException('Widget not found');

    const params = new URLSearchParams();
    if (widget.defaultParams && typeof widget.defaultParams === 'object') {
      for (const [k, v] of Object.entries(widget.defaultParams as Record<string, unknown>)) {
        if (v != null) params.set(k, String(v));
      }
    }
    for (const [k, v] of Object.entries(query)) {
      if (v != null) params.set(k, v);
    }

    // Validate endpoint is a relative /api/ path — prevents SSRF via DB-controlled value
    if (!widget.endpoint.startsWith('/api/') || widget.endpoint.includes('..') || /[?#]/.test(widget.endpoint)) {
      return this.errorResponse(widget, 'Invalid widget endpoint configuration');
    }

    const port = process.env.PORT ?? '3001';
    const qs = params.toString();
    const url = `http://localhost:${port}${widget.endpoint}${qs ? `?${qs}` : ''}`;

    try {
      const response = await fetch(url, {
        method: (widget.httpMethod ?? 'GET').toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      });

      const data = (await response.json()) as WidgetResponse;

      if (!response.ok) {
        return this.errorResponse(widget, `Endpoint returned ${response.status}`);
      }

      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return this.errorResponse(widget, `Failed to fetch widget data: ${msg}`);
    }
  }

  async update(id: string, dto: UpdateWidgetDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();

    const widget = await this.prisma.widget.findFirst({ where: { id, tenantId } });
    if (!widget) throw new NotFoundException('Widget not found');

    const { defaultParams, config, ...rest } = dto;
    return this.prisma.widget.update({
      where: { id },
      data: {
        ...rest,
        ...(defaultParams !== undefined ? { defaultParams: defaultParams as Prisma.InputJsonValue } : {}),
        ...(config !== undefined ? { config: config as Prisma.InputJsonValue } : {}),
        updatedById: userId ?? null,
      },
    });
  }

  async remove(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const widget = await this.prisma.widget.findFirst({ where: { id, tenantId } });
    if (!widget) throw new NotFoundException('Widget not found');
    return this.prisma.widget.update({ where: { id }, data: { isActive: false } });
  }

  // ── Widget role management ──────────────────────────────────────────────────

  async listWidgetRoles(widgetId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const widget = await this.prisma.widget.findFirst({ where: { id: widgetId, tenantId } });
    if (!widget) throw new NotFoundException('Widget not found');

    return this.prisma.widgetRole.findMany({
      where: { widgetId },
      include: { role: { select: { id: true, name: true, color: true } } },
    });
  }

  async assignWidgetRole(widgetId: string, dto: AssignWidgetRoleDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const widget = await this.prisma.widget.findFirst({ where: { id: widgetId, tenantId } });
    if (!widget) throw new NotFoundException('Widget not found');

    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, tenantId } });
    if (!role) throw new NotFoundException('Role not found');

    return this.prisma.widgetRole.upsert({
      where: { widgetId_roleId: { widgetId, roleId: dto.roleId } },
      create: { widgetId, roleId: dto.roleId },
      update: {},
      include: { role: { select: { id: true, name: true, color: true } } },
    });
  }

  async removeWidgetRole(widgetId: string, roleId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const widget = await this.prisma.widget.findFirst({ where: { id: widgetId, tenantId } });
    if (!widget) throw new NotFoundException('Widget not found');

    await this.prisma.widgetRole.deleteMany({ where: { widgetId, roleId } });
    return { removed: true };
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private errorResponse(
    widget: { widgetType: WidgetType; title: string; subtitle: string | null; config: unknown },
    message: string,
  ): WidgetResponse {
    return {
      success: false,
      widgetType: widget.widgetType,
      title: widget.title,
      subtitle: widget.subtitle ?? undefined,
      data: null,
      meta: {} as WidgetMeta,
      config: (widget.config ?? {}) as WidgetDisplayConfig,
      error: message,
      lastUpdate: new Date().toISOString(),
    };
  }
}
