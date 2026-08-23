import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { EffectivePermissionsService } from '../../../common/services/effective-permissions.service';
import { PermissionCacheService } from '../../../common/cache/permission-cache.service';
import { PlanLimitsService, UserCapacity } from '../../../common/services/plan-limits.service';
import { AuditService } from '../../../common/services/audit.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto, PaginatedResponse } from '../../../common/dto/pagination.dto';
import { User, MembershipStatus } from '@prisma/client';

export interface PermissionGrantInput {
  permissionId: string;
  granted: boolean;
}

// User as returned to a tenant-scoped client: `status` / `isOwner` reflect the
// membership in the CURRENT tenant, not the global account.
type TenantScopedUser = Omit<User, 'password' | 'status'> & {
  status: MembershipStatus;
  isOwner: boolean;
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private effectivePermissions: EffectivePermissionsService,
    private permissionCache: PermissionCacheService,
    private planLimits: PlanLimitsService,
    private audit: AuditService,
  ) {}

  private async getOwnerUserId(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { ownerUserId: true },
    });
    return tenant?.ownerUserId ?? null;
  }

  /**
   * Alta directa de una cuenta. La interfaz ya no la usa: dar acceso a alguien
   * pasa por una invitación que esa persona acepta (`InvitationsService`), de
   * modo que nadie fija la contraseña de otro ni entra a una empresa sin
   * saberlo. Se mantiene para el seed y para clientes que aún no migraron.
   *
   * @deprecated Usar `POST /users/invitations`.
   */
  async create(createUserDto: CreateUserDto): Promise<TenantScopedUser> {
    const tenantId = this.tenantContext.requireTenantId();

    const membershipStatus: MembershipStatus = createUserDto.status ?? 'ACTIVE';

    // Un correo que ya existe puede ser de alguien que trabaja en otra empresa
    // de la plataforma. No se toca esa cuenta ni se la añade por la fuerza: el
    // camino es invitarla.
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existingUser) {
      throw new ConflictException({
        code: 'USER_EXISTS_INVITE_REQUIRED',
        message:
          'Ya existe una cuenta con ese correo. Envíale una invitación para que se una a esta empresa.',
      });
    }

    // A new ACTIVE member consumes a plan seat — validate before creating.
    if (membershipStatus === 'ACTIVE') {
      await this.planLimits.assertCanAddActiveUser(tenantId);
    }

    const hashedPassword = await PasswordUtil.hash(createUserDto.password);

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: createUserDto.role,
        // Global account stays ACTIVE; per-tenant access is the membership.
        status: 'ACTIVE',
      },
    });

    await this.prisma.tenantMembership.create({
      data: { tenantId, userId: user.id, role: 'STAFF', status: membershipStatus },
    });

    const ownerUserId = await this.getOwnerUserId(tenantId);
    const { password, ...result } = user;

    await this.audit.log({
      action: 'USER_CREATE',
      entityType: 'User',
      entityId: user.id,
      // Never the password, not even hashed.
      after: { email: user.email, role: user.role, membershipStatus },
    });

    return { ...result, status: membershipStatus, isOwner: ownerUserId === user.id };
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResponse<TenantScopedUser>> {
    const tenantId = this.tenantContext.requireTenantId();
    const { skip, limit, page } = paginationDto;

    const where = { tenantMemberships: { some: { tenantId } } };

    const [users, total, ownerUserId] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { roleAssignments: true, permissionGrants: true } },
          tenantMemberships: {
            where: { tenantId },
            select: { role: true, status: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
      this.getOwnerUserId(tenantId),
    ]);

    const data = users.map(({ password, tenantMemberships, ...user }) => ({
      ...user,
      tenantMemberships,
      status: tenantMemberships[0]?.status ?? 'ACTIVE',
      isOwner: ownerUserId === user.id,
    }));

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<TenantScopedUser> {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id, tenantMemberships: { some: { tenantId } } },
      include: { tenantMemberships: { where: { tenantId }, select: { status: true } } },
    });

    if (!user) throw new NotFoundException('User not found');
    const ownerUserId = await this.getOwnerUserId(tenantId);
    const { password, tenantMemberships, ...result } = user;
    return {
      ...result,
      status: tenantMemberships[0]?.status ?? 'ACTIVE',
      isOwner: ownerUserId === user.id,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<TenantScopedUser> {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id, tenantMemberships: { some: { tenantId } } },
    });
    if (!user) throw new NotFoundException('User not found');

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (existingUser) throw new ConflictException('Email already exists');
    }

    // Per-tenant status is routed to the membership (with limit/owner checks),
    // never to the global User account.
    const { status, ...userFields } = updateUserDto;
    if (status) {
      await this.setMembershipStatus(id, status);
    }

    if (Object.keys(userFields).length > 0) {
      await this.prisma.user.update({ where: { id }, data: userFields });

      // UpdateUserDto carries no password field, so nothing secret can reach the
      // log here — keep it that way if the DTO ever grows one.
      await this.audit.log({
        action: 'USER_UPDATE',
        entityType: 'User',
        entityId: id,
        before: { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
        after: userFields,
      });
    }

    return this.findOne(id);
  }

  /**
   * Change a user's access status in the CURRENT tenant. Never deletes data.
   * - Activating requires an available seat.
   * - The protected tenant owner cannot be moved out of ACTIVE.
   */
  async setMembershipStatus(
    userId: string,
    status: MembershipStatus,
  ): Promise<TenantScopedUser> {
    const tenantId = this.tenantContext.requireTenantId();
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { status: true },
    });
    if (!membership) throw new NotFoundException('User not found');

    if (membership.status === status) return this.findOne(userId);

    const ownerUserId = await this.getOwnerUserId(tenantId);
    if (ownerUserId === userId && status !== 'ACTIVE') {
      throw new BadRequestException(
        'No puedes desactivar al propietario de la empresa.',
      );
    }

    // Going from a non-seat state to ACTIVE consumes a seat.
    if (status === 'ACTIVE' && membership.status !== 'ACTIVE') {
      await this.planLimits.assertCanAddActiveUser(tenantId);
    }

    // Losing access can also leave the tenant without anyone able to administer it.
    if (status !== 'ACTIVE') {
      await this.effectivePermissions.assertTenantKeepsAnAdmin(tenantId, userId);
    }

    await this.prisma.tenantMembership.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: { status },
    });

    // Releasing a seat may bring the tenant back under its limit.
    await this.planLimits.recomputeOverLimit(tenantId);

    // Suspending someone must take their access away immediately — this is the
    // path a dismissal goes through.
    await this.permissionCache.invalidateUser(userId, tenantId);

    await this.audit.log({
      action: 'USER_STATUS_CHANGE',
      entityType: 'TenantMembership',
      entityId: `${tenantId}:${userId}`,
      before: { status: membership.status },
      after: { status },
      reason: 'Cambio manual de estado de acceso',
    });

    return this.findOne(userId);
  }

  /** Plan capacity for the current tenant. */
  async getCapacity(): Promise<UserCapacity> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.planLimits.getCapacity(tenantId);
  }

  /**
   * Remove a user FROM THE CURRENT TENANT. Never deletes the account.
   *
   * This used to run `user.delete()`, which contradicted the "never physically
   * delete" note next to `MembershipStatus` and had two consequences beyond this
   * tenant: dozens of `createdById`/`updatedById` columns across the schema are
   * `onDelete: SetNull`, so business history lost its author, and a user who
   * belonged to other tenants lost those memberships too.
   *
   * Now it revokes the membership instead, which is what Odoo does when it
   * archives a `res.users` rather than unlinking it. Erasing an account for real
   * (a GDPR request) belongs to the platform plane, not to a tenant admin.
   */
  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id, tenantMemberships: { some: { tenantId } } },
    });
    if (!user) throw new NotFoundException('User not found');

    const ownerUserId = await this.getOwnerUserId(tenantId);
    if (ownerUserId === id) {
      throw new BadRequestException(
        'No puedes eliminar al propietario de la empresa.',
      );
    }

    await this.effectivePermissions.assertTenantKeepsAnAdmin(tenantId, id);

    await this.prisma.tenantMembership.update({
      where: { tenantId_userId: { tenantId, userId: id } },
      data: { status: 'INACTIVE' },
    });

    // Frees the plan seat the membership was holding.
    await this.planLimits.recomputeOverLimit(tenantId);
    await this.permissionCache.invalidateUser(id, tenantId);

    await this.audit.log({
      action: 'USER_DELETE',
      entityType: 'TenantMembership',
      entityId: `${tenantId}:${id}`,
      before: { email: user.email, role: user.role },
      after: { membershipStatus: 'INACTIVE' },
      reason: 'Baja del usuario en la empresa (no elimina la cuenta)',
    });
  }

  async findOneWithRoles(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id, tenantMemberships: { some: { tenantId } } },
      include: {
        roleAssignments: {
          where: { tenantId },
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        permissionGrants: { where: { tenantId }, include: { permission: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    const { password, ...result } = user;
    return result;
  }

  async setRoles(userId: string, roleIds: string[]): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantMemberships: { some: { tenantId } } },
    });
    if (!user) throw new NotFoundException('User not found');

    if (roleIds.length > 0) {
      // Roles are tenant-owned: scoping the lookup by tenantId means a role id
      // belonging to another tenant simply won't be found, and the count check
      // below turns that into a rejection instead of a silent cross-tenant grant.
      const roles = await this.prisma.role.findMany({
        where: { id: { in: roleIds }, tenantId },
        select: { id: true },
      });

      if (roles.length !== new Set(roleIds).size) {
        throw new BadRequestException('Alguno de los roles no existe en esta empresa.');
      }

      await this.effectivePermissions.assertActorCanGrant(
        await this.effectivePermissions.keysForRoles(roleIds, tenantId),
      );
    }

    // If the new set of roles no longer administers the tenant, this user stops
    // counting as an admin — refuse if they were the last one. Checked before
    // writing, since throwing afterwards would leave the tenant locked out AND
    // report an error.
    const newKeys = new Set(await this.effectivePermissions.keysForRoles(roleIds, tenantId));
    const stillAdmin = EffectivePermissionsService.ADMIN_PERMISSIONS.every((k) => newKeys.has(k));
    if (!stillAdmin) {
      await this.effectivePermissions.assertTenantKeepsAnAdmin(tenantId, userId);
    }

    // Snapshot before overwriting: the audit entry is what makes an escalation
    // reconstructible afterwards.
    const previousRoleIds = (
      await this.prisma.userRoleAssignment.findMany({
        where: { userId, tenantId },
        select: { roleId: true },
      })
    ).map((a) => a.roleId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({ where: { userId, tenantId } });
      if (roleIds.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: roleIds.map((roleId) => ({ userId, roleId, tenantId })),
          skipDuplicates: true,
        });
      }
    });

    // A revoked role has to stop granting access now, not when the TTL expires.
    await this.permissionCache.invalidateUser(userId, tenantId);

    await this.audit.log({
      action: 'USER_ROLES_CHANGE',
      entityType: 'User',
      entityId: userId,
      before: { roleIds: previousRoleIds },
      after: { roleIds },
    });
  }

  async setPermissions(userId: string, grants: PermissionGrantInput[]): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantMemberships: { some: { tenantId } } },
    });
    if (!user) throw new NotFoundException('User not found');

    // Only additive grants can escalate; a revoke (granted:false) never can.
    const grantedIds = grants.filter((g) => g.granted).map((g) => g.permissionId);
    if (grantedIds.length > 0) {
      const permissions = await this.prisma.permission.findMany({
        where: { id: { in: grantedIds } },
        select: { key: true },
      });
      await this.effectivePermissions.assertActorCanGrant(permissions.map((p) => p.key));
    }

    const previousGrants = await this.prisma.userPermissionGrant.findMany({
      where: { userId, tenantId },
      select: { permissionId: true, granted: true },
    });

    // Individual revokes can strip an admin just as effectively as removing a
    // role, so the same lockout check applies.
    const revokedKeys = await this.prisma.permission.findMany({
      where: { id: { in: grants.filter((g) => !g.granted).map((g) => g.permissionId) } },
      select: { key: true },
    });
    if (revokedKeys.some((p) => EffectivePermissionsService.ADMIN_PERMISSIONS.includes(p.key))) {
      await this.effectivePermissions.assertTenantKeepsAnAdmin(tenantId, userId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermissionGrant.deleteMany({ where: { userId, tenantId } });
      if (grants.length > 0) {
        await tx.userPermissionGrant.createMany({
          data: grants.map(({ permissionId, granted }) => ({ userId, permissionId, granted, tenantId })),
          skipDuplicates: true,
        });
      }
    });

    await this.permissionCache.invalidateUser(userId, tenantId);

    await this.audit.log({
      action: 'USER_PERMISSIONS_CHANGE',
      entityType: 'User',
      entityId: userId,
      before: { grants: previousGrants },
      after: { grants },
    });
  }

  async getEffectivePermissions(userId: string): Promise<string[]> {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.effectivePermissions.getFor(userId, tenantId);
  }
}
