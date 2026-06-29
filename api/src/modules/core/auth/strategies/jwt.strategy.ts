import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../../database/prisma.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';
import { TenantRole, TenantPlan } from '@prisma/client';

const ALLOWED_TENANT_STATUSES = ['ACTIVE', 'TRIAL'] as const;

export interface JwtPayload {
  sub: string;
  email?: string;
  jti?: string;
  tenantId?: string;
  tenantRole?: TenantRole;
  branchId?: string;
  plan?: TenantPlan;
  enabledModules?: string[];
  permissions?: string[];
  /** Token kind. 'enroll' = exchange-only. 'operator' = device employee session. */
  typ?: 'enroll' | 'operator';
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private tokenBlacklist: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') as string,
    });
  }

  async validate(payload: JwtPayload) {
    // Enrollment tokens are exchange-only — never authenticate requests.
    if (payload.typ === 'enroll') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Operator tokens (device PIN session) carry employee identity, not user identity.
    if (payload.typ === 'operator') {
      return {
        id: payload.sub,
        role: 'DEVICE_OPERATOR' as const,
        tenantId: payload.tenantId,
        branchId: payload.branchId,
        plan: payload.plan,
        enabledModules: payload.enabledModules ?? [],
        permissions: payload.permissions ?? [],
      };
    }

    if (payload.jti && this.tokenBlacklist.isRevoked(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (payload.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: payload.tenantId },
        select: { status: true },
      });
      if (!tenant || !(ALLOWED_TENANT_STATUSES as readonly string[]).includes(tenant.status)) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'TENANT_SUSPENDED',
          message: 'La empresa se encuentra suspendida o inactiva. Contacta al administrador.',
        });
      }
    }

    return {
      ...user,
      tenantId: payload.tenantId,
      tenantRole: payload.tenantRole,
      branchId: payload.branchId,
      plan: payload.plan,
      enabledModules: payload.enabledModules ?? [],
    };
  }
}
