import { ConflictException } from '@nestjs/common';
import { SELF_SERVICE_TRIAL_DAYS, SELF_SERVICE_TRIAL_FLAG } from '../../../common/services/license.service';
import { TenantsService } from './tenants.service';

/**
 * @odd prueba-alta-self-service T-001
 *
 * Alta self-service en prueba (S-A de `orbix-mobile/docs/odd/alta-empresa.md`).
 *
 * La empresa nace en prueba PRO de 14 días, marcada para que al vencer baje a FREE
 * (ver `license.service.self-service-trial.spec.ts`). La regla "una empresa gratuita
 * por dueño" cuenta las pruebas: si no, cada cuenta podría encadenarlas sin fin.
 */

const USER = 'user-1';
const DAY = 86_400_000;

const dto = {
  name: 'Panadería La Espiga',
  phone: '+525512345678',
  countryCode: 'MX',
  currency: 'MXN',
  timezone: 'America/Mexico_City',
  businessVertical: 'RETAIL',
  businessProfile: 'RETAIL_MANUFACTURING',
  businessTypeId: 'bakery',
} as never;

function buildService(opts: { ownsFreeOrTrial?: boolean; settings?: Record<string, unknown> } = {}) {
  const tx = {
    tenant: {
      create: jest.fn().mockResolvedValue({ id: 'tenant-new', slug: 'panaderia-la-espiga' }),
      update: jest.fn().mockResolvedValue({}),
    },
    branch: { create: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
    tenantMembership: { create: jest.fn().mockResolvedValue({}) },
    role: { create: jest.fn().mockResolvedValue({ id: 'role-owner' }) },
    userRoleAssignment: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    tenant: {
      findFirst: jest.fn().mockResolvedValue(opts.ownsFreeOrTrial ? { id: 'tenant-old' } : null),
      findUnique: jest.fn().mockImplementation(({ select }: { select?: Record<string, boolean> }) =>
        Promise.resolve(select?.settings ? { settings: opts.settings ?? {} } : null),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    permission: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const tenantContext = { requireTenantId: jest.fn().mockReturnValue('tenant-1') };
  const licenseService = { createLicense: jest.fn().mockResolvedValue({}) };
  const authService = {
    selectTenant: jest.fn().mockResolvedValue({ accessToken: 'tok', tenant: { slug: 'panaderia-la-espiga' } }),
  };
  const service = new TenantsService(
    prisma as never,
    tenantContext as never,
    {} as never,
    {} as never,
    licenseService as never,
    authService as never,
    {} as never,
  );
  return { service, prisma, tx, licenseService, authService };
}

describe('TenantsService.onboard — prueba del alta', () => {
  it('crea la empresa en prueba PRO de 14 días, marcada como prueba del alta', async () => {
    const { service, tx, licenseService } = buildService();
    const before = Date.now();

    const result = await service.onboard(dto, USER, 'ana@test.com');

    const data = tx.tenant.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ plan: 'PRO', status: 'TRIAL' });
    expect(data.settings).toMatchObject({ [SELF_SERVICE_TRIAL_FLAG]: true, currency: 'MXN' });
    const days = (data.trialEndsAt.getTime() - before) / DAY;
    expect(days).toBeGreaterThan(SELF_SERVICE_TRIAL_DAYS - 0.01);
    expect(days).toBeLessThan(SELF_SERVICE_TRIAL_DAYS + 0.01);

    // La licencia vence justo cuando acaba la prueba del tenant.
    expect(licenseService.createLicense).toHaveBeenCalledWith('tenant-new', {
      plan: 'PRO',
      status: 'TRIAL',
      expiresAt: data.trialEndsAt,
    });
    expect(result).toMatchObject({ accessToken: 'tok', branchId: 'branch-1' });
  });

  it('la regla de una empresa gratuita por dueño cuenta también las pruebas', async () => {
    const { service, prisma } = buildService();

    await service.onboard(dto, USER, 'ana@test.com');

    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: {
        ownerUserId: USER,
        OR: [{ plan: 'FREE', status: { in: ['ACTIVE', 'TRIAL'] } }, { status: 'TRIAL' }],
      },
      select: { id: true },
    });
  });

  it('con una empresa gratuita o en prueba, responde 409 y no crea nada', async () => {
    const { service, tx, licenseService } = buildService({ ownsFreeOrTrial: true });

    await expect(service.onboard(dto, USER, 'ana@test.com')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.tenant.create).not.toHaveBeenCalled();
    expect(licenseService.createLicense).not.toHaveBeenCalled();
  });
});

describe('TenantsService.updateSettings — claves del servidor', () => {
  it('ignora la marca de prueba del alta: un admin no decide cómo vence su prueba', async () => {
    const { service, prisma } = buildService({ settings: { currency: 'MXN' } });

    const merged = await service.updateSettings({ [SELF_SERVICE_TRIAL_FLAG]: true, currency: 'USD' });

    expect(merged).toEqual({ currency: 'USD' });
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { settings: { currency: 'USD' } },
    });
  });

  it('tampoco permite quitársela a una prueba del alta', async () => {
    const { service } = buildService({ settings: { [SELF_SERVICE_TRIAL_FLAG]: true } });

    const merged = await service.updateSettings({ [SELF_SERVICE_TRIAL_FLAG]: false, theme: 'dark' });

    expect(merged).toEqual({ [SELF_SERVICE_TRIAL_FLAG]: true, theme: 'dark' });
  });
});

describe('TenantsService.updateInfo — claves del servidor', () => {
  // `PATCH /tenants/current/info` recibe `Partial<TenantInfo>`, un tipo y no una clase
  // DTO: el ValidationPipe no puede filtrar claves y todo se mezcla en `settings`.
  // Hallazgo de /security-review sobre S-A.

  it('no deja ponerse la marca de prueba del alta a una prueba dada desde Platform', async () => {
    const { service, prisma } = buildService({ settings: {} });

    await service.updateInfo({ [SELF_SERVICE_TRIAL_FLAG]: true, phone: '+525511112222' } as never);

    const settings = prisma.tenant.update.mock.calls[0][0].data.settings;
    expect(settings).toEqual({ phone: '+525511112222' });
  });

  it('tampoco permite quitársela a una prueba del alta', async () => {
    const { service, prisma } = buildService({ settings: { [SELF_SERVICE_TRIAL_FLAG]: true } });

    await service.updateInfo({ [SELF_SERVICE_TRIAL_FLAG]: false, email: 'a@b.mx' } as never);

    const settings = prisma.tenant.update.mock.calls[0][0].data.settings;
    expect(settings).toEqual({ [SELF_SERVICE_TRIAL_FLAG]: true, email: 'a@b.mx' });
  });
});
