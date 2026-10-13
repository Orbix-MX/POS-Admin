import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

/**
 * H-06 — el access token debe dejar de servir en cuanto:
 *  (a) su `jti` está en la blacklist, sin importar el tipo de token, y
 *  (b) se emitió antes de `User.tokensValidFrom` (cambio/reseteo de contraseña).
 *
 * @odd acceso-residual-tras-baja T-001 / T-002 — además, el token deja de servir en cuanto
 *  (c) la membresía del usuario en la empresa deja de ser ACTIVE o desaparece, y
 *  (d) el empleado detrás de un token de operador deja de estar activo.
 */

type MembershipRow = { status: string; tenant: { status: string } } | null;

const ACTIVE_MEMBERSHIP: MembershipRow = { status: 'ACTIVE', tenant: { status: 'ACTIVE' } };

function buildStrategy({
  isRevoked = false,
  user = null as null | { id: string; status: string; tokensValidFrom: Date | null },
  membership = ACTIVE_MEMBERSHIP,
  operatorActive = true,
} = {}) {
  const config = { get: jest.fn().mockReturnValue('test-secret') };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    tenant: { findUnique: jest.fn() },
    tenantMembership: { findUnique: jest.fn().mockResolvedValue(membership) },
  };
  const tokenBlacklist = { isRevoked: jest.fn().mockReturnValue(isRevoked) };
  const operatorSession = { isActive: jest.fn().mockResolvedValue(operatorActive) };

  const strategy = new JwtStrategy(
    config as never,
    prisma as never,
    tokenBlacklist as never,
    operatorSession as never,
  );
  return { strategy, tokenBlacklist, prisma, operatorSession };
}

const NOW_SECONDS = Math.floor(Date.now() / 1000);
const ACTIVE_USER = { id: 'u1', status: 'ACTIVE', tokensValidFrom: null };

