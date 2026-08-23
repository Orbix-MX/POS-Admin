import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PlatformAuthService } from './platform-auth.service';
import { PasswordUtil } from '../../../common/utils/password.util';

/**
 * Regresión del reseteo de contraseña en el panel Platform.
 *
 * `PATCH /platform/auth/reset-password` recibía el `userId` objetivo en el body
 * sin validar quién llamaba: cualquier `PlatformUser` autenticado —incluido el
 * rol `SUPPORT`— podía reescribir la contraseña de un `SUPER_ADMIN` y tomar el
 * control de la plataforma completa (todos los tenants). Tampoco exigía la
 * contraseña actual cuando el objetivo era uno mismo.
 *
 * Ya corregido separando las dos operaciones:
 *  - self-service (`changeOwnPassword`): sin `userId`, exigiendo `currentPassword`.
 *  - administrativa (`resetPassword`): solo `SUPER_ADMIN`, auditada en
 *    `PlatformAuditLog`.
 */

const SUPER_ADMIN = { id: 'pu-super', email: 'super@orbix.mx', role: 'SUPER_ADMIN', status: 'ACTIVE' } as const;
const SUPPORT = { id: 'pu-support', email: 'support@orbix.mx', role: 'SUPPORT', status: 'ACTIVE' } as const;

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

  it('un SUPPORT no puede resetear la contraseña de un SUPER_ADMIN', async () => {
    const { service } = buildService();

    await expect(
      service.resetPassword({ userId: SUPER_ADMIN.id, newPassword: 'NuevaPassword123!' }, SUPPORT),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el reseteo rechazado no escribe la nueva contraseña', async () => {
    const { service, prisma } = buildService();

    await service
      .resetPassword({ userId: SUPER_ADMIN.id, newPassword: 'NuevaPassword123!' }, SUPPORT)
      .catch(() => undefined);

    expect(prisma.platformUser.update).not.toHaveBeenCalled();
  });

  it('un SUPPORT tampoco puede resetear la contraseña de otro SUPPORT', async () => {
    const { service } = buildService();

    await expect(
      service.resetPassword({ userId: SUPPORT.id, newPassword: 'NuevaPassword123!' }, SUPPORT),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un reseteo administrativo válido queda registrado en PlatformAuditLog', async () => {
    const { service, prisma } = buildService();

    await service.resetPassword({ userId: SUPPORT.id, newPassword: 'NuevaPassword123!' }, SUPER_ADMIN);

    expect(prisma.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PLATFORM_PASSWORD_RESET', platformUserId: SUPER_ADMIN.id }),
      }),
    );
  });

  it('la contraseña se persiste hasheada, nunca en claro (regresión)', async () => {
    const { service, prisma } = buildService();

    await service.resetPassword({ userId: SUPPORT.id, newPassword: 'NuevaPassword123!' }, SUPER_ADMIN);

    expect(prisma.platformUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ password: 'hash-nuevo' }) }),
    );
  });
});

describe('PlatformAuthService.changeOwnPassword — self-service', () => {
  afterEach(() => jest.restoreAllMocks());

  it('exige la contraseña actual: una sesión robada no puede secuestrar la cuenta', async () => {
    const { service, prisma } = buildService();
    jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(false);

    await expect(
      service.changeOwnPassword(SUPPORT, {
        currentPassword: 'incorrecta',
        newPassword: 'NuevaPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.platformUser.update).not.toHaveBeenCalled();
  });

  it('cambia la contraseña del propio actor, no la de un userId del body', async () => {
    const { service, prisma } = buildService();
    jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(true);

    await service.changeOwnPassword(SUPPORT, {
      currentPassword: 'actual',
      newPassword: 'NuevaPassword123!',
    });

    expect(prisma.platformUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SUPPORT.id } }),
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
