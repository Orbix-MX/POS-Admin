import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordUtil } from '../../../common/utils/password.util';

/**
 * Bloqueo de cuenta por intentos fallidos.
 *
 * El `ThrottlerGuard` del controlador limita por IP: no frena un ataque lento
 * repartido entre muchas direcciones contra una cuenta concreta. Estos tests
 * cubren el límite por cuenta.
 *
 * Regla importante: la respuesta nunca distingue entre contraseña incorrecta y
 * cuenta bloqueada — decir "bloqueada" confirmaría que ese correo existe.
 */

const USER = {
  id: 'u1',
  email: 'ana@example.com',
  password: 'hash',
  status: 'ACTIVE',
  failedLoginAttempts: 0,
  lockedUntil: null as Date | null,
  tenantMemberships: [],
};

function buildService(overrides: Partial<typeof USER> = {}) {
  const user = { ...USER, ...overrides };

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue(user),
    },
  };

  const service = new AuthService(
    prisma as never,
    { sign: jest.fn().mockReturnValue('token') } as never,
    { get: jest.fn() } as never,
    { revoke: jest.fn() } as never,
    { issue: jest.fn().mockResolvedValue('refresh') } as never,
    { create: jest.fn() } as never,
    // GoogleLinkTicketService y MfaService: no intervienen en el bloqueo por
    // intentos fallidos (el usuario de estas pruebas no tiene MFA), pero el
    // constructor los exige.
    { issue: jest.fn(), consume: jest.fn() } as never,
    { issueChallenge: jest.fn(), verifyChallenge: jest.fn() } as never,
    { getCapacity: jest.fn() } as never,
    { getStatus: jest.fn() } as never,
  );

  return { service, prisma, user };
}

/** Último `data` con el que se actualizó al usuario. */
function lastUpdate(prisma: { user: { update: jest.Mock } }) {
  const calls = prisma.user.update.mock.calls;
  return calls.length > 0 ? calls[calls.length - 1][0].data : undefined;
}

describe('AuthService.login — bloqueo por intentos fallidos', () => {
  afterEach(() => jest.restoreAllMocks());

  it('cuenta el intento cuando la contraseña es incorrecta', async () => {
    const { service, prisma } = buildService();
    jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(false);

    await expect(
      service.login({ email: USER.email, password: 'mala' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(lastUpdate(prisma)).toEqual(
      expect.objectContaining({ failedLoginAttempts: 1 }),
    );
  });

  it('no bloquea antes del umbral', async () => {
    const { service, prisma } = buildService({ failedLoginAttempts: 3 });
    jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(false);

    await service.login({ email: USER.email, password: 'mala' }).catch(() => undefined);

    expect(lastUpdate(prisma)).not.toHaveProperty('lockedUntil');
  });

  it('bloquea al alcanzar el umbral', async () => {
    const { service, prisma } = buildService({
      failedLoginAttempts: AuthService.LOCKOUT_THRESHOLD - 1,
    });
    jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(false);

    await service.login({ email: USER.email, password: 'mala' }).catch(() => undefined);

    const data = lastUpdate(prisma);
    expect(data.failedLoginAttempts).toBe(AuthService.LOCKOUT_THRESHOLD);
    expect(data.lockedUntil).toBeInstanceOf(Date);
    expect(data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('rechaza aunque la contraseña sea CORRECTA mientras el bloqueo esté vigente', async () => {
    const { service } = buildService({
      lockedUntil: new Date(Date.now() + 10 * 60_000),
      failedLoginAttempts: AuthService.LOCKOUT_THRESHOLD,
    });
    const compare = jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(true);

    await expect(
      service.login({ email: USER.email, password: 'la-correcta' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // Ni siquiera llega a comparar: el bloqueo corta antes.
    expect(compare).not.toHaveBeenCalled();
  });

  it('no revela que la cuenta está bloqueada (mismo mensaje que credencial inválida)', async () => {
    const { service } = buildService({ lockedUntil: new Date(Date.now() + 10 * 60_000) });
    jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(true);

    await expect(
      service.login({ email: USER.email, password: 'la-correcta' }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('un bloqueo ya expirado deja pasar de nuevo', async () => {
    const { service } = buildService({
      lockedUntil: new Date(Date.now() - 60_000),
      failedLoginAttempts: AuthService.LOCKOUT_THRESHOLD,
    });
    const compare = jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(true);

    await service.login({ email: USER.email, password: 'la-correcta' }).catch(() => undefined);

    expect(compare).toHaveBeenCalled();
  });

  it('entrar bien reinicia el contador', async () => {
    const { service, prisma } = buildService({ failedLoginAttempts: 3 });
    jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(true);

    await service.login({ email: USER.email, password: 'la-correcta' }).catch(() => undefined);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failedLoginAttempts: 0, lockedUntil: null } }),
    );
  });

  it('no escribe en la base si no había intentos previos', async () => {
    const { service, prisma } = buildService({ failedLoginAttempts: 0 });
    jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(true);

    await service.login({ email: USER.email, password: 'la-correcta' }).catch(() => undefined);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('el bloqueo se alarga en tandas sucesivas pero tiene techo', async () => {
    const { service, prisma } = buildService({ failedLoginAttempts: 100 });
    jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(false);

    await service.login({ email: USER.email, password: 'mala' }).catch(() => undefined);

    const data = lastUpdate(prisma);
    const minutes = (data.lockedUntil.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeLessThanOrEqual(AuthService.LOCKOUT_MAX_MINUTES + 1);
  });
});
