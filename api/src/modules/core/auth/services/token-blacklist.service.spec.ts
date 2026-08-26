import { TokenBlacklistService } from './token-blacklist.service';

/**
 * H-06 (re-auditoría) — con más de una instancia del API, revocar un token
 * en la instancia A no debía dejar de servir en la instancia B hasta que esa
 * instancia se reiniciara: `isRevoked()` solo miraba el `Map` en memoria de
 * ESA instancia, nunca la fila que `revoke()` sí escribe en BD.
 */
function build(revokedTokenRow: { expiresAt: Date } | null = null) {
  const findUnique = jest.fn().mockResolvedValue(revokedTokenRow);
  const prisma = {
    revokedToken: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique,
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const service = new TokenBlacklistService(prisma as never);
  return { service, findUnique };
}

describe('TokenBlacklistService — H-06: fallback a BD en fallo de caché', () => {
  it('un jti ausente del Map local pero vigente en BD se reporta como revocado', async () => {
    const future = new Date(Date.now() + 60_000);
    const { service, findUnique } = build({ expiresAt: future });

    await expect(service.isRevoked('jti-de-otra-instancia')).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({ where: { jti: 'jti-de-otra-instancia' }, select: { expiresAt: true } });
  });

  it('un jti que no existe en BD tampoco se reporta como revocado', async () => {
    const { service } = build(null);

    await expect(service.isRevoked('jti-nunca-revocado')).resolves.toBe(false);
  });

  it('una fila en BD ya expirada no cuenta como revocada', async () => {
    const past = new Date(Date.now() - 60_000);
    const { service } = build({ expiresAt: past });

    await expect(service.isRevoked('jti-viejo')).resolves.toBe(false);
  });

  it('tras la primera consulta, sube a caché y no vuelve a tocar la BD', async () => {
    const future = new Date(Date.now() + 60_000);
    const { service, findUnique } = build({ expiresAt: future });

    await service.isRevoked('jti-x');
    await service.isRevoked('jti-x');

    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('revoke() localmente también reporta revocado sin ir a BD', async () => {
    const { service, findUnique } = build(null);

    await service.revoke('jti-local', Date.now() + 60_000);

    await expect(service.isRevoked('jti-local')).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
