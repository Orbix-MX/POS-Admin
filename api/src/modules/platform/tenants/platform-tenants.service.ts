import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';
import {
  UpdateTenantStatusDto,
  UpdateTenantPlanDto,
  UpdateTenantModulesDto,
  UpdateTenantLimitsDto,
} from './dto/update-tenant.dto';
import { PlatformTenantsQueryDto } from './dto/platform-tenants-query.dto';
import { ALL_PERMISSIONS } from '../../core/permissions/permissions.constants';

type PlatformActor = { id: string };

@Injectable()
export class PlatformTenantsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PlatformTenantsQueryDto) {
    const { status, plan, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(plan && { plan }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { slug: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              memberships: true,
              branches: true,
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: tenants,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        branches: { select: { id: true, name: true, code: true, status: true, isMain: true } },
        _count: {
          select: { memberships: true, orders: true, products: true },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async provision(dto: ProvisionTenantDto, actor: PlatformActor) {
    const slugExists = await this.prisma.tenant.findUnique({ where: { slug: dto.tenant.slug } });
    if (slugExists) throw new ConflictException(`Slug '${dto.tenant.slug}' already taken`);

    const userExists = await this.prisma.user.findUnique({ where: { email: dto.adminUser.email } });
    if (userExists) throw new ConflictException(`Email '${dto.adminUser.email}' already registered`);

    const hashedPassword = await PasswordUtil.hash(dto.adminUser.password);

    const trialEndsAt =
      dto.trialDays
        ? new Date(Date.now() + dto.trialDays * 24 * 60 * 60 * 1000)
        : undefined;

    const status = dto.trialDays ? 'TRIAL' : (dto.tenant.status ?? 'ACTIVE');

    // Seed any missing permissions in a single bulk INSERT … ON CONFLICT DO NOTHING
    await this.prisma.permission.createMany({
      data: ALL_PERMISSIONS.map((perm) => ({
        key: perm.key,
        name: perm.name,
        description: perm.description ?? null,
        module: perm.module,
        action: perm.action,
      })),
      skipDuplicates: true,
    });
    const permissions = await this.prisma.permission.findMany();

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenant.name,
          slug: dto.tenant.slug,
          plan: dto.tenant.plan,
          status,
          enabledModules: dto.tenant.enabledModules ?? [],
          trialEndsAt,
        },
      });

      // 2. Create main branch
      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: dto.branch.name,
          code: dto.branch.code,
          address: dto.branch.address,
          city: dto.branch.city,
          state: dto.branch.state,
          zipCode: dto.branch.zipCode,
          phone: dto.branch.phone,
          isMain: true,
          status: 'ACTIVE',
        },
      });

      // 3. Create admin user
      const adminUser = await tx.user.create({
        data: {
          email: dto.adminUser.email,
          password: hashedPassword,
          firstName: dto.adminUser.firstName,
          lastName: dto.adminUser.lastName,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      // 4. Create membership (OWNER role)
      await tx.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: adminUser.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      // 5. Set ownerUserId on tenant
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { ownerUserId: adminUser.id },
      });

      // 6. Create Super Admin role with all permissions for this tenant
      const superAdminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Super Admin',
          description: 'Full access to everything',
          isSystem: true,
          color: '#ef4444',
          permissions: {
            create: permissions.map((p) => ({ permissionId: p.id })),
          },
        },
      });

      // 7. Assign Super Admin role to admin user
      await tx.userRoleAssignment.create({
        data: {
          userId: adminUser.id,
          roleId: superAdminRole.id,
          tenantId: tenant.id,
        },
      });

      return { tenant, branch, adminUser };
    });

    // 8. Audit log
    await this.prisma.platformAuditLog.create({
      data: {
        platformUserId: actor.id,
        tenantId: result.tenant.id,
        action: 'TENANT_PROVISIONED',
        entityType: 'Tenant',
        entityId: result.tenant.id,
        after: {
          tenantSlug: result.tenant.slug,
          plan: result.tenant.plan,
          adminEmail: result.adminUser.email,
          branchCode: result.branch.code,
        },
        notes: dto.notes,
      },
    });

    return {
      tenant: result.tenant,
      branch: result.branch,
      adminUser: {
        id: result.adminUser.id,
        email: result.adminUser.email,
        firstName: result.adminUser.firstName,
        lastName: result.adminUser.lastName,
      },
    };
  }

  async updateStatus(id: string, dto: UpdateTenantStatusDto, actor: PlatformActor) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const before = { status: tenant.status };
    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        platformUserId: actor.id,
        tenantId: id,
        action: 'TENANT_STATUS_CHANGED',
        entityType: 'Tenant',
        entityId: id,
        before,
        after: { status: dto.status },
        notes: dto.reason,
      },
    });

    return updated;
  }

  async updatePlan(id: string, dto: UpdateTenantPlanDto, actor: PlatformActor) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const before = { plan: tenant.plan };
    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { plan: dto.plan },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        platformUserId: actor.id,
        tenantId: id,
        action: 'TENANT_PLAN_CHANGED',
        entityType: 'Tenant',
        entityId: id,
        before,
        after: { plan: dto.plan },
        notes: dto.notes,
      },
    });

    return updated;
  }

  async updateModules(id: string, dto: UpdateTenantModulesDto, actor: PlatformActor) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const before = { enabledModules: tenant.enabledModules };
    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { enabledModules: dto.enabledModules },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        platformUserId: actor.id,
        tenantId: id,
        action: 'TENANT_MODULES_CHANGED',
        entityType: 'Tenant',
        entityId: id,
        before,
        after: { enabledModules: dto.enabledModules },
      },
    });

    return updated;
  }

  async updateLimits(id: string, dto: UpdateTenantLimitsDto, actor: PlatformActor) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const before = { userLimitOverride: tenant.userLimitOverride };
    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { userLimitOverride: dto.userLimitOverride ?? null },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        platformUserId: actor.id,
        tenantId: id,
        action: 'TENANT_LIMITS_CHANGED',
        entityType: 'Tenant',
        entityId: id,
        before,
        after: { userLimitOverride: dto.userLimitOverride },
      },
    });

    return updated;
  }

  async getAuditLogs(tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.platformAuditLog.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          platformUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.platformAuditLog.count({ where: { tenantId } }),
    ]);

    return {
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getDashboardStats() {
    const [
      totalTenants,
      activeTenants,
      trialTenants,
      suspendedTenants,
      totalUsers,
      totalBranches,
      byPlan,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.tenant.count({ where: { status: 'TRIAL' } }),
      this.prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count(),
      this.prisma.branch.count(),
      this.prisma.tenant.groupBy({
        by: ['plan'],
        _count: { id: true },
      }),
    ]);

    return {
      tenants: { total: totalTenants, active: activeTenants, trial: trialTenants, suspended: suspendedTenants },
      users: { total: totalUsers },
      branches: { total: totalBranches },
      byPlan: byPlan.map((r) => ({ plan: r.plan, count: r._count.id })),
    };
  }
}
