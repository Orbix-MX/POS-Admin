import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ALL_PERMISSIONS, MODULES_ORDER } from './permissions.constants';

export interface PermissionGrouped {
  module: string;
  permissions: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    module: string;
    action: string;
  }[];
}

@Injectable()
export class PermissionsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedPermissions();
    await this.syncOwnerRolePermissions();
  }

  async seedPermissions(): Promise<void> {
    for (const perm of ALL_PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { key: perm.key },
        update: {
          name: perm.name,
          description: perm.description ?? null,
          module: perm.module,
          action: perm.action,
        },
        create: {
          key: perm.key,
          name: perm.name,
          description: perm.description ?? null,
          module: perm.module,
          action: perm.action,
        },
      });
    }
  }

  /**
   * The two full-access system role names seen across this codebase's history:
   * `TenantsService.onboard` names it "Owner", `prisma/seed.ts` names its
   * tenant-scoped catch-all "Super Admin" ("Full access to everything"). Both are
   * meant to always carry every permission.
   */
  private static readonly FULL_ACCESS_ROLE_NAMES = ['Owner', 'Super Admin'];

  /**
   * A full-access role's `RolePermission` rows are only populated once, at
   * creation — a tenant onboarded before a permission key existed (e.g.
   * `products:*` before the products feature shipped) never retroactively
   * receives it (seed.ts has its own resync for this, but only runs on a manual
   * `prisma db seed`). Runs on every boot, right after the permission catalog
   * itself is synced, so these roles always end up with the full current
   * permission set regardless of when the tenant was created.
   */
  async syncOwnerRolePermissions(): Promise<void> {
    const allPermissions = await this.prisma.permission.findMany({ select: { id: true } });
    const allPermissionIds = allPermissions.map((p) => p.id);

    const ownerRoles = await this.prisma.role.findMany({
      where: { isSystem: true, name: { in: PermissionsService.FULL_ACCESS_ROLE_NAMES } },
      select: { id: true, permissions: { select: { permissionId: true } } },
    });

    for (const role of ownerRoles) {
      const granted = new Set(role.permissions.map((rp) => rp.permissionId));
      const missing = allPermissionIds.filter((id) => !granted.has(id));
      if (missing.length === 0) continue;

      await this.prisma.rolePermission.createMany({
        data: missing.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
  }

  async findAll(): Promise<PermissionGrouped[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    // Group by module in MODULES_ORDER order
    const grouped = new Map<string, PermissionGrouped>();

    for (const mod of MODULES_ORDER) {
      grouped.set(mod, { module: mod, permissions: [] });
    }

    for (const perm of permissions) {
      if (!grouped.has(perm.module)) {
        grouped.set(perm.module, { module: perm.module, permissions: [] });
      }
      grouped.get(perm.module)!.permissions.push(perm);
    }

    return Array.from(grouped.values()).filter((g) => g.permissions.length > 0);
  }

  async findFlat() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }
}
