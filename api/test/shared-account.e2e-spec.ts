import 'dotenv/config';
import { randomBytes } from 'crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import { UsersService } from '../src/modules/core/users/users.service';

/**
 * @odd aislamiento-de-cupones T-003 (A-1)
 * Contra la base real: un administrador no puede cambiar el email ni el nombre de la cuenta GLOBAL de una persona que
 * también trabaja en otra empresa (con "olvidé mi contraseña" sería tomar su cuenta y todas sus demás empresas). La
 * consulta de membresías en OTRAS empresas solo se prueba de verdad con filas reales. Crea sus datos y los borra.
 */
describe('UsersService.update — cuenta compartida contra la base (e2e)', () => {
  let prisma: PrismaService;
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  let currentTenant = '';

  const service = () =>
    new UsersService(
      prisma as never,
      { requireTenantId: () => currentTenant } as never,
      {} as never,
      { invalidateUser: jest.fn() } as never,
      { recomputeOverLimit: jest.fn() } as never,
      { log: jest.fn() } as never,
    );

  const suffix = () => randomBytes(5).toString('hex');
  const newTenant = async () => {
    const t = await prisma.tenant.create({ data: { name: `E2E Cuenta ${suffix()}`, slug: `e2e-cuenta-${suffix()}` } });
    tenantIds.push(t.id);
    return t.id;
  };
  const newUser = async (email = `e2e-${suffix()}@orbix.test`) => {
    const u = await prisma.user.create({ data: { email, password: 'no-usable', firstName: 'Ana', lastName: 'Ruiz' } });
    userIds.push(u.id);
    return u;
  };
  const join = (tenantId: string, userId: string, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') =>
    prisma.tenantMembership.create({ data: { tenantId, userId, role: 'STAFF', status } });
  const emailOf = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).email;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('cuenta en DOS empresas: otro administrador no puede cambiar su email (409) y el email no cambia', async () => {
    const [t1, t2] = [await newTenant(), await newTenant()];
    const victim = await newUser();
    await join(t1, victim.id);
    await join(t2, victim.id);
    currentTenant = t1;

    const err = await service().update(victim.id, { email: `atacante-${suffix()}@evil.test` }, 'otro-admin').catch((e) => e);

    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({ code: 'ACCOUNT_SHARED' });
    expect(await emailOf(victim.id)).toBe(victim.email);
  });

  it('una membresía INACTIVE en la otra empresa también cuenta (la baja es reversible)', async () => {
    const [t1, t2] = [await newTenant(), await newTenant()];
    const victim = await newUser();
    await join(t1, victim.id);
    await join(t2, victim.id, 'INACTIVE');
    currentTenant = t1;

    await expect(service().update(victim.id, { firstName: 'Hackeado' }, 'otro-admin')).rejects.toBeInstanceOf(ConflictException);

    expect((await prisma.user.findUniqueOrThrow({ where: { id: victim.id } })).firstName).toBe('Ana');
  });

  it('la propia persona sí puede cambiar su cuenta aunque sea compartida', async () => {
    const [t1, t2] = [await newTenant(), await newTenant()];
    const me = await newUser();
    await join(t1, me.id);
    await join(t2, me.id);
    currentTenant = t1;

    await service().update(me.id, { firstName: 'Anita' }, me.id);

    expect((await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).firstName).toBe('Anita');
  });

  it('una cuenta que solo existe en esta empresa se edita con normalidad', async () => {
    const t1 = await newTenant();
    const solo = await newUser();
    await join(t1, solo.id);
    currentTenant = t1;
    const nuevo = `e2e-nuevo-${suffix()}@orbix.test`;

    await service().update(solo.id, { email: nuevo }, 'otro-admin');

    expect(await emailOf(solo.id)).toBe(nuevo);
  });

  it('una empresa sin membresía no ve la cuenta (404), compartida o no', async () => {
    const [t1, t2] = [await newTenant(), await newTenant()];
    const user = await newUser();
    await join(t1, user.id);
    currentTenant = t2;

    await expect(service().update(user.id, { firstName: 'X' }, 'otro-admin')).rejects.toBeInstanceOf(NotFoundException);
  });
});
