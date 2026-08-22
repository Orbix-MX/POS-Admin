import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditContextService } from '../context/audit-context.service';
import { TenantContextService } from '../context/tenant-context.service';
import { PermissionCacheService } from '../cache/permission-cache.service';

/**
 * Single owner of "what can this user actually do in this tenant", plus the rule
 * that nobody hands out a privilege they do not hold themselves.
 *
 * Effective permissions = union of the permissions of every assigned role,
 * plus individual `granted:true` grants, minus `granted:false` revokes. A
 * SUPER_ADMIN resolves to the whole catalog, mirroring the guard's bypass.
 */
@Injectable()
export class EffectivePermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditContext: AuditContextService,
    private readonly tenantContext: TenantContextService,
    private readonly cache: PermissionCacheService,
  ) {}

  /** Effective permission keys for a user within a tenant, cached. */
  async getFor(userId: string, tenantId: string): Promise<string[]> {
    const cached = await this.cache.get(userId, tenantId);
    if (cached) return cached;

    const permissions = await this.compute(userId, tenantId);
    await this.cache.set(userId, tenantId, permissions);
    return permissions;
  }

  private async compute(userId: string, tenantId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === 'SUPER_ADMIN') {
      const all = await this.prisma.permission.findMany({ select: { key: true } });
      return all.map((p) => p.key);
    }

    const roleAssignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, tenantId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const keys = new Set<string>();
    for (const assignment of roleAssignments) {
      for (const rp of assignment.role.permissions) {
        keys.add(rp.permission.key);
      }
    }

    const grants = await this.prisma.userPermissionGrant.findMany({
      where: { userId, tenantId },
      include: { permission: true },
    });

    for (const grant of grants) {
      if (grant.granted) keys.add(grant.permission.key);
      else keys.delete(grant.permission.key);
    }

    return [...keys];
  }

  /**
   * Refuse to grant a permission the current actor does not hold.
   *
   * Without this, `users:edit` is effectively tenant-wide admin: whoever holds
   * it can assign themselves the full-access role — or grant themselves
   * permissions one by one — without ever passing through `roles:edit`.
   * Revoking is always allowed; only granting is bounded.
   */
  async assertActorCanGrant(permissionKeys: string[]): Promise<void> {
    if (permissionKeys.length === 0) return;

    const actorId = this.auditContext.getUserId();
    if (!actorId) {
      // No identifiable actor → refuse rather than assume the change is legitimate.
      throw new ForbiddenException(
        'No se pudo identificar al usuario que realiza el cambio.',
      );
    }

    const tenantId = this.tenantContext.requireTenantId();
    const actorPermissions = new Set(await this.getFor(actorId, tenantId));
    const escalated = permissionKeys.filter((key) => !actorPermissions.has(key));

    if (escalated.length > 0) {
      throw new ForbiddenException(
        `No puedes otorgar permisos que tú no posees: ${[...new Set(escalated)].sort().join(', ')}`,
      );
    }
  }

  /**
   * Permissions that let someone recover control of a tenant: whoever holds both
   * can hand out roles and permissions again.
   */
  static readonly ADMIN_PERMISSIONS = ['users:edit', 'roles:edit'];

  /**
   * How many ACTIVE members of the tenant can still administer it.
   *
   * Guards against locking a tenant out of itself — emptying the permissions of
   * the role everyone depends on, or stripping the last admin. Nothing stopped
   * that before: the only protection was on the tenant owner, and even they
   * could be left with no permissions at all.
   *
   * Runs only on RBAC writes, never on the request hot path.
   */
  async countAdmins(tenantId: string, excludeUserId?: string): Promise<number> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
      select: {
        userId: true,
        user: {
          select: {
            role: true,
            roleAssignments: {
              where: { tenantId },
              select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } },
            },
            permissionGrants: {
              where: { tenantId },
              select: { granted: true, permission: { select: { key: true } } },
            },
          },
        },
      },
    });

    let admins = 0;
    for (const membership of memberships) {
      const user = membership.user;
      if (!user) continue;

      // A platform SUPER_ADMIN bypasses every permission check, so they count.
      if (user.role === 'SUPER_ADMIN') {
        admins++;
        continue;
      }

      const keys = new Set<string>();
      for (const assignment of user.roleAssignments) {
        for (const rp of assignment.role.permissions) keys.add(rp.permission.key);
      }
      for (const grant of user.permissionGrants) {
        if (grant.granted) keys.add(grant.permission.key);
        else keys.delete(grant.permission.key);
      }

      if (EffectivePermissionsService.ADMIN_PERMISSIONS.every((k) => keys.has(k))) {
        admins++;
      }
    }

    return admins;
  }

  /**
   * Refuse a change that would leave the tenant with nobody able to administer
   * it. `excludeUserId` models the user about to lose their access.
   */
  async assertTenantKeepsAnAdmin(tenantId: string, excludeUserId?: string): Promise<void> {
    const admins = await this.countAdmins(tenantId, excludeUserId);
    if (admins === 0) {
      throw new BadRequestException(
        'La empresa quedaría sin ningún usuario que pueda administrar usuarios y roles.',
      );
    }
  }

  /**
   * Whether the current actor holds a permission.
   *
   * For side doors: an endpoint whose main permission is one thing but that can
   * also perform a second, more sensitive action. Declaring both permissions on
   * the handler would demand the second one even when the action isn't used.
   */
  async actorHas(permissionKey: string): Promise<boolean> {
    const actorId = this.auditContext.getUserId();
    if (!actorId) return false;

    const tenantId = this.tenantContext.requireTenantId();
    const permissions = await this.getFor(actorId, tenantId);
    return permissions.includes(permissionKey);
  }

  /** Permission keys carried by the given roles, for escalation checks. */
  async keysForRoles(roleIds: string[], tenantId: string): Promise<string[]> {
    if (roleIds.length === 0) return [];

    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, tenantId },
      include: { permissions: { include: { permission: true } } },
    });

    return roles.flatMap((role) => role.permissions.map((rp) => rp.permission.key));
  }
}
