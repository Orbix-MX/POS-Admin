import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { PermissionCacheService } from '../../../common/cache/permission-cache.service';
import { AuditService } from '../../../common/services/audit.service';
import { EffectivePermissionsService } from '../../../common/services/effective-permissions.service';
import { BusinessVertical } from '@prisma/client';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { getTemplatesForVertical, getTemplateByKey } from './role-templates.constants';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly permissionCache: PermissionCacheService,
    private readonly audit: AuditService,
    private readonly effectivePermissions: EffectivePermissionsService,
  ) {}

  /**
   * Plantillas de rol para el vertical dado (o el del tenant actual si se
   * omite) — biblioteca de solo lectura, ver `role-templates.constants.ts`.
   * No crea nada; eso lo hace `applyTemplate`, y solo cuando el tenant lo pide.
   */
  async listTemplates(vertical?: BusinessVertical) {
    const tenantId = this.tenantContext.requireTenantId();
    const effectiveVertical =
      vertical ??
      (await this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { businessVertical: true },
      })).businessVertical;

    return getTemplatesForVertical(effectiveVertical).map((t) => ({
      key: t.key,
      name: t.name,
      description: t.description,
      color: t.color,
      permissionCount: t.permissionKeys.length,
    }));
  }

  /**
   * Crea un rol nuevo a partir de una plantilla. Rechaza si el tenant ya tiene
   * un rol con ese nombre en vez de sobreescribirlo — pudo haberlo
   * personalizado ya, y aplicar la plantilla no debe borrarle ese trabajo.
   */
  async applyTemplate(templateKey: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const template = getTemplateByKey(templateKey);
    if (!template) throw new NotFoundException(`Plantilla "${templateKey}" no encontrada`);

    const existing = await this.prisma.role.findUnique({
      where: { tenantId_name: { tenantId, name: template.name } },
    });
    if (existing) {
      throw new ConflictException(`Ya existe un rol llamado "${template.name}" en esta empresa.`);
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: template.permissionKeys } },
    });

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: template.name,
        description: template.description,
        color: template.color,
        isSystem: false,
        permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
      },
    });

    await this.audit.log({
      action: 'ROLE_CREATE',
      entityType: 'Role',
      entityId: role.id,
      after: { name: role.name, fromTemplate: templateKey },
    });

    return this.findOne(role.id);
  }

  async findAll() {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.role.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { permissions: true, userAssignments: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { userAssignments: true } },
      },
    });

    if (!role) throw new NotFoundException(`Role with id "${id}" not found`);
    return role;
  }

  async create(dto: CreateRoleDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.prisma.role.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Role with name "${dto.name}" already exists`);

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        color: dto.color,
        isSystem: false,
      },
    });

    if (dto.permissionIds && dto.permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }

    await this.audit.log({
      action: 'ROLE_CREATE',
      entityType: 'Role',
      entityId: role.id,
      after: { name: role.name, permissionIds: dto.permissionIds ?? [] },
    });

    return this.findOne(role.id);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
    if (!role) throw new NotFoundException(`Role with id "${id}" not found`);

    if (role.isSystem && dto.name && dto.name !== role.name) {
      throw new BadRequestException('Cannot rename a system role');
    }

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findUnique({
        where: { tenantId_name: { tenantId, name: dto.name } },
      });
      if (existing) throw new ConflictException(`Role with name "${dto.name}" already exists`);
    }

    const { permissionIds, ...roleData } = dto;
    await this.prisma.role.update({ where: { id }, data: roleData });

    if (permissionIds !== undefined) {
      await this.setPermissions(id, permissionIds);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
    if (!role) throw new NotFoundException(`Role with id "${id}" not found`);
    if (role.isSystem) throw new BadRequestException('Cannot delete a system role');
    await this.prisma.role.delete({ where: { id } });
    await this.permissionCache.invalidateTenant(tenantId);

    await this.audit.log({
      action: 'ROLE_DELETE',
      entityType: 'Role',
      entityId: id,
      before: { name: role.name, isSystem: role.isSystem },
    });
  }

  async setPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundException(`Role with id "${roleId}" not found`);

    if (role.isSystem && permissionIds.length === 0) {
      throw new BadRequestException('Cannot remove all permissions from a system role');
    }

    // Snapshot before overwriting: this is the entry that explains, afterwards,
    // how a role ended up with more (or less) than it should.
    const previousPermissionIds = (
      await this.prisma.rolePermission.findMany({
        where: { roleId },
        select: { permissionId: true },
      })
    ).map((rp) => rp.permissionId);

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...(permissionIds.length > 0
        ? [
            this.prisma.rolePermission.createMany({
              data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    // A role change reaches every user holding it, so the whole tenant's cached
    // permissions are dropped rather than hunting down each member.
    await this.permissionCache.invalidateTenant(tenantId);

    // Now that the new permissions are in place, confirm somebody can still
    // administer the tenant. Unlike the user-level checks this one cannot be
    // predicted from a single user, so it runs inside the transaction's wake and
    // rolls the permissions back if it fails.
    const admins = await this.effectivePermissions.countAdmins(tenantId);
    if (admins === 0) {
      await this.prisma.$transaction([
        this.prisma.rolePermission.deleteMany({ where: { roleId } }),
        ...(previousPermissionIds.length > 0
          ? [
              this.prisma.rolePermission.createMany({
                data: previousPermissionIds.map((permissionId) => ({ roleId, permissionId })),
                skipDuplicates: true,
              }),
            ]
          : []),
      ]);
      await this.permissionCache.invalidateTenant(tenantId);

      throw new BadRequestException(
        'La empresa quedaría sin ningún usuario que pueda administrar usuarios y roles.',
      );
    }

    await this.audit.log({
      action: 'ROLE_PERMISSIONS_CHANGE',
      entityType: 'Role',
      entityId: roleId,
      before: { permissionIds: previousPermissionIds },
      after: { permissionIds },
    });
  }
}
