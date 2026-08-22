import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditContextService } from '../context/audit-context.service';
import { TenantContextService } from '../context/tenant-context.service';

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
  ) {}

  /** Effective permission keys for a user within a tenant. */
  async getFor(userId: string, tenantId: string): Promise<string[]> {
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
