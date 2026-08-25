import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { LicenseService } from '../../../common/services/license.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { SlugUtil } from '../../../common/utils/slug.util';
import { R2Service } from '../../../storage/r2.service';
import { AuthService } from '../auth/auth.service';
import { ALL_PERMISSIONS } from '../../core/permissions/permissions.constants';
import { getTemplatesForVertical } from '../roles/role-templates.constants';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantOnboardingDto, OnboardTenantResponseDto } from './dto/onboard-tenant.dto';
import { Prisma, Tenant, TenantRole } from '@prisma/client';

export type RestaurantServiceMode = 'TABLE_SERVICE' | 'COUNTER_SERVICE' | 'HYBRID';

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
  restaurantServiceMode?: RestaurantServiceMode;
  primaryColor?: string;
  secondaryColor?: string;
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
    private licenseService: LicenseService,
    private authService: AuthService,
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

  /**
   * Self-service registration: caller is an already-authenticated user
   * without a tenant yet. Always provisions on the FREE plan with only the
   * essentials (name, owner, vertical, branch principal) — everything else
   * (billing details, branding, extra branches, roles finos) se completa
   * después desde platform, como hasta ahora.
   */
  async onboard(
    dto: CreateTenantOnboardingDto,
    userId: string,
    userEmail: string,
  ): Promise<OnboardTenantResponseDto> {
    const ownsFreeTenant = await this.prisma.tenant.findFirst({
      where: { ownerUserId: userId, plan: 'FREE', status: { in: ['ACTIVE', 'TRIAL'] } },
      select: { id: true },
    });
    if (ownsFreeTenant) {
      throw new ConflictException('Ya tienes una empresa registrada en el plan FREE.');
    }

    let slug = SlugUtil.generate(dto.name);
    let suffix = 1;
    while (await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${SlugUtil.generate(dto.name)}-${suffix++}`;
    }

    // Seed any missing permissions before assigning them to the Owner role.
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

    const { tenant, branch } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug,
          plan: 'FREE',
          status: 'ACTIVE',
          businessVertical: dto.businessVertical,
          businessProfile: dto.businessProfile,
          settings: {
            currency: dto.currency,
            timezone: dto.timezone,
            phone: dto.phone,
            countryCode: dto.countryCode,
            ...(dto.businessTypeId && { businessTypeId: dto.businessTypeId }),
          },
        },
      });

      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Principal',
          code: 'MAIN',
          phone: dto.phone,
          isMain: true,
          status: 'ACTIVE',
        },
      });

      await tx.tenantMembership.create({
        data: { tenantId: tenant.id, userId, role: 'OWNER', status: 'ACTIVE' },
      });

      await tx.tenant.update({ where: { id: tenant.id }, data: { ownerUserId: userId } });

      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Owner',
          description: 'Acceso total a la empresa',
          isSystem: true,
          color: '#ef4444',
          permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
        },
      });

      await tx.userRoleAssignment.create({
        data: { userId, roleId: ownerRole.id, tenantId: tenant.id },
      });

      // Roles típicos del giro elegido, listos para asignar sin que el dueño
      // tenga que armarlos a mano el primer día — ver role-templates.constants.ts.
      // No se asignan a nadie: son punto de partida, no una obligación.
      if (dto.businessVertical) {
        const permByKey = new Map(permissions.map((p) => [p.key, p.id]));
        for (const template of getTemplatesForVertical(dto.businessVertical)) {
          const permissionIds = template.permissionKeys
            .map((k) => permByKey.get(k))
            .filter((id): id is string => id !== undefined);

          await tx.role.create({
            data: {
              tenantId: tenant.id,
              name: template.name,
              description: template.description,
              color: template.color,
              isSystem: false,
              permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
            },
          });
        }
      }

      return { tenant, branch };
    });

    await this.licenseService.createLicense(tenant.id, { plan: 'FREE', status: 'ACTIVE' });

    const selectResult = await this.authService.selectTenant(userId, userEmail, tenant.slug);
    return { ...selectResult, branchId: branch.id };
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

  /**
   * Add a user to the current tenant.
   *
   * `role` llegaba como `@Body('role') role?: string` casteado `as any` sin
   * validar — cualquiera con `users:create` podía fijarse `role: 'OWNER'` a sí
   * mismo. `OWNER` no se otorga por este endpoint genérico: es
   * `Tenant.ownerUserId`, y transferirlo es una operación aparte con sus
   * propias reglas, no un valor más de un enum en un body.
   */
  async addMember(userId: string, role: TenantRole = 'STAFF'): Promise<void> {
    if (role === 'OWNER') {
      throw new BadRequestException('OWNER no se puede asignar desde este endpoint.');
    }

    const tenantId = this.tenantContext.requireTenantId();

    const userExists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!userExists) throw new NotFoundException('User not found');

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
      select: { name: true, settings: true, restaurantServiceMode: true },
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
      restaurantServiceMode: tenant.restaurantServiceMode as RestaurantServiceMode | undefined,
      primaryColor:   s['primaryColor']   as string | undefined,
      secondaryColor: s['secondaryColor'] as string | undefined,
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
    const { name, restaurantServiceMode, ...scalars } = dto;
    const merged: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(scalars)) {
      if (v !== undefined) merged[k] = v;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name ? { name } : {}),
        ...(restaurantServiceMode ? { restaurantServiceMode } : {}),
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
