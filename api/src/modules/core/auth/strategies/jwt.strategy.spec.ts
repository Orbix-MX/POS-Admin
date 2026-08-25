import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

/**
 * H-06 — el access token debe dejar de servir en cuanto:
 *  (a) su `jti` está en la blacklist, sin importar el tipo de token, y
 *  (b) se emitió antes de `User.tokensValidFrom` (cambio/reseteo de contraseña).
 *
 * Antes (a) se saltaba por completo para tokens `typ: 'operator'` (el chequeo
 * vivía después de ese early-return), y (b) no existía: un access token
 * sobrevivía al cambio de contraseña hasta su propio `exp`.
 */

function buildStrategy({
  isRevoked = false,
  user = null as null | { id: string; status: string; tokensValidFrom: Date | null },
} = {}) {
  const config = { get: jest.fn().mockReturnValue('test-secret') };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    tenant: { findUnique: jest.fn() },
  };
  const tokenBlacklist = { isRevoked: jest.fn().mockReturnValue(isRevoked) };

  const strategy = new JwtStrategy(config as never, prisma as never, tokenBlacklist as never);
  return { strategy, tokenBlacklist, prisma };
}

const NOW_SECONDS = Math.floor(Date.now() / 1000);

describe('JwtStrategy — H-06: blacklist aplica a cualquier tipo de token', () => {
  it('un token operator revocado se rechaza (antes se saltaba la blacklist)', async () => {
    const { strategy } = buildStrategy({ isRevoked: true });

    await expect(
      strategy.validate({ sub: 'emp-1', typ: 'operator', jti: 'revoked-jti', iat: NOW_SECONDS }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('un token operator no revocado sigue funcionando', async () => {
    const { strategy } = buildStrategy({ isRevoked: false });

    await expect(
      strategy.validate({ sub: 'emp-1', typ: 'operator', jti: 'ok-jti', iat: NOW_SECONDS }),
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
