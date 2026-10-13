import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../../database/prisma.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';
import { OperatorSessionService } from '../../../../common/services/operator-session.service';
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
  /** Issued-at, en segundos — lo agrega `JwtService.sign()` automáticamente. */
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private tokenBlacklist: TokenBlacklistService,
    private operatorSession: OperatorSessionService,
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

    // H-06: este chequeo vivía DESPUÉS del early-return de 'operator', así
    // que un token de operador revocado (dispositivo perdido, empleado dado
    // de baja) seguía sirviendo hasta su propio `exp` (12h) sin importar la
    // blacklist. Se sube aquí para que aplique a cualquier tipo de token.
    if (payload.jti && (await this.tokenBlacklist.isRevoked(payload.jti))) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Operator tokens (device PIN session) carry employee identity, not user identity.
    // @odd acceso-residual-tras-baja T-002: el empleado dado de baja (o la empresa suspendida)
    // pierde la sesión sin esperar al `exp` de 12 h. 401, no 403: el cliente ya expira solo la
    // sesión de operador ante 401 y pide PIN de nuevo.
    if (payload.typ === 'operator') {
      if (!payload.tenantId || !(await this.operatorSession.isActive(payload.tenantId, payload.sub))) {
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'OPERATOR_INACTIVE',
          message: 'Tu sesión de operador ya no es válida. Ingresa tu PIN de nuevo.',
        });
      }
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

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // H-06: cambiar/resetear la contraseña revocaba refresh tokens pero no el
    // access token ya emitido, que seguía sirviendo hasta su propio `exp`
    // (hasta 24h con el default). `tokensValidFrom` marca "nada emitido antes
    // de este instante sirve" — se compara en segundos porque `iat` viene en
    // segundos (estándar JWT), no milisegundos.
    if (user.tokensValidFrom && payload.iat && payload.iat < Math.floor(user.tokensValidFrom.getTime() / 1000)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    if (payload.tenantId) {
      // @odd acceso-residual-tras-baja T-001: una sola consulta (membresía + empresa) en lugar de la
      // de empresa sola. Sin fila, o con la membresía desactivada/removida, el token anterior ya
      // no sirve: antes seguía vivo hasta 24 h. 403 con `code` (no 401): un 401 haría que el
      // cliente refresque y reciba un token sin empresa.
      const membership = await this.prisma.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId: payload.tenantId, userId: user.id } },
        select: { status: true, tenant: { select: { status: true } } },
      });
      if (!membership || membership.status !== 'ACTIVE') {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'MEMBERSHIP_INACTIVE',
          message: 'Tu acceso a esta empresa fue desactivado. Contacta al administrador.',
        });
      }
      const tenant = membership.tenant;
      if (!(ALLOWED_TENANT_STATUSES as readonly string[]).includes(tenant.status)) {
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
