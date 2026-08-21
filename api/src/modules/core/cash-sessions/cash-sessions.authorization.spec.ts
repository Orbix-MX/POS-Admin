import { ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';

import { CashSessionsService } from './cash-sessions.service';

/**
 * Autorización por PIN de arqueo y corte desde el POS.
 *
 * El cajero no siempre puede cerrar su propia caja. Cuando no tiene el permiso,
 * la operación exige el PIN de un empleado cuyo rol sí lo tenga: el supervisor
 * se acerca, teclea su PIN y nadie comparte contraseñas en el mostrador.
 */

const TENANT = 'tenant-1';
const PEPPER = 'test-pepper';
const PIN = '4821';

const hash = (pin: string) => createHash('sha256').update(`${TENANT}:${pin}:${PEPPER}`).digest('hex');

interface Opts {
  /** Permisos del usuario de la sesión. */
  userPermissions?: string[];
  userRole?: string;
  /** Empleado que responde al PIN correcto, con los permisos de su rol. */
  employee?: { permissions: string[] } | null;
}

function build({ userPermissions = [], userRole = 'STAFF', employee = null }: Opts = {}) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ role: userRole }) },
    userRoleAssignment: {
      findMany: jest.fn().mockResolvedValue([
        {
          role: {
            permissions: userPermissions.map((key) => ({ permission: { key } })),
          },
        },
      ]),
    },
    userPermissionGrant: { findMany: jest.fn().mockResolvedValue([]) },
    employee: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: { pinHash: string } }) =>
        Promise.resolve(
          employee && where.pinHash === hash(PIN)
            ? {
                id: 'emp-1',
                firstName: 'Ana',
                lastName: 'Ruiz',
                role: { permissions: employee.permissions.map((key) => ({ permission: { key } })) },
              }
            : null,
        ),
      ),
    },
  };

  const service = new CashSessionsService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => null } as never,
    { getUserId: () => 'user-1' } as never,
    { log: jest.fn() } as never,
    { assertCanOpenCashSession: jest.fn(), getCashSessionCapacity: jest.fn() } as never,
    { get: () => 'irrelevante' } as never,
  );

  // `resolveCashAuthorizer` es privado: se ejerce por su superficie real.
  const resolve = (permission: string, pin?: string) =>
    (service as unknown as {
      resolveCashAuthorizer: (t: string, p: string, pin?: string) => Promise<unknown>
    }).resolveCashAuthorizer(TENANT, permission, pin);

  return { resolve, prisma };
}

describe('resolveCashAuthorizer — PIN de supervisor para arqueo y corte', () => {
  const OLD_ENV = process.env.STAFF_PIN_PEPPER;
  beforeAll(() => {
    process.env.STAFF_PIN_PEPPER = PEPPER;
  });
  afterAll(() => {
    process.env.STAFF_PIN_PEPPER = OLD_ENV;
  });

  it('el usuario con el permiso opera sin PIN y la operación va a su nombre', async () => {
    const { resolve, prisma } = build({ userPermissions: ['pos.cash:close'] });

    await expect(resolve('pos.cash:close')).resolves.toBeNull();
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN no necesita PIN ni que le miren los permisos', async () => {
    const { resolve, prisma } = build({ userRole: 'SUPER_ADMIN' });

    await expect(resolve('pos.cash:close')).resolves.toBeNull();
    expect(prisma.userRoleAssignment.findMany).not.toHaveBeenCalled();
  });

  it('sin permiso y sin PIN se pide autorización en vez de ejecutar', async () => {
    const { resolve } = build();

    await expect(resolve('pos.cash:close')).rejects.toThrow(ForbiddenException);
  });

  it('el PIN de un supervisor con el permiso autoriza y queda identificado', async () => {
    const { resolve } = build({ employee: { permissions: ['pos.cash:close'] } });

    await expect(resolve('pos.cash:close', PIN)).resolves.toEqual({
      id: 'emp-1',
      firstName: 'Ana',
      lastName: 'Ruiz',
    });
  });

  it('un PIN válido cuyo rol NO tiene el permiso no autoriza', async () => {
    const { resolve } = build({ employee: { permissions: ['comanda:view'] } });

    await expect(resolve('pos.cash:close', PIN)).rejects.toThrow(ForbiddenException);
  });

  it('un PIN inexistente no autoriza', async () => {
    const { resolve } = build({ employee: { permissions: ['pos.cash:close'] } });

    await expect(resolve('pos.cash:close', '0000')).rejects.toThrow(ForbiddenException);
  });

  it('el permiso de arqueo no sirve para cortar: cada operación pide el suyo', async () => {
    const { resolve } = build({ userPermissions: ['pos.cash:count'] });

    await expect(resolve('pos.cash:count')).resolves.toBeNull();
    await expect(resolve('pos.cash:close')).rejects.toThrow(ForbiddenException);
  });
});
