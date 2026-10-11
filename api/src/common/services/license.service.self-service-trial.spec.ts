import { LicenseService, SELF_SERVICE_TRIAL_FLAG } from './license.service';

/**
 * @odd prueba-alta-self-service T-001
 *
 * Fin de la prueba del alta self-service.
 *
 * El alta de la app crea la empresa en prueba PRO por 14 días. Decisión de
 * producto: al vencer, la empresa **baja a FREE y sigue funcionando**. Sin esto,
 * la validación perezosa la marcaba EXPIRED y el JWT, el `LicenseGuard` y
 * `select-tenant` la bloqueaban: un negocio que probó Orbix se quedaba fuera.
 * Las pruebas dadas desde Platform no cambian: siguen expirando.
 */

const TENANT = 'tenant-1';
const DAY = 86_400_000;

function license(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lic-trial',
    tenantId: TENANT,
    status: 'TRIAL',
    plan: 'PRO',
    startsAt: new Date(Date.now() - 15 * DAY),
    expiresAt: new Date(Date.now() - DAY),
    maxUsers: null,
    maxBranches: null,
    ...overrides,
  };
}

function buildService(opts: { current: ReturnType<typeof license>; selfService: boolean; closes?: boolean }) {
  const free = {
    id: 'lic-free',
    tenantId: TENANT,
    status: 'ACTIVE',
    plan: 'FREE',
    startsAt: new Date(),
    expiresAt: null,
    maxUsers: null,
    maxBranches: null,
  };
  const prisma = {
    license: {
      findFirst: jest.fn().mockResolvedValue(opts.current),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: opts.closes === false ? 0 : 1 }),
      create: jest.fn().mockResolvedValue(free),
    },
    tenant: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ settings: opts.selfService ? { [SELF_SERVICE_TRIAL_FLAG]: true } : {} }),
      update: jest.fn().mockResolvedValue({}),
    },
    platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  const service = new LicenseService(prisma as never);
  return { service, prisma, free };
}

describe('LicenseService — fin de la prueba del alta', () => {
  it('una prueba del alta vencida baja a FREE y sigue siendo válida', async () => {
    const { service, prisma } = buildService({ current: license(), selfService: true });

    const result = await service.validateLicense(TENANT);

    expect(result).toMatchObject({ valid: true, status: 'ACTIVE', licenseId: 'lic-free', tenantChanged: true });
    expect(prisma.license.updateMany).toHaveBeenCalledWith({
      where: { id: 'lic-trial', status: 'TRIAL' },
      data: { status: 'EXPIRED' },
    });
    expect(prisma.license.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: TENANT, status: 'ACTIVE', plan: 'FREE', expiresAt: null }),
    });
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT },
      data: expect.objectContaining({ plan: 'FREE', status: 'ACTIVE' }),
    });
    expect(prisma.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'LICENSE_TRIAL_ENDED_TO_FREE', tenantId: TENANT }),
    });
  });

  it('una prueba dada desde Platform sigue expirando como antes', async () => {
    const { service, prisma } = buildService({ current: license(), selfService: false });

    const result = await service.validateLicense(TENANT);

    expect(result).toMatchObject({ valid: false, reason: 'EXPIRED' });
    expect(prisma.license.create).not.toHaveBeenCalled();
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT },
      data: expect.objectContaining({ status: 'EXPIRED' }),
    });
  });

  it('dos validaciones a la vez no emiten dos licencias FREE', async () => {
    const { service, prisma, free } = buildService({
      current: license(),
      selfService: true,
      closes: false,
    });
    // Otra petición ya cerró la prueba: la actual es su FREE.
    prisma.license.findFirst.mockResolvedValueOnce(license()).mockResolvedValueOnce(free);

    const result = await service.validateLicense(TENANT);

    expect(prisma.license.create).not.toHaveBeenCalled();
    expect(prisma.platformAuditLog.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ valid: true, licenseId: 'lic-free' });
  });

  it('una prueba del alta vigente no toca nada', async () => {
    const { service, prisma } = buildService({
      current: license({ expiresAt: new Date(Date.now() + 5 * DAY) }),
      selfService: true,
    });

    const result = await service.validateLicense(TENANT);

    expect(result).toMatchObject({ valid: true, status: 'TRIAL' });
    expect(prisma.license.updateMany).not.toHaveBeenCalled();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });
});

describe('LicenseService — extender una prueba', () => {
  function renewService(current: ReturnType<typeof license>) {
    const prisma = {
      license: {
        findFirst: jest.fn().mockResolvedValue(current),
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...current, ...data }),
        ),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'lic-new', maxUsers: null, maxBranches: null, ...data }),
        ),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: TENANT }),
        update: jest.fn().mockResolvedValue({}),
      },
      platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
    return { service: new LicenseService(prisma as never), prisma };
  }

  it('renovar una prueba la mantiene en prueba y mueve el fin de la prueba del tenant', async () => {
    const vigente = license({ expiresAt: new Date(Date.now() + 2 * DAY) });
    const { service, prisma } = renewService(vigente);

    const renewed = await service.renewLicense(TENANT, { extendDays: 7 });

    expect(renewed.status).toBe('TRIAL');
    const expected = new Date(vigente.expiresAt.getTime() + 7 * DAY);
    expect(prisma.license.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'TRIAL', expiresAt: expected }) }),
    );
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT },
      data: expect.objectContaining({ status: 'TRIAL', plan: 'PRO', trialEndsAt: expected }),
    });
  });

  it('renovar una licencia pagada sigue igual: ACTIVE y sin tocar trialEndsAt', async () => {
    const { service, prisma } = renewService(
      license({ status: 'ACTIVE', expiresAt: new Date(Date.now() + 2 * DAY) }),
    );

    const renewed = await service.renewLicense(TENANT, { extendDays: 30 });

    expect(renewed.status).toBe('ACTIVE');
    const data = prisma.tenant.update.mock.calls[0][0].data;
    expect(data.status).toBe('ACTIVE');
    expect(data).not.toHaveProperty('trialEndsAt');
  });

  it('dar una prueba nueva (crear con trialDays) fija el fin de la prueba del tenant', async () => {
    const { service, prisma } = renewService(license({ status: 'ACTIVE', plan: 'FREE', expiresAt: null }));

    const created = await service.createLicense(TENANT, { plan: 'PRO', trialDays: 7 });

    expect(created.status).toBe('TRIAL');
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT },
      data: expect.objectContaining({ status: 'TRIAL', plan: 'PRO', trialEndsAt: created.expiresAt }),
    });
  });
});
