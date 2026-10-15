import { ForbiddenException, HttpException } from '@nestjs/common';
import { createHash } from 'crypto';

import { CashSessionsService } from './cash-sessions.service';

/**
 * @odd bloqueo-por-intentos-de-pin T-003
 * La autorización de supervisor por PIN cuenta el fallo al usuario de la sesión (el mismo contador que
 * operatorLogin/verifyPin), consulta el bloqueo ANTES de evaluar el PIN y no toca nada cuando el usuario
 * ya tiene el permiso.
 */

const TENANT = 'tenant-1';
const PEPPER = 'test-pepper';
const PIN = '4821';
const USER = 'user-1';

const hash = (pin: string) => createHash('sha256').update(`${TENANT}:${pin}:${PEPPER}`).digest('hex');

function build(opts: {
  userPermissions?: string[];
  userRole?: string;
  employeePermissions?: string[] | null;
  userId?: string | undefined;
  locked?: boolean;
} = {}) {
  const { userPermissions = [], userRole = 'STAFF', employeePermissions = null } = opts;
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ role: userRole }) },
    userRoleAssignment: {
      findMany: jest.fn().mockResolvedValue([
        { role: { permissions: userPermissions.map((key) => ({ permission: { key } })) } },
      ]),
    },
    userPermissionGrant: { findMany: jest.fn().mockResolvedValue([]) },
    employee: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: { pinHash: string } }) =>
        Promise.resolve(
          employeePermissions && where.pinHash === hash(PIN)
            ? {
                id: 'emp-1', firstName: 'Ana', lastName: 'Ruiz',
                role: { permissions: employeePermissions.map((key) => ({ permission: { key } })) },
              }
            : null,
        ),
      ),
    },
  };
  const pinAttempts = {
    assertNotLocked: jest.fn().mockImplementation(() =>
      opts.locked ? Promise.reject(new HttpException({ code: 'PIN_LOCKED' }, 429)) : Promise.resolve(),
    ),
    registerFailure: jest.fn().mockResolvedValue(undefined),
    registerSuccess: jest.fn().mockResolvedValue(undefined),
  };
  const service = new CashSessionsService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => null } as never,
    { getUserId: () => ('userId' in opts ? opts.userId : USER) } as never,
    { log: jest.fn() } as never,
    {} as never,
    { get: () => 'irrelevante' } as never,
    pinAttempts as never,
  );
  const resolve = (pin?: string) =>
    (service as unknown as { resolveCashAuthorizer: (t: string, p: string, pin?: string) => Promise<unknown> })
      .resolveCashAuthorizer(TENANT, 'pos.cash:close', pin);
  return { resolve, prisma, pinAttempts };
}

describe('resolveCashAuthorizer — tope de intentos de PIN', () => {
  const OLD_ENV = process.env.STAFF_PIN_PEPPER;
  beforeAll(() => { process.env.STAFF_PIN_PEPPER = PEPPER; });
  afterAll(() => { process.env.STAFF_PIN_PEPPER = OLD_ENV; });

  it('PIN que no corresponde a nadie: cuenta el fallo al usuario de la sesión', async () => {
    const { resolve, pinAttempts } = build({ employeePermissions: ['pos.cash:close'] });

    await expect(resolve('0000')).rejects.toThrow(ForbiddenException);

    expect(pinAttempts.registerFailure).toHaveBeenCalledWith('USER', USER);
    expect(pinAttempts.registerSuccess).not.toHaveBeenCalled();
  });

  it('PIN de un empleado SIN el permiso también cuenta como fallo (el mensaje no distingue)', async () => {
    const { resolve, pinAttempts } = build({ employeePermissions: ['otro:permiso'] });

    await expect(resolve(PIN)).rejects.toThrow(ForbiddenException);

    expect(pinAttempts.registerFailure).toHaveBeenCalledWith('USER', USER);
  });

  it('PIN de supervisor con el permiso: autoriza y limpia el contador', async () => {
    const { resolve, pinAttempts } = build({ employeePermissions: ['pos.cash:close'] });

    await expect(resolve(PIN)).resolves.toMatchObject({ id: 'emp-1' });

    expect(pinAttempts.registerSuccess).toHaveBeenCalledWith('USER', USER);
    expect(pinAttempts.registerFailure).not.toHaveBeenCalled();
  });

  it('usuario en espera: 429 y NO se evalúa el PIN, ni el correcto', async () => {
    const { resolve, prisma, pinAttempts } = build({ employeePermissions: ['pos.cash:close'], locked: true });

    await expect(resolve(PIN)).rejects.toBeInstanceOf(HttpException);

    expect(pinAttempts.assertNotLocked).toHaveBeenCalledWith('USER', USER);
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
    expect(pinAttempts.registerFailure).not.toHaveBeenCalled();
  });

  it('con el permiso propio no se toca el contador (y un usuario en espera sigue operando)', async () => {
    const { resolve, pinAttempts } = build({ userPermissions: ['pos.cash:close'], locked: true });

    await expect(resolve()).resolves.toBeNull();

    expect(pinAttempts.assertNotLocked).not.toHaveBeenCalled();
    expect(pinAttempts.registerFailure).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN no toca el contador', async () => {
    const { resolve, pinAttempts } = build({ userRole: 'SUPER_ADMIN' });

    await expect(resolve()).resolves.toBeNull();

    expect(pinAttempts.assertNotLocked).not.toHaveBeenCalled();
  });

  it('sin PIN se pide autorización y no se cuenta fallo (no se probó ningún PIN)', async () => {
    const { resolve, pinAttempts } = build();

    await expect(resolve()).rejects.toThrow(ForbiddenException);

    expect(pinAttempts.registerFailure).not.toHaveBeenCalled();
  });

  it('sin identidad de usuario: se rechaza y no se evalúa el PIN', async () => {
    const { resolve, prisma } = build({ userId: undefined, employeePermissions: ['pos.cash:close'] });

    await expect(resolve(PIN)).rejects.toThrow(ForbiddenException);

    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });
});
