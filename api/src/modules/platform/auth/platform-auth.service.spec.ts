import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PlatformAuthService } from './platform-auth.service';
import { PasswordUtil } from '../../../common/utils/password.util';

/**
 * FASE 0 — Reseteo de contraseña en el panel Platform.
 *
 * `PATCH /platform/auth/reset-password` recibe el `userId` objetivo en el body y
 * no valida quién llama: cualquier `PlatformUser` autenticado —incluido el rol
 * `SUPPORT`— puede reescribir la contraseña de un `SUPER_ADMIN` y tomar el
 * control de la plataforma completa (todos los tenants). Tampoco exige la
 * contraseña actual cuando el objetivo es uno mismo.
 *
 * La corrección separa las dos operaciones:
 *  - self-service: sin `userId`, exigiendo `currentPassword`.
 *  - administrativa: solo `SUPER_ADMIN`, auditada en `PlatformAuditLog`.
 *
 * Los `it.failing()` fallan hoy a propósito y pasan a verde al corregirse.
 */

const SUPER_ADMIN = { id: 'pu-super', email: 'super@orbix.mx', role: 'SUPER_ADMIN', status: 'ACTIVE' };
const SUPPORT = { id: 'pu-support', email: 'support@orbix.mx', role: 'SUPPORT', status: 'ACTIVE' };

function buildService() {
  const prisma = {
    platformUser: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id?: string; email?: string } }) => {
        const rows = [SUPER_ADMIN, SUPPORT];
        const found = rows.find((r) => r.id === where.id || r.email === where.email);
        return Promise.resolve(found ? { ...found, password: 'hash-actual' } : null);
      }),
      update: jest.fn().mockResolvedValue(SUPER_ADMIN),
    },
    platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const service = new PlatformAuthService(prisma as never, new JwtService({ secret: 'test-secret' }));
  jest.spyOn(PasswordUtil, 'hash').mockResolvedValue('hash-nuevo');

  return { service, prisma };
}

describe('PlatformAuthService.resetPassword — control de acceso', () => {
  afterEach(() => jest.restoreAllMocks());

  it.failing('un SUPPORT no puede resetear la contraseña de un SUPER_ADMIN', async () => {
    const { service } = buildService();

    // El actor viaja como segundo argumento tras la corrección; hoy la firma lo
    // ignora por completo, que es justamente el defecto.
    const resetPassword = service.resetPassword.bind(service) as (
      dto: { userId: string; newPassword: string },
      actor?: unknown,
    ) => Promise<void>;

    await expect(
      resetPassword({ userId: SUPER_ADMIN.id, newPassword: 'NuevaPassword123!' }, SUPPORT),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.failing('el reseteo rechazado no escribe la nueva contraseña', async () => {
    const { service, prisma } = buildService();

    const resetPassword = service.resetPassword.bind(service) as (
      dto: { userId: string; newPassword: string },
      actor?: unknown,
    ) => Promise<void>;

    await resetPassword({ userId: SUPER_ADMIN.id, newPassword: 'NuevaPassword123!' }, SUPPORT).catch(
      () => undefined,
    );

    expect(prisma.platformUser.update).not.toHaveBeenCalled();
  });

  it.failing('un reseteo administrativo válido queda registrado en PlatformAuditLog', async () => {
    const { service, prisma } = buildService();

    const resetPassword = service.resetPassword.bind(service) as (
      dto: { userId: string; newPassword: string },
      actor?: unknown,
    ) => Promise<void>;

    await resetPassword({ userId: SUPPORT.id, newPassword: 'NuevaPassword123!' }, SUPER_ADMIN);

    expect(prisma.platformAuditLog.create).toHaveBeenCalled();
  });

  it('la contraseña se persiste hasheada, nunca en claro (regresión)', async () => {
    const { service, prisma } = buildService();

    await service.resetPassword({ userId: SUPPORT.id, newPassword: 'NuevaPassword123!' });

    expect(prisma.platformUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ password: 'hash-nuevo' }) }),
    );
  });
});

describe('PlatformAuthService.login — regresión', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rechaza credenciales inválidas sin revelar si el correo existe', async () => {
    const { service } = buildService();
    jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(false);

    await expect(
      service.login({ email: SUPER_ADMIN.email, password: 'incorrecta' }),
    ).rejects.toThrow('Invalid credentials');

    await expect(
      service.login({ email: 'noexiste@orbix.mx', password: 'loquesea' }),
    ).rejects.toThrow('Invalid credentials');
  });
});
