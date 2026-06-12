import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthResponseDto,
  UserResponseDto,
  TenantSummaryDto,
  ProfileResponseDto,
  SelectTenantResponseDto,
  SelectBranchResponseDto,
  CapabilitiesResponseDto,
  RefreshResponseDto,
} from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { LicenseService } from '../../../common/services/license.service';
import { TenantMembership, Tenant, TenantRole, TenantPlan, BusinessVertical, PosOperationMode, TenantFeature } from '@prisma/client';
import { getModulesForPlan, getAllowedModulesForVertical } from '@orbix/types';

type MembershipWithTenant = TenantMembership & { tenant: Tenant };

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tokenBlacklist: TokenBlacklistService,
    private refreshTokens: RefreshTokenService,
    private planLimits: PlanLimitsService,
    private licenseService: LicenseService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });
    if (existing) throw new ConflictException('Email already exists');

    const hashedPassword = await PasswordUtil.hash(registerDto.password);
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const accessToken = this.generateToken({ sub: user.id, email: user.email });
    const refreshToken = await this.refreshTokens.issue(user.id);
    return { accessToken, refreshToken, user: this.mapUser(user) };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: {
        tenantMemberships: { include: { tenant: true } },
      },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await PasswordUtil.compare(loginDto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

    const memberships = user.tenantMemberships as MembershipWithTenant[];
    const activeMemberships = memberships.filter(
      (m) => m.tenant.status === 'ACTIVE' || m.tenant.status === 'TRIAL',
    );

    if (memberships.length > 0 && activeMemberships.length === 0) {
      const allSuspended = memberships.every((m) => m.tenant.status === 'SUSPENDED');
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          code: allSuspended ? 'TENANT_SUSPENDED' : 'TENANT_INACTIVE',
          message: allSuspended
            ? 'Tu empresa se encuentra suspendida. Contacta al administrador.'
            : 'La empresa ya no se encuentra activa.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const accessToken = this.generateToken({ sub: user.id, email: user.email });
    const refreshToken = await this.refreshTokens.issue(user.id);
    return {
      accessToken,
      refreshToken,
      user: this.mapUser(user),
      availableTenants: activeMemberships.map((m) => this.mapMembership(m)),
    };
  }

  async logout(token: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.refreshTokens.revokeByRaw(refreshToken).catch(() => undefined);
    }
    if (!token) return;
    try {
      const decoded = this.jwtService.decode<JwtPayload>(token);
      if (decoded?.jti && decoded?.exp) {
        await this.tokenBlacklist.revoke(decoded.jti, decoded.exp * 1000);
      }
    } catch {
      // ignore malformed tokens
    }
  }

  /**
   * Rotates a refresh token and re-mints an access token. The new access token's
   * claims are rebuilt from the user's persisted lastTenantSelected /
   * lastBranchSelected, re-validating tenant/membership/branch status against the
   * live DB — so a suspended tenant or deactivated branch drops out of the token.
   */
  async refresh(rawRefreshToken: string): Promise<RefreshResponseDto> {
    const { userId, refreshToken } = await this.refreshTokens.rotate(rawRefreshToken);
    const accessToken = await this.buildAccessTokenForUser(userId);
    return { accessToken, refreshToken };
  }

  // ─── Device enrollment (QR) ──────────────────────────────────────────────────
  // The QR carries only this short-lived, single-use, TENANT-scoped token — not
  // a user session. The app exchanges it (POST /devices/enroll) over HTTPS to
  // register itself against the tenant's license. The token can't be used as
  // Bearer auth (JwtStrategy rejects any token with `typ`) and is burned on
  // first use via the token blacklist. Waiters still log in normally afterward.
  private static readonly ENROLL_TTL_SECONDS = 600;

  async createEnrollmentToken(
    tenantId: string,
    branchId?: string,
  ): Promise<{ token: string; expiresAt: Date; expiresInSeconds: number }> {
    if (!tenantId) {
      throw new BadRequestException('Select a tenant before enrolling a device');
    }
    // Only enroll devices under a valid license.
    await this.licenseService.assertValid(tenantId);

    const ttl = AuthService.ENROLL_TTL_SECONDS;
    const token = this.jwtService.sign(
      { tenantId, branchId, typ: 'enroll', jti: randomUUID() },
      { expiresIn: `${ttl}s` },
    );
    return { token, expiresAt: new Date(Date.now() + ttl * 1000), expiresInSeconds: ttl };
  }

  /** Verifies + burns an enrollment token, returning the tenant it enrolls into. */
  async consumeEnrollmentToken(token: string): Promise<{ tenantId: string; branchId?: string }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Enrollment code invalid or expired');
    }

    if (payload.typ !== 'enroll' || !payload.jti || !payload.tenantId) {
      throw new UnauthorizedException('Invalid enrollment code');
    }
    if (this.tokenBlacklist.isRevoked(payload.jti)) {
      throw new UnauthorizedException('Enrollment code already used');
    }
    if (payload.exp) await this.tokenBlacklist.revoke(payload.jti, payload.exp * 1000);

    return { tenantId: payload.tenantId, branchId: payload.branchId };
  }

  private async buildAccessTokenForUser(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // No tenant selected yet → preliminary token, same shape as fresh login.
    if (!user.lastTenantSelectedId) {
      return this.generateToken({ sub: user.id, email: user.email });
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId, tenantId: user.lastTenantSelectedId },
      include: { tenant: true },
    });

    const ALLOWED_TENANT_STATUSES = ['ACTIVE', 'TRIAL'];
    // Tenant/membership no longer usable → fall back to preliminary token so the
    // client is forced to re-select a tenant.
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      !ALLOWED_TENANT_STATUSES.includes(membership.tenant.status)
    ) {
      return this.generateToken({ sub: user.id, email: user.email });
    }

    // License gate on refresh — drop to a preliminary (tenant-less) token if the
    // tenant's license is no longer valid, forcing a fresh tenant selection.
    const license = await this.licenseService.validateLicense(membership.tenantId);
    if (!license.valid) {
      return this.generateToken({ sub: user.id, email: user.email });
    }

    const { plan, enabledModules: extraModules, businessVertical } = membership.tenant;
    const effectiveModules = this.computeEffectiveModules(plan, extraModules, businessVertical);

    // Keep the branch only if it is still active under this tenant.
    let branchId: string | undefined;
    if (user.lastBranchSelectedId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: user.lastBranchSelectedId, tenantId: membership.tenantId, status: 'ACTIVE' },
        select: { id: true },
      });
      branchId = branch?.id;
    }

    return this.generateToken({
      sub: user.id,
      email: user.email,
      tenantId: membership.tenantId,
      tenantRole: membership.role,
      branchId,
      plan,
      enabledModules: effectiveModules,
    });
  }

  private computeEffectiveModules(
    plan: TenantPlan,
    extraModules: string[],
    businessVertical: BusinessVertical,
  ): string[] {
    const planModules = getModulesForPlan(plan) as unknown as string[];
    const allModules = [...new Set([...planModules, ...extraModules])];
    return getAllowedModulesForVertical(allModules, businessVertical);
  }

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantMemberships: { select: { tenantId: true, role: true } },
        lastTenantSelected: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    let currentTenant: TenantSummaryDto | undefined;
    if (user.lastTenantSelected) {
      const membership = user.tenantMemberships.find(
        (m) => m.tenantId === user.lastTenantSelectedId,
      );
      currentTenant = {
        id: user.lastTenantSelected.id,
        name: user.lastTenantSelected.name,
        slug: user.lastTenantSelected.slug,
        memberRole: membership?.role ?? 'STAFF',
        plan: user.lastTenantSelected.plan,
      };
    }

    let roles: ProfileResponseDto['roles'];
    let permissions: ProfileResponseDto['permissions'];

    if (user.lastTenantSelectedId) {
      const tenantId = user.lastTenantSelectedId;

      const assignments = await this.prisma.userRoleAssignment.findMany({
        where: { userId, tenantId },
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      });

      roles = assignments.map((a) => ({
        id: a.role.id,
        name: a.role.name,
        description: a.role.description ?? undefined,
        color: a.role.color ?? undefined,
        permissions: a.role.permissions.map((rp) => rp.permission.key),
      }));

      const grants = await this.prisma.userPermissionGrant.findMany({
        where: { userId, tenantId },
        include: { permission: true },
      });

      const effectiveKeys = new Set<string>(roles.flatMap((r) => r.permissions));
      for (const g of grants) {
        if (g.granted) effectiveKeys.add(g.permission.key);
        else effectiveKeys.delete(g.permission.key);
      }
      permissions = [...effectiveKeys];
    }

    const { password, ...userWithoutPw } = user;
    return {
      user: this.mapUser(userWithoutPw as any),
      currentTenant,
      currentBranchId: user.lastBranchSelectedId ?? undefined,
      roles,
      permissions,
    };
  }

  async selectTenant(
    userId: string,
    userEmail: string,
    tenantSlug: string,
  ): Promise<SelectTenantResponseDto> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId, tenant: { slug: tenantSlug } },
      include: { tenant: true },
    });

    if (!membership) throw new UnauthorizedException('Tenant not found or access denied');

    const ALLOWED_TENANT_STATUSES = ['ACTIVE', 'TRIAL'];
    if (!ALLOWED_TENANT_STATUSES.includes(membership.tenant.status)) {
      const tenantStatusMessages: Record<string, string> = {
        CANCELLED: 'La empresa ya no se encuentra activa.',
        SUSPENDED: 'La empresa se encuentra suspendida. Contacta al administrador.',
        EXPIRED: 'La suscripción de la empresa ha expirado.',
        DISABLED: 'La empresa está deshabilitada. Contacta al administrador.',
      };
      const message = tenantStatusMessages[membership.tenant.status] ?? 'La empresa ya no se encuentra activa.';
      throw new HttpException(
        { statusCode: HttpStatus.FORBIDDEN, code: 'TENANT_INACTIVE', message },
        HttpStatus.FORBIDDEN,
      );
    }

    // Per-tenant access gate. Global User.status is checked at login; here we
    // block users whose membership in THIS tenant is not active.
    if (membership.status !== 'ACTIVE') {
      const messages: Record<string, string> = {
        INACTIVE: 'Tu acceso a esta empresa está desactivado. Contacta al administrador.',
        SUSPENDED: 'Tu acceso a esta empresa está suspendido. Contacta al administrador.',
        INVITED: 'Tu invitación a esta empresa está pendiente de activación.',
      };
      throw new UnauthorizedException(
        messages[membership.status] ?? 'Acceso a esta empresa no disponible.',
      );
    }

    // License gate — the tenant must hold a valid license to be entered.
    const license = await this.licenseService.validateLicense(membership.tenantId);
    if (!license.valid) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          code: `LICENSE_${license.reason}`,
          message: this.licenseService.reasonMessage(license.reason),
        },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastTenantSelectedId: membership.tenantId,
        lastBranchSelectedId: null,
      },
    });

    const { plan, enabledModules: extraModules, businessVertical } = membership.tenant;
    const effectiveModules = this.computeEffectiveModules(plan, extraModules, businessVertical);

    const accessToken = this.generateToken({
      sub: userId,
      email: userEmail,
      tenantId: membership.tenantId,
      tenantRole: membership.role,
      plan,
      enabledModules: effectiveModules,
    });

    const posOnly = await this.isPosOnlyUser(userId, membership.tenantId);

    return {
      accessToken,
      posOnly,
      plan,
      enabledModules: effectiveModules,
      businessVertical: membership.tenant.businessVertical,
      posOperationMode: membership.tenant.posOperationMode,
      enabledFeatures: membership.tenant.enabledFeatures,
      tenant: this.mapMembership(membership),
    };
  }

  private async isPosOnlyUser(userId: string, tenantId: string): Promise<boolean> {
    const POS_PERMISSIONS = new Set([
      'pos:access',
      'orders:create', 'orders:view', 'orders:edit',
      'products:view',
      'customers:view', 'customers:create',
      'coupons:view',
    ]);

    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, tenantId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (!assignments.length) return false;

    const allPermissions = assignments.flatMap((a) =>
      a.role.permissions.map((rp) => rp.permission.key),
    );

    if (!allPermissions.length) return false;
    if (!allPermissions.includes('pos:access')) return false;

    return allPermissions.every((key) => POS_PERMISSIONS.has(key));
  }

  async selectBranch(
    userId: string,
    userEmail: string,
    tenantId: string | undefined,
    tenantRole: TenantRole | undefined,
    branchId: string,
    plan?: TenantPlan,
    enabledModules?: string[],
  ): Promise<SelectBranchResponseDto> {
    if (!tenantId) {
      throw new BadRequestException('Select a tenant before selecting a branch');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, status: 'ACTIVE' },
    });

    if (!branch) throw new NotFoundException('Branch not found or not accessible');

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastBranchSelectedId: branchId },
    });

    const accessToken = this.generateToken({
      sub: userId,
      email: userEmail,
      tenantId,
      tenantRole,
      branchId,
      plan,
      enabledModules,
    });

    return { branchId, accessToken };
  }

  async getCapabilities(
    plan: TenantPlan,
    enabledModules: string[],
    tenantId?: string,
  ): Promise<CapabilitiesResponseDto> {
    const planModules = getModulesForPlan(plan) as unknown as string[];
    const effectiveModules = [...new Set([...planModules, ...enabledModules])];

    let maxUsers: number | null = null;
    let activeUsers = 0;
    let overUserLimit = false;
    let businessVertical: BusinessVertical = 'RETAIL';
    let posOperationMode: PosOperationMode = 'QUICK_SALE';
    let enabledFeatures: TenantFeature[] = [];

    if (tenantId) {
      const [cap, tenant] = await Promise.all([
        this.planLimits.getCapacity(tenantId),
        this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { businessVertical: true, posOperationMode: true, enabledFeatures: true },
        }),
      ]);
      maxUsers = cap.maxUsers;
      activeUsers = cap.activeUsers;
      overUserLimit = cap.overUserLimit;
      if (tenant) {
        businessVertical = tenant.businessVertical;
        posOperationMode = tenant.posOperationMode;
        enabledFeatures = tenant.enabledFeatures;
      }
    }

    return { plan, enabledModules, effectiveModules, maxUsers, activeUsers, overUserLimit, businessVertical, posOperationMode, enabledFeatures };
  }

  private generateToken(payload: JwtPayload): string {
    const jti = randomUUID();
    return this.jwtService.sign({ ...payload, jti });
  }

  private mapUser(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  private mapMembership(m: MembershipWithTenant): TenantSummaryDto {
    return {
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      memberRole: m.role,
      plan: m.tenant.plan,
    };
  }
}
