import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PasswordResetService } from './password-reset.service';
import { PasswordUtil } from '../../../../common/utils/password.util';

/**
 * Reseteo de contraseña por correo, para una cuenta que ya existe.
 *
 * Dos propiedades de seguridad se cubren aquí, además del camino feliz:
 *  - `requestReset` nunca revela si el correo existe: la respuesta del
 *    controller es idéntica en ambos casos, y este servicio tampoco lanza
 *    nada distinguible.
 *  - Completar el reseteo revoca TODAS las sesiones (refresh tokens): si el
 *    motivo del reseteo fue perder el control de la cuenta, la sesión de
 *    quien la tomó no debe sobrevivir al cambio.
 */

const USER = { id: 'user-1', email: 'ana@example.com', status: 'ACTIVE' };
const RAW_TOKEN = 'raw-token-de-prueba';
const TOKEN_HASH = createHash('sha256').update(RAW_TOKEN).digest('hex');

function buildService(overrides: { user?: unknown; tokenRow?: unknown } = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(overrides.user === undefined ? USER : overrides.user),
      update: jest.fn().mockResolvedValue({}),
    },
    passwordResetToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(
        overrides.tokenRow === undefined
          ? { id: 'token-1', userId: USER.id, tokenHash: TOKEN_HASH, usedAt: null, expiresAt: new Date(Date.now() + 60_000) }
          : overrides.tokenRow,
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  };

  const email = { sendPasswordReset: jest.fn().mockResolvedValue({ messageId: 'x' }) };
  const refreshTokens = { revokeAllForUser: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(undefined) };

  const service = new PasswordResetService(
    prisma as never,
    config as never,
    email as never,
    refreshTokens as never,
  );

  return { service, prisma, email, refreshTokens };
}

describe('PasswordResetService.requestReset — no revela si el correo existe', () => {
  it('si la cuenta existe, manda el correo', async () => {
    const { service, email } = buildService();

    await service.requestReset(USER.email);

    expect(email.sendPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({ to: USER.email }),
    );
  });

  it('si la cuenta NO existe, no manda correo ni lanza error', async () => {
    const { service, email } = buildService({ user: null });

    await expect(service.requestReset('nadie@example.com')).resolves.toBeUndefined();
    expect(email.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('si la cuenta está inactiva, tampoco manda correo (pero no lo dice)', async () => {
    const { service, email } = buildService({ user: { ...USER, status: 'INACTIVE' } });

    await expect(service.requestReset(USER.email)).resolves.toBeUndefined();
    expect(email.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('un enlace anterior sin usar queda inservible al pedir uno nuevo', async () => {
    const { service, prisma } = buildService();

    await service.requestReset(USER.email);

    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER.id, usedAt: null } }),
    );
  });

  it('normaliza el correo (mayúsculas/espacios) antes de buscar', async () => {
    const { service, prisma } = buildService();

    await service.requestReset(`  ${USER.email.toUpperCase()}  `);

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: USER.email } }),
    );
  });
});

describe('PasswordResetService.checkValid / resetPassword — validez del token', () => {
  it('rechaza un token que no existe', async () => {
    const { service } = buildService({ tokenRow: null });

    await expect(service.checkValid(RAW_TOKEN)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un token ya usado', async () => {
    const { service } = buildService({
      tokenRow: { id: 't', userId: USER.id, tokenHash: TOKEN_HASH, usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) },
    });

    await expect(service.checkValid(RAW_TOKEN)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un token expirado', async () => {
    const { service } = buildService({
      tokenRow: { id: 't', userId: USER.id, tokenHash: TOKEN_HASH, usedAt: null, expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(service.checkValid(RAW_TOKEN)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta un token vivo sin consumirlo', async () => {
    const { service, prisma } = buildService();

    await expect(service.checkValid(RAW_TOKEN)).resolves.toBeUndefined();
    expect(prisma.passwordResetToken.update).not.toHaveBeenCalled();
  });
});

describe('PasswordResetService.resetPassword — completar el reseteo', () => {
  afterEach(() => jest.restoreAllMocks());

  it('actualiza la contraseña hasheada', async () => {
    const { service, prisma } = buildService();
    jest.spyOn(PasswordUtil, 'hash').mockResolvedValue('hash-nuevo');

    await service.resetPassword(RAW_TOKEN, 'Tormenta9x');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ password: 'hash-nuevo' }) }),
    );
  });

  it('levanta un bloqueo por intentos fallidos si lo había', async () => {
    const { service, prisma } = buildService();
    jest.spyOn(PasswordUtil, 'hash').mockResolvedValue('hash-nuevo');

    await service.resetPassword(RAW_TOKEN, 'Tormenta9x');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
      }),
    );
  });

  it('marca el token como usado', async () => {
    const { service, prisma } = buildService();
    jest.spyOn(PasswordUtil, 'hash').mockResolvedValue('hash-nuevo');

    await service.resetPassword(RAW_TOKEN, 'Tormenta9x');

    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'token-1' }, data: expect.objectContaining({ usedAt: expect.any(Date) }) }),
    );
  });

  it('revoca TODAS las sesiones existentes del usuario', async () => {
    const { service, refreshTokens } = buildService();
    jest.spyOn(PasswordUtil, 'hash').mockResolvedValue('hash-nuevo');

    await service.resetPassword(RAW_TOKEN, 'Tormenta9x');

    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(USER.id);
  });

  it('un token ya usado no puede resetear de nuevo (uso único)', async () => {
    const { service } = buildService({
      tokenRow: { id: 't', userId: USER.id, tokenHash: TOKEN_HASH, usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) },
    });

    await expect(service.resetPassword(RAW_TOKEN, 'Tormenta9x')).rejects.toBeInstanceOf(BadRequestException);
  });
});