describe('JwtStrategy — H-06: blacklist aplica a cualquier tipo de token', () => {
  it('un token operator revocado se rechaza (antes se saltaba la blacklist)', async () => {
    const { strategy } = buildStrategy({ isRevoked: true });

    await expect(
      strategy.validate({ sub: 'emp-1', typ: 'operator', tenantId: 't1', jti: 'revoked-jti', iat: NOW_SECONDS }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('un token operator no revocado sigue funcionando', async () => {
    const { strategy } = buildStrategy({ isRevoked: false });

    await expect(
      strategy.validate({ sub: 'emp-1', typ: 'operator', tenantId: 't1', jti: 'ok-jti', iat: NOW_SECONDS }),
    ).resolves.toMatchObject({ id: 'emp-1', role: 'DEVICE_OPERATOR' });
  });
});

describe('JwtStrategy — H-06: tokensValidFrom invalida access tokens viejos', () => {
  it('rechaza un token emitido antes de tokensValidFrom', async () => {
    const tokensValidFrom = new Date((NOW_SECONDS + 100) * 1000); // en el futuro respecto al iat
    const { strategy } = buildStrategy({ user: { id: 'u1', status: 'ACTIVE', tokensValidFrom } });

    await expect(
      strategy.validate({ sub: 'u1', iat: NOW_SECONDS }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('acepta un token emitido después de tokensValidFrom', async () => {
    const tokensValidFrom = new Date((NOW_SECONDS - 100) * 1000); // en el pasado respecto al iat
    const { strategy } = buildStrategy({ user: { id: 'u1', status: 'ACTIVE', tokensValidFrom } });

    await expect(strategy.validate({ sub: 'u1', iat: NOW_SECONDS })).resolves.toMatchObject({ id: 'u1' });
  });

  it('sin tokensValidFrom (cuenta que nunca cambió su contraseña), no rechaza nada', async () => {
    const { strategy } = buildStrategy({ user: { id: 'u1', status: 'ACTIVE', tokensValidFrom: null } });

    await expect(strategy.validate({ sub: 'u1', iat: NOW_SECONDS })).resolves.toBeDefined();
  });
});

describe('JwtStrategy — T-001: la membresía debe estar ACTIVE en cada petición', () => {
  it('membresía ACTIVE y empresa ACTIVE: pasa', async () => {
    const { strategy, prisma } = buildStrategy({ user: ACTIVE_USER });

    await expect(strategy.validate({ sub: 'u1', tenantId: 't1', iat: NOW_SECONDS })).resolves.toMatchObject({
      id: 'u1',
      tenantId: 't1',
    });
    expect(prisma.tenantMembership.findUnique).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: 't1', userId: 'u1' } },
      select: { status: true, tenant: { select: { status: true } } },
    });
  });

  it.each(['INACTIVE', 'SUSPENDED', 'INVITED'])('membresía %s: 403 MEMBERSHIP_INACTIVE', async (status) => {
    const { strategy } = buildStrategy({ user: ACTIVE_USER, membership: { status, tenant: { status: 'ACTIVE' } } });

    const err = await strategy.validate({ sub: 'u1', tenantId: 't1', iat: NOW_SECONDS }).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ statusCode: 403, code: 'MEMBERSHIP_INACTIVE' });
  });

  it('membresía removida (sin fila): 403 MEMBERSHIP_INACTIVE', async () => {
    const { strategy } = buildStrategy({ user: ACTIVE_USER, membership: null });

    const err = await strategy.validate({ sub: 'u1', tenantId: 't1', iat: NOW_SECONDS }).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: 'MEMBERSHIP_INACTIVE' });
  });

  it('empresa suspendida con membresía ACTIVE: sigue siendo 403 TENANT_SUSPENDED', async () => {
    const { strategy } = buildStrategy({
      user: ACTIVE_USER,
      membership: { status: 'ACTIVE', tenant: { status: 'SUSPENDED' } },
    });

    const err = await strategy.validate({ sub: 'u1', tenantId: 't1', iat: NOW_SECONDS }).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: 'TENANT_SUSPENDED' });
  });

  it('empresa en TRIAL con membresía ACTIVE: pasa', async () => {
    const { strategy } = buildStrategy({
      user: ACTIVE_USER,
      membership: { status: 'ACTIVE', tenant: { status: 'TRIAL' } },
    });

    await expect(strategy.validate({ sub: 'u1', tenantId: 't1', iat: NOW_SECONDS })).resolves.toBeDefined();
  });

  it('token preliminar (sin tenantId): no consulta membresía', async () => {
    const { strategy, prisma } = buildStrategy({ user: ACTIVE_USER });

    await expect(strategy.validate({ sub: 'u1', iat: NOW_SECONDS })).resolves.toMatchObject({ id: 'u1' });
    expect(prisma.tenantMembership.findUnique).not.toHaveBeenCalled();
  });

  it('ya no consulta la tabla de empresa por separado (mismo número de consultas que antes)', async () => {
    const { strategy, prisma } = buildStrategy({ user: ACTIVE_USER });

    await strategy.validate({ sub: 'u1', tenantId: 't1', iat: NOW_SECONDS });
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });
});

describe('JwtStrategy — T-002: el token de operador muere con el empleado', () => {
  const operator = { sub: 'emp-1', typ: 'operator' as const, tenantId: 't1', iat: NOW_SECONDS };

  it('empleado inactivo: 401 OPERATOR_INACTIVE', async () => {
    const { strategy, operatorSession } = buildStrategy({ operatorActive: false });

    const err = await strategy.validate(operator).catch((e) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(err.getResponse()).toMatchObject({ statusCode: 401, code: 'OPERATOR_INACTIVE' });
    expect(operatorSession.isActive).toHaveBeenCalledWith('t1', 'emp-1');
  });

  it('empleado activo: conserva identidad y permisos del token', async () => {
    const { strategy } = buildStrategy({ operatorActive: true });

    await expect(strategy.validate({ ...operator, permissions: ['sales:create'] })).resolves.toMatchObject({
      id: 'emp-1',
      role: 'DEVICE_OPERATOR',
      permissions: ['sales:create'],
    });
  });

  it('token de operador sin tenantId: 401 sin consultar nada', async () => {
    const { strategy, operatorSession } = buildStrategy();

    await expect(strategy.validate({ sub: 'emp-1', typ: 'operator', iat: NOW_SECONDS })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(operatorSession.isActive).not.toHaveBeenCalled();
  });
});
