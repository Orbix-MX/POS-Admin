import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../../database/prisma.service';
import { TenantRole, TenantPlan } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  tenantRole?: TenantRole;
  branchId?: string;
  plan?: TenantPlan;
  enabledModules?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'default-secret-key',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
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
