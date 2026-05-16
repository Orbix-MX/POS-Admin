import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto, PaginatedResponse } from '../../../common/dto/pagination.dto';
import { User, UserStatus } from '@prisma/client';

export interface PermissionGrantInput {
  permissionId: string;
  granted: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const tenantId = this.tenantContext.requireTenantId();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existingUser) throw new ConflictException('Email already exists');

    const hashedPassword = await PasswordUtil.hash(createUserDto.password);

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: createUserDto.role,
        status: createUserDto.status ?? UserStatus.ACTIVE,
      },
    });

    // Automatically enroll the new user as a STAFF member of the current tenant
    await this.prisma.tenantMembership.create({
      data: { tenantId, userId: user.id, role: 'STAFF' },
    });

    const { password, ...result } = user;
    return result;
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResponse<Omit<User, 'password'>>> {
    const tenantId = this.tenantContext.requireTenantId();
    const { skip, limit, page } = paginationDto;

    // Filter to users who are members of the current tenant
    const where = { tenantMemberships: { some: { tenantId } } };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { roleAssignments: true, permissionGrants: true } },
          tenantMemberships: {
            where: { tenantId },
            select: { role: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const usersWithoutPassword = users.map(({ password, ...user }) => user);

    return {
      data: usersWithoutPassword,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Omit<User, 'password'>> {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id, tenantMemberships: { some: { tenantId } } },
    });

    if (!user) throw new NotFoundException('User not found');
    const { password, ...result } = user;
    return result;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<Omit<User, 'password'>> {
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

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });

    const { password, ...result } = updated;
    return result;
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id, tenantMemberships: { some: { tenantId } } },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.delete({ where: { id } });
  }

  async findOneWithRoles(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id, tenantMemberships: { some: { tenantId } } },
      include: {
        roleAssignments: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        permissionGrants: { include: { permission: true } },
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
      await tx.userRoleAssignment.deleteMany({ where: { userId } });
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
      await tx.userPermissionGrant.deleteMany({ where: { userId } });
      if (grants.length > 0) {
        await tx.userPermissionGrant.createMany({
          data: grants.map(({ permissionId, granted }) => ({ userId, permissionId, granted, tenantId })),
          skipDuplicates: true,
        });
      }
    });
  }

  async getEffectivePermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'SUPER_ADMIN') {
      const allPermissions = await this.prisma.permission.findMany();
      return allPermissions.map((p) => p.key);
    }

    const roleAssignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
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
      where: { userId },
      include: { permission: true },
    });

    for (const grant of individualGrants) {
      if (grant.granted) permissionKeys.add(grant.permission.key);
      else permissionKeys.delete(grant.permission.key);
    }

    return Array.from(permissionKeys);
  }
}
