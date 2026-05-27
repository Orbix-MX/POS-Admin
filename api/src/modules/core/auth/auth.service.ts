import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { TokenBlacklistService } from './services/token-blacklist.service';
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
} from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { TenantMembership, Tenant, TenantRole, TenantPlan } from '@prisma/client';
import { getModulesForPlan } from '@orbix/types';

type MembershipWithTenant = TenantMembership & { tenant: Tenant };

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tokenBlacklist: TokenBlacklistService,
    private planLimits: PlanLimitsService,
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
    return { accessToken, user: this.mapUser(user) };
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
    const activeMemberships = memberships.filter((m) => m.tenant.status !== 'CANCELLED');

    const accessToken = this.generateToken({ sub: user.id, email: user.email });
    return {
      accessToken,
      user: this.mapUser(user),
      availableTenants: activeMemberships.map((m) => this.mapMembership(m)),
    };
  }

  logout(token: string): void {
    if (!token) return;
    try {
      const decoded = this.jwtService.decode<JwtPayload>(token);
      if (decoded?.jti && decoded?.exp) {
        this.tokenBlacklist.revoke(decoded.jti, decoded.exp * 1000);
      }
    } catch {
      // ignore malformed tokens
    }
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
    if (membership.tenant.status === 'CANCELLED') {
      throw new BadRequestException('Tenant is not available');
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

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastTenantSelectedId: membership.tenantId,
        lastBranchSelectedId: null,
      },
    });

    const { plan, enabledModules: extraModules } = membership.tenant;
    const planModules = getModulesForPlan(plan) as unknown as string[];
    const effectiveModules = [...new Set([...planModules, ...extraModules])];

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
    if (tenantId) {
      const cap = await this.planLimits.getCapacity(tenantId);
      maxUsers = cap.maxUsers;
      activeUsers = cap.activeUsers;
      overUserLimit = cap.overUserLimit;
    }

    return { plan, enabledModules, effectiveModules, maxUsers, activeUsers, overUserLimit };
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
