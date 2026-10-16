import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * @odd aislamiento-de-cupones T-003 (A-1)
 * El email y el nombre son de la cuenta GLOBAL. Un administrador de una empresa no puede cambiarlos en una persona que
 * también trabaja en otra: con "olvidé mi contraseña" sería tomar su cuenta y todas sus demás empresas.
 */

const TENANT = 'tenant-1';
const TARGET = 'user-target';
const ADMIN = 'user-admin';

function build(opts: { otherMemberships?: number } = {}) {
  const user = {
    id: TARGET, email: 'ana@correo.com', firstName: 'Ana', lastName: 'Ruiz', password: 'x',
    status: 'ACTIVE', role: 'USER', tenantMemberships: [{ status: 'ACTIVE' }],
  };
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue(user),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(user),
    },
    tenantMembership: { count: jest.fn().mockResolvedValue(opts.otherMemberships ?? 0) },
    tenant: { findUnique: jest.fn().mockResolvedValue({ ownerUserId: 'someone-else' }) },
  };
  const service = new UsersService(
    prisma as never,
    { requireTenantId: () => TENANT } as never,
    {} as never,
    { invalidateUser: jest.fn() } as never,
    { recomputeOverLimit: jest.fn() } as never,
    { log: jest.fn() } as never,
  );
  return { service, prisma };
}

describe('UsersService.update — la identidad global solo la cambia su dueña', () => {
  it('cambiar el email de una cuenta con membresías en OTRA empresa: 409 ACCOUNT_SHARED y no escribe nada', async () => {
    const { service, prisma } = build({ otherMemberships: 1 });

    const err = await service.update(TARGET, { email: 'atacante@x.com' }, ADMIN).catch((e) => e);

    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({ statusCode: 409, code: 'ACCOUNT_SHARED' });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it.each([
    ['nombre', { firstName: 'Otro' }],
    ['apellido', { lastName: 'Otro' }],
  ])('cambiar el %s de una cuenta compartida también se rechaza', async (_n, dto) => {
    const { service, prisma } = build({ otherMemberships: 2 });

    await expect(service.update(TARGET, dto, ADMIN)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('la cuenta se mira en las OTRAS empresas (tenantId distinto del actual)', async () => {
    const { service, prisma } = build({ otherMemberships: 1 });

    await service.update(TARGET, { email: 'x@x.com' }, ADMIN).catch(() => undefined);

    expect(prisma.tenantMembership.count).toHaveBeenCalledWith({
      where: { userId: TARGET, tenantId: { not: TENANT } },
    });
  });

  it('una cuenta que solo existe en esta empresa sí se puede editar', async () => {
    const { service, prisma } = build({ otherMemberships: 0 });

    await service.update(TARGET, { email: 'nuevo@correo.com' }, ADMIN);

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: TARGET }, data: { email: 'nuevo@correo.com' } });
  });

  it('la propia persona sí puede cambiar su cuenta aunque sea compartida', async () => {
    const { service, prisma } = build({ otherMemberships: 3 });

    await service.update(TARGET, { firstName: 'Anita' }, TARGET);

    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.tenantMembership.count).not.toHaveBeenCalled();
  });

  it('reenviar los mismos datos (p. ej. un formulario que solo cambia el estado) no cuenta como cambio de identidad', async () => {
    const { service, prisma } = build({ otherMemberships: 1 });
    const setStatus = jest.spyOn(service, 'setMembershipStatus').mockResolvedValue({} as never);

    await service.update(TARGET, { email: 'ana@correo.com', firstName: 'Ana', status: 'INACTIVE' }, ADMIN);

    expect(prisma.tenantMembership.count).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(TARGET, 'INACTIVE');
  });

  it('sin actor identificado se trata como ajeno (no se salta la regla)', async () => {
    const { service } = build({ otherMemberships: 1 });

    await expect(service.update(TARGET, { email: 'x@x.com' })).rejects.toBeInstanceOf(ConflictException);
  });
});
