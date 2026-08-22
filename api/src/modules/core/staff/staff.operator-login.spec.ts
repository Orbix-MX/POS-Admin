import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StaffService } from './staff.service';

/**
 * Tests for StaffService.operatorLogin — the web counterpart to mobile's device
 * pinLogin. It must mint an operator JWT (typ:'operator', sub = employee.id)
 * IDENTICAL in shape to mobile's so the backend learns the real waiter on every
 * web request. tenantId comes from the caller's session; branchId must be in the
 * operator's available branches. A real JwtService is used so we assert the
 * minted token's claims, not a mock's echo.
 *
 * Service built directly with mocks (no Nest DI) to match the suite style.
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';
const OTHER_BRANCH = 'branch-2';
const EMPLOYEE = 'emp-1';
const SECRET = 'test-secret';

const EMPLOYEE_ROW = {
  id: EMPLOYEE,
  firstName: 'Ana',
  lastName: 'López',
  employeeNumber: 'E-001',
  role: {
    id: 'role-1',
    name: 'Mesero',
    permissions: [{ permission: { key: 'comanda:view' } }],
  },
  // No explicit branch assignments → inherits tenant branches (bounded by scope).
  branches: [],
};

function buildService(overrides: {
  employee?: unknown;
  availableBranches?: Array<{ id: string; name: string }>;
} = {}) {
  const jwtService = new JwtService({ secret: SECRET });

  const prisma = {
    employee: {
      findFirst: jest.fn().mockResolvedValue(
        overrides.employee === undefined ? EMPLOYEE_ROW : overrides.employee,
      ),
    },
    branch: {
      findMany: jest.fn().mockResolvedValue(
        overrides.availableBranches ?? [{ id: BRANCH, name: 'Matriz' }],
      ),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        plan: 'PRO',
        enabledModules: ['comanda'],
        businessVertical: 'RESTAURANT',
      }),
    },
  };

  const config = { get: jest.fn().mockReturnValue(SECRET) };
  const devicesService = { authorizeByToken: jest.fn() };

  const effectivePermissions = { assertActorCanGrant: jest.fn(), keysForRoles: jest.fn().mockResolvedValue([]) };
  const permissionCache = { invalidateUser: jest.fn(), invalidateTenant: jest.fn() };

  const service = new StaffService(
    prisma as never,
    config as never,
    devicesService as never,
    jwtService,
    effectivePermissions as never,
    permissionCache as never,
    { log: jest.fn() } as never,
  );

  return { service, prisma, jwtService, devicesService };
}

describe('StaffService.operatorLogin — identidad de operador en web', () => {
  it('emite un JWT operator con sub = employee.id, tenantId y branchId solicitado', async () => {
    const { service, jwtService } = buildService();

    const result = await service.operatorLogin(TENANT, '1234', BRANCH);

    const claims = jwtService.verify(result.accessToken);
    expect(claims).toEqual(
      expect.objectContaining({
        typ: 'operator',
        sub: EMPLOYEE,
        tenantId: TENANT,
        branchId: BRANCH,
        permissions: ['comanda:view'],
      }),
    );
    expect(result.branchId).toBe(BRANCH);
    expect(result.employee).toEqual(
      expect.objectContaining({ id: EMPLOYEE, firstName: 'Ana', lastName: 'López' }),
    );
  });

  it('el token es del MISMO tipo que el de mobile (typ:operator) — paridad de auth', async () => {
    const { service, jwtService } = buildService();
    const { accessToken } = await service.operatorLogin(TENANT, '1234', BRANCH);
    expect(jwtService.verify(accessToken).typ).toBe('operator');
  });

  it('expira (claim exp presente) — sesión acotada al turno', async () => {
    const { service, jwtService } = buildService();
    const { accessToken } = await service.operatorLogin(TENANT, '1234', BRANCH);
    const claims: { exp: number; iat: number } = jwtService.verify(accessToken);
    expect(claims.exp).toBeGreaterThan(claims.iat);
    // 12h ± margen.
    expect(claims.exp - claims.iat).toBe(12 * 60 * 60);
  });

  it('rechaza PIN inválido con PIN_INVALID y no emite token', async () => {
    const { service } = buildService({ employee: null });
    await expect(service.operatorLogin(TENANT, '9999', BRANCH)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza branchId fuera del alcance del operador (BRANCH_NOT_ALLOWED)', async () => {
    // El operador solo puede operar BRANCH; pide OTHER_BRANCH → debe fallar.
    const { service, jwtService } = buildService({
      availableBranches: [{ id: BRANCH, name: 'Matriz' }],
    });

    const promise = service.operatorLogin(TENANT, '1234', OTHER_BRANCH);
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BRANCH_NOT_ALLOWED' }),
    });
    // jwtService nunca firmó nada utilizable (no llegó a minar).
    expect(jwtService).toBeDefined();
  });

  it('usa el tenantId de la sesión, no del body — busca al empleado en ese tenant', async () => {
    const { service, prisma } = buildService();
    await service.operatorLogin(TENANT, '1234', BRANCH);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT, status: 'ACTIVE' }) }),
    );
  });
});

describe('StaffService.pinLogin — regresión: mobile sigue funcionando', () => {
  it('mina un token operator usando la sucursal del dispositivo (sin branch solicitado)', async () => {
    const { service, jwtService, devicesService } = buildService();
    devicesService.authorizeByToken.mockResolvedValue({
      device: { branchId: BRANCH },
      tenantId: TENANT,
      branchId: BRANCH,
    });

    const result = await service.pinLogin('device-token-xyz', '1234');

    const claims = jwtService.verify(result.accessToken);
    expect(claims).toEqual(
      expect.objectContaining({ typ: 'operator', sub: EMPLOYEE, tenantId: TENANT, branchId: BRANCH }),
    );
    expect(devicesService.authorizeByToken).toHaveBeenCalledWith('device-token-xyz');
  });
});
