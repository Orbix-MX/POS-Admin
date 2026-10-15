import { HttpException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StaffService } from './staff.service';

/**
 * @odd bloqueo-por-intentos-de-pin T-002
 * Cada superficie de PIN cuenta el fallo a QUIEN lo intenta (dispositivo o sesión de usuario), consulta el
 * bloqueo ANTES de evaluar el PIN y limpia el contador al acertar.
 */

const TENANT = 'tenant-1';
const DEVICE_ROW_ID = 'device-row-1';
const USER = 'user-1';

const EMPLOYEE = {
  id: 'emp-1', firstName: 'Ana', lastName: 'López', employeeNumber: 'E1',
  role: null, branches: [],
};

function build(opts: { employee?: unknown; locked?: boolean } = {}) {
  const employee = opts.employee === undefined ? EMPLOYEE : opts.employee;
  const prisma = {
    employee: { findFirst: jest.fn().mockResolvedValue(employee) },
    branch: { findMany: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Matriz', restaurantVisibilityMode: 'SHARED' }]) },
    tenant: { findUnique: jest.fn().mockResolvedValue({ plan: 'PRO', enabledModules: [], businessVertical: 'RESTAURANT' }) },
  };
  const pinAttempts = {
    assertNotLocked: jest.fn().mockImplementation(() =>
      opts.locked
        ? Promise.reject(new HttpException({ code: 'PIN_LOCKED' }, 429))
        : Promise.resolve(),
    ),
    registerFailure: jest.fn().mockResolvedValue(undefined),
    registerSuccess: jest.fn().mockResolvedValue(undefined),
  };
  const devicesService = {
    authorizeByToken: jest.fn().mockResolvedValue({ device: { id: DEVICE_ROW_ID, branchId: null }, tenantId: TENANT, branchId: null }),
  };
  const service = new StaffService(
    prisma as never,
    { get: jest.fn().mockReturnValue('secret') } as never,
    devicesService as never,
    new JwtService({ secret: 'secret' }),
    {} as never,
    {} as never,
    { log: jest.fn() } as never,
    pinAttempts as never,
  );
  return { service, prisma, pinAttempts };
}

describe('StaffService.pinLogin — el principal es el dispositivo', () => {
  it('PIN malo: cuenta el fallo al dispositivo y responde PIN_INVALID', async () => {
    const { service, pinAttempts } = build({ employee: null });

    const err = await service.pinLogin('tok', '0000').catch((e) => e);

    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(err.getResponse()).toMatchObject({ code: 'PIN_INVALID' });
    expect(pinAttempts.registerFailure).toHaveBeenCalledWith('DEVICE', DEVICE_ROW_ID);
    expect(pinAttempts.registerSuccess).not.toHaveBeenCalled();
  });

  it('PIN correcto: limpia el contador del dispositivo', async () => {
    const { service, pinAttempts } = build();

    await service.pinLogin('tok', '1234');

    expect(pinAttempts.registerSuccess).toHaveBeenCalledWith('DEVICE', DEVICE_ROW_ID);
    expect(pinAttempts.registerFailure).not.toHaveBeenCalled();
  });

  it('dispositivo en espera: 429 y NO se evalúa el PIN (ni siquiera el correcto)', async () => {
    const { service, prisma, pinAttempts } = build({ locked: true });

    await expect(service.pinLogin('tok', '1234')).rejects.toBeInstanceOf(HttpException);

    expect(pinAttempts.assertNotLocked).toHaveBeenCalledWith('DEVICE', DEVICE_ROW_ID);
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
    expect(pinAttempts.registerFailure).not.toHaveBeenCalled();
  });
});

describe('StaffService.operatorLogin / verifyPin — el principal es la sesión de usuario', () => {
  it('operatorLogin con PIN malo cuenta el fallo al usuario', async () => {
    const { service, pinAttempts } = build({ employee: null });

    await expect(service.operatorLogin(TENANT, '0000', 'b1', USER)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(pinAttempts.registerFailure).toHaveBeenCalledWith('USER', USER);
  });

  it('verifyPin con PIN malo cuenta el fallo al MISMO usuario (presupuesto compartido)', async () => {
    const { service, pinAttempts } = build({ employee: null });

    await expect(service.verifyPin(TENANT, '0000', USER)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(pinAttempts.registerFailure).toHaveBeenCalledWith('USER', USER);
  });

  it('verifyPin correcto limpia el contador del usuario', async () => {
    const { service, pinAttempts } = build();

    await service.verifyPin(TENANT, '1234', USER);

    expect(pinAttempts.registerSuccess).toHaveBeenCalledWith('USER', USER);
  });

  it.each([
    ['operatorLogin', (s: StaffService) => s.operatorLogin(TENANT, '1234', 'b1', USER)],
    ['verifyPin', (s: StaffService) => s.verifyPin(TENANT, '1234', USER)],
  ])('%s en espera: 429 sin evaluar el PIN', async (_name, call) => {
    const { service, prisma } = build({ locked: true });

    await expect(call(service)).rejects.toBeInstanceOf(HttpException);

    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['operatorLogin', (s: StaffService) => s.operatorLogin(TENANT, '1234', 'b1', undefined as unknown as string)],
    ['verifyPin', (s: StaffService) => s.verifyPin(TENANT, '1234', undefined as unknown as string)],
  ])('%s sin identidad de usuario: se rechaza y no se evalúa ningún PIN', async (_name, call) => {
    const { service, prisma, pinAttempts } = build();

    await expect(call(service)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
    expect(pinAttempts.registerFailure).not.toHaveBeenCalled();
  });
});
