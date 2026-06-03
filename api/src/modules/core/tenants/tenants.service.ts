import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { R2Service } from '../../../storage/r2.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Prisma, Tenant } from '@prisma/client';

export interface TenantInfo {
  name: string;
  displayName?: string;
  logoUrl?: string;
  bannerUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  rfc?: string;
  timezone?: string;
  currency?: string;
}

const MAX_BRANDING_SIZE = 5 * 1024 * 1024;
const MAX_LOGO_WIDTH = 400;
const MAX_BANNER_WIDTH = 1200;

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
    private planLimits: PlanLimitsService,
    private r2: R2Service,
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
          userLimitOverride: dto.userLimitOverride,
          ...(dto.businessVertical && { businessVertical: dto.businessVertical }),
          ...(dto.posOperationMode && { posOperationMode: dto.posOperationMode }),
          ...(dto.enabledFeatures && { enabledFeatures: dto.enabledFeatures }),
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
          data: { tenantId: tenant.id, userId: user.id, role: 'OWNER', status: 'ACTIVE' },
        });

        // Protect the owner from accidental deactivation/removal.
        await tx.tenant.update({
          where: { id: tenant.id },
          data: { ownerUserId: user.id },
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

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.plan && { plan: dto.plan }),
        ...(dto.status && { status: dto.status }),
        ...(dto.settings !== undefined && { settings: dto.settings }),
        ...(dto.userLimitOverride !== undefined && { userLimitOverride: dto.userLimitOverride }),
        ...(dto.businessVertical && { businessVertical: dto.businessVertical }),
        ...(dto.posOperationMode && { posOperationMode: dto.posOperationMode }),
        ...(dto.enabledFeatures !== undefined && { enabledFeatures: dto.enabledFeatures }),
      },
    });

    // Downgrade-safe: never deactivate users. Just flag the tenant when its
    // active users now exceed the new limit (soft enforcement).
    if (dto.plan !== undefined || dto.userLimitOverride !== undefined) {
      await this.planLimits.recomputeOverLimit(id);
      return this.prisma.tenant.findUniqueOrThrow({ where: { id } });
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.tenant.delete({ where: { id } });
  }

  /** Add a user to the current tenant */
  async addMember(userId: string, role = 'STAFF' as any): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const existing = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { status: true },
    });
    // A brand-new membership defaults to ACTIVE and consumes a seat.
    if (!existing) await this.planLimits.assertCanAddActiveUser(tenantId);

    await this.prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      update: { role },
      create: { tenantId, userId, role },
    });
    if (!existing) await this.planLimits.recomputeOverLimit(tenantId);
  }

  /** Remove a user from the current tenant */
  async removeMember(userId: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { ownerUserId: true },
    });
    if (tenant?.ownerUserId === userId) {
      throw new ConflictException('No puedes remover al propietario de la empresa.');
    }
    await this.prisma.tenantMembership.delete({
      where: { tenantId_userId: { tenantId, userId } },
    });
    await this.planLimits.recomputeOverLimit(tenantId);
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

  /** Get current tenant public info + branding */
  async getInfo(): Promise<TenantInfo> {
    const tenantId = this.tenantContext.requireTenantId();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, settings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const s = (tenant.settings as Record<string, unknown>) ?? {};
    return {
      name: tenant.name,
      displayName: s['displayName'] as string | undefined,
      logoUrl:     s['logoUrl']     as string | undefined,
      bannerUrl:   s['bannerUrl']   as string | undefined,
      phone:       s['phone']       as string | undefined,
      email:       s['email']       as string | undefined,
      address:     s['address']     as string | undefined,
      rfc:         s['rfc']         as string | undefined,
      timezone:    s['timezone']    as string | undefined,
      currency:    s['currency']    as string | undefined,
    };
  }

  /** Update current tenant info (scalar fields + name) */
  async updateInfo(dto: Partial<TenantInfo>): Promise<TenantInfo> {
    const tenantId = this.tenantContext.requireTenantId();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const current = (tenant.settings as Record<string, unknown>) ?? {};
    const { name, ...scalars } = dto;
    const merged: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(scalars)) {
      if (v !== undefined) merged[k] = v;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name ? { name } : {}),
        settings: merged as Prisma.InputJsonValue,
      },
    });

    return this.getInfo();
  }

  /** Upload logo for current tenant to R2 */
  async uploadLogo(file: Express.Multer.File): Promise<{ logoUrl: string }> {
    const tenantId = this.tenantContext.requireTenantId();
    const webp = await sharp(file.buffer)
      .resize({ width: MAX_LOGO_WIDTH, withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
    const key = this.r2.buildBrandingKey(tenantId, 'logo');
    const logoUrl = await this.r2.upload(key, webp, 'image/webp');
    await this.updateBrandingField(tenantId, 'logoUrl', logoUrl);
    return { logoUrl };
  }

  /** Upload banner for current tenant to R2 */
  async uploadBanner(file: Express.Multer.File): Promise<{ bannerUrl: string }> {
    const tenantId = this.tenantContext.requireTenantId();
    const webp = await sharp(file.buffer)
      .resize({ width: MAX_BANNER_WIDTH, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const key = this.r2.buildBrandingKey(tenantId, 'banner');
    const bannerUrl = await this.r2.upload(key, webp, 'image/webp');
    await this.updateBrandingField(tenantId, 'bannerUrl', bannerUrl);
    return { bannerUrl };
  }

  /** Delete logo for current tenant */
  async deleteLogo(): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const key = this.r2.buildBrandingKey(tenantId, 'logo');
    await this.r2.delete(key);
    await this.updateBrandingField(tenantId, 'logoUrl', null);
  }

  /** Delete banner for current tenant */
  async deleteBanner(): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const key = this.r2.buildBrandingKey(tenantId, 'banner');
    await this.r2.delete(key);
    await this.updateBrandingField(tenantId, 'bannerUrl', null);
  }

  private async updateBrandingField(tenantId: string, field: string, value: string | null) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const current = (tenant?.settings as Record<string, unknown>) ?? {};
    const updated = { ...current, [field]: value };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: updated as Prisma.InputJsonValue },
    });
  }
}
