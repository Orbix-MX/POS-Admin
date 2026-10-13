import { SELF_SERVICE_TRIAL_DAYS, SELF_SERVICE_TRIAL_FLAG } from '../../../common/services/license.service';
import { TenantsService } from './tenants.service';

/**
 * @odd prueba-alta-self-service T-001
 *
 * Alta self-service en prueba (S-A de `orbix-mobile/docs/odd/alta-empresa.md`).
 *
 * La empresa nace en prueba PRO de 14 días, marcada para que al vencer baje a FREE
 * (ver `license.service.self-service-trial.spec.ts`). Un dueño puede tener n empresas,
 * pero solo dos con prueba: las siguientes nacen FREE. Las pruebas se cuentan de por vida
 * (también las ya terminadas): si no, cada cuenta podría encadenarlas sin fin.
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

function buildService(
  opts: { trialsUsed?: number; settings?: Record<string, unknown> } = {},
) {
  const calls: string[] = [];
  const tx = {
    $queryRaw: jest.fn().mockImplementation(() => {
      calls.push('lock');
      return Promise.resolve([]);
    }),
    tenant: {
      // Pruebas que el dueño ya usó (con la fila del usuario bloqueada, incluye las ya confirmadas).
      count: jest.fn().mockImplementation(() => {
        calls.push('count');
        return Promise.resolve(opts.trialsUsed ?? 0);
      }),
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
    { invalidateUser: jest.fn() } as never,
  );
  return { service, prisma, tx, licenseService, authService, calls };
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

  it('cuenta las pruebas que el dueño usó de por vida, también las ya terminadas', async () => {
    const { service, tx } = buildService();

    await service.onboard(dto, USER, 'ana@test.com');

    // Por la marca de prueba del alta (se queda en la empresa al bajar a FREE), no por su
    // estado actual: una prueba terminada sigue contando.
    expect(tx.tenant.count).toHaveBeenCalledWith({
      where: { ownerUserId: USER, settings: { path: [SELF_SERVICE_TRIAL_FLAG], equals: true } },
    });
  });

  it('la segunda empresa todavía lleva prueba', async () => {
    const { service, tx } = buildService({ trialsUsed: 1 });

    await service.onboard(dto, USER, 'ana@test.com');

    expect(tx.tenant.create.mock.calls[0][0].data).toMatchObject({ plan: 'PRO', status: 'TRIAL' });
  });

  it('con las dos pruebas usadas la empresa se crea igual, como FREE y sin prueba', async () => {
    const { service, tx, licenseService } = buildService({ trialsUsed: 2 });

    const result = await service.onboard(dto, USER, 'ana@test.com');

    const data = tx.tenant.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ plan: 'FREE', status: 'ACTIVE' });
    expect(data).not.toHaveProperty('trialEndsAt');
    // Sin marca: nunca bajará "de una prueba" ni gastará una prueba más.
    expect(data.settings).not.toHaveProperty(SELF_SERVICE_TRIAL_FLAG);
    expect(licenseService.createLicense).toHaveBeenCalledWith('tenant-new', { plan: 'FREE', status: 'ACTIVE' });
    expect(result).toMatchObject({ accessToken: 'tok', branchId: 'branch-1' });
  });

  it('el límite son las pruebas, no las empresas: con muchas ya usadas sigue dando de alta FREE', async () => {
    const { service, tx } = buildService({ trialsUsed: 7 });

    await service.onboard(dto, USER, 'ana@test.com');

    expect(tx.tenant.create).toHaveBeenCalled();
    expect(tx.tenant.create.mock.calls[0][0].data.plan).toBe('FREE');
  });

  it('la decisión está dentro de la transacción: bloquea al usuario y cuenta antes de crear', async () => {
    const { service, tx, calls } = buildService();

    await service.onboard(dto, USER, 'ana@test.com');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    // El orden es lo que serializa dos altas simultáneas: bloqueo → conteo → alta.
    expect(calls).toEqual(['lock', 'count']);
    expect(tx.tenant.create).toHaveBeenCalled();
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
