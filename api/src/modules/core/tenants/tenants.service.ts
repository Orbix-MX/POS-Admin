import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Prisma, Tenant } from '@prisma/client';

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Tenant slug already in use');

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          plan: dto.plan,
          settings: dto.settings,
          // 30-day trial on creation
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Create owner user if provided
      if (dto.ownerEmail && dto.ownerPassword) {
        let user = await tx.user.findUnique({ where: { email: dto.ownerEmail } });

        if (!user) {
          user = await tx.user.create({
            data: {
              email: dto.ownerEmail,
              password: await PasswordUtil.hash(dto.ownerPassword),
              firstName: dto.ownerFirstName ?? '',
              lastName: dto.ownerLastName ?? '',
              role: 'ADMIN',
              status: 'ACTIVE',
            },
          });
        }

        await tx.tenantMembership.create({
          data: { tenantId: tenant.id, userId: user.id, role: 'OWNER' },
        });
      }

      return tenant;
    });
  }

  async findAll(): Promise<Tenant[]> {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { memberships: true, orders: true } } },
    });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        memberships: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
        _count: { select: { products: true, customers: true, orders: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    await this.findOne(id);

    if (dto.slug) {
      const conflict = await this.prisma.tenant.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Slug already in use');
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.plan && { plan: dto.plan }),
        ...(dto.status && { status: dto.status }),
        ...(dto.settings !== undefined && { settings: dto.settings }),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.tenant.delete({ where: { id } });
  }

  /** Add a user to the current tenant */
  async addMember(userId: string, role = 'STAFF' as any): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    await this.prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      update: { role },
      create: { tenantId, userId, role },
    });
  }

  /** Remove a user from the current tenant */
  async removeMember(userId: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    await this.prisma.tenantMembership.delete({
      where: { tenantId_userId: { tenantId, userId } },
    });
  }

  /** Get current tenant settings JSON */
  async getSettings(): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireTenantId();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    return (tenant?.settings as Record<string, unknown>) ?? {};
  }

  /** Merge patch into current tenant settings JSON */
  async updateSettings(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireTenantId();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const merged = { ...(tenant?.settings as Record<string, unknown> ?? {}), ...patch };
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { settings: merged as Prisma.InputJsonValue } });
    return merged;
  }

  /** List members of the current tenant */
  async listMembers() {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.tenantMembership.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } } },
      orderBy: { assignedAt: 'desc' },
    });
  }
}
