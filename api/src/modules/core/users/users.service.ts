import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
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

  async create(createUserDto: CreateUserDto): Promise<TenantScopedUser> {
    const tenantId = this.tenantContext.requireTenantId();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existingUser) throw new ConflictException('Email already exists');

    const membershipStatus: MembershipStatus = createUserDto.status ?? 'ACTIVE';

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

    await this.prisma.tenantMembership.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: { status },
    });

    // Releasing a seat may bring the tenant back under its limit.
    await this.planLimits.recomputeOverLimit(tenantId);

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

    await this.prisma.user.delete({ where: { id } });
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

    await this.prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({ where: { userId, tenantId } });
      if (roleIds.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: roleIds.map((roleId) => ({ userId, roleId, tenantId })),
          skipDuplicates: true,
        });
      }
    });
  }

  async setPermissions(userId: string, grants: PermissionGrantInput[]): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantMemberships: { some: { tenantId } } },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermissionGrant.deleteMany({ where: { userId, tenantId } });
      if (grants.length > 0) {
        await tx.userPermissionGrant.createMany({
          data: grants.map(({ permissionId, granted }) => ({ userId, permissionId, granted, tenantId })),
          skipDuplicates: true,
        });
      }
    });
  }

  async getEffectivePermissions(userId: string): Promise<string[]> {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'SUPER_ADMIN') {
      const allPermissions = await this.prisma.permission.findMany();
      return allPermissions.map((p) => p.key);
    }

    const roleAssignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, tenantId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    const permissionKeys = new Set<string>();
    for (const assignment of roleAssignments) {
      for (const rp of assignment.role.permissions) {
        permissionKeys.add(rp.permission.key);
      }
    }

    const individualGrants = await this.prisma.userPermissionGrant.findMany({
      where: { userId, tenantId },
      include: { permission: true },
    });

    for (const grant of individualGrants) {
      if (grant.granted) permissionKeys.add(grant.permission.key);
      else permissionKeys.delete(grant.permission.key);
    }

    return Array.from(permissionKeys);
  }
}
