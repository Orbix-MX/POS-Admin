import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { PasswordUtil } from '../../../common/utils/password.util';

/**
 * Vínculo entre un empleado y su cuenta de back-office.
 *
 * Dos caminos excluyentes en el alta: vincular una cuenta existente, o crear una
 * nueva. La asimetría es deliberada: dar de alta un empleado puede crear su
 * cuenta, pero dar de alta un usuario nunca crea un expediente de empleado —
 * no todo el que entra al panel es personal de nómina.
 */

const TENANT = 'tenant-1';
const OTHER_TENANT_USER = 'user-de-otra-empresa';
const MEMBER = 'user-miembro';

const BASE_DTO = {
  employeeNumber: 'E-001',
  firstName: 'Ana',
  lastName: 'López',
  email: 'ana@empresa.com',
};

function buildService(opts: {
  actorHasUsersCreate?: boolean;
  membershipExists?: boolean;
  alreadyLinkedTo?: { id: string; firstName: string; lastName: string } | null;
  existingUserWithEmail?: boolean;
} = {}) {
  const prisma = {
    employee: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(opts.alreadyLinkedTo ?? null),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'emp-1', pinHash: null, ...data }),
      ),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(opts.existingUserWithEmail ? { id: 'u-existente' } : null),
      create: jest.fn().mockResolvedValue({ id: 'u-nuevo', email: BASE_DTO.email, role: 'STAFF' }),
    },
    tenantMembership: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.membershipExists === false ? null : { userId: MEMBER }),
    },
  };

  const effectivePermissions = {
    actorHas: jest.fn().mockResolvedValue(opts.actorHasUsersCreate ?? true),
  };
  const planLimits = { assertCanAddActiveUser: jest.fn() };
  const audit = { log: jest.fn() };

  const service = new EmployeesService(
    prisma as never,
    { requireTenantId: () => TENANT } as never,
    { getUserId: () => 'actor' } as never,
    audit as never,
    effectivePermissions as never,
    planLimits as never,
  );

  return { service, prisma, effectivePermissions, planLimits, audit };
}

describe('EmployeesService.create — crear cuenta junto al empleado', () => {
  afterEach(() => jest.restoreAllMocks());

  it('crea la cuenta y la deja vinculada al empleado', async () => {
    const { service, prisma } = buildService();
    jest.spyOn(PasswordUtil, 'hash').mockResolvedValue('hash');

    await service.create({
      ...BASE_DTO,
      createUserAccount: true,
      userPassword: 'Tormenta7Azul',
    } as never);

    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u-nuevo' }) }),
    );
  });

  it('la cuenta nueva usa el correo del empleado, para que no diverjan', async () => {
    const { service, prisma } = buildService();
    jest.spyOn(PasswordUtil, 'hash').mockResolvedValue('hash');

    await service.create({
      ...BASE_DTO,
      createUserAccount: true,
      userPassword: 'Tormenta7Azul',
    } as never);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: BASE_DTO.email }) }),
    );
  });

  it('la cuenta nace SIN permisos: alguien con roles:edit los concede aparte', async () => {
    const { service, prisma } = buildService();
    jest.spyOn(PasswordUtil, 'hash').mockResolvedValue('hash');

    await service.create({
      ...BASE_DTO,
      createUserAccount: true,
      userPassword: 'Tormenta7Azul',
    } as never);

    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.roleAssignments).toBeUndefined();
    expect(data.role).toBe('STAFF');
  });

  it('exige users:create: employees:create no puede ser una puerta lateral', async () => {
    const { service, prisma } = buildService({ actorHasUsersCreate: false });

    await expect(
      service.create({
        ...BASE_DTO,
        createUserAccount: true,
        userPassword: 'Tormenta7Azul',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.employee.create).not.toHaveBeenCalled();
  });

  it('exige contraseña inicial si se pide crear la cuenta', async () => {
    const { service } = buildService();

    await expect(
      service.create({ ...BASE_DTO, createUserAccount: true } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('respeta el cupo de usuarios del plan', async () => {
    const { service, planLimits } = buildService();
    jest.spyOn(PasswordUtil, 'hash').mockResolvedValue('hash');

    await service.create({
      ...BASE_DTO,
      createUserAccount: true,
      userPassword: 'Tormenta7Azul',
    } as never);

    expect(planLimits.assertCanAddActiveUser).toHaveBeenCalledWith(TENANT);
  });

  it('rechaza si ya existe una cuenta con ese correo', async () => {
    const { service } = buildService({ existingUserWithEmail: true });

    await expect(
      service.create({
        ...BASE_DTO,
        createUserAccount: true,
        userPassword: 'Tormenta7Azul',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('no permite pedir las dos cosas a la vez', async () => {
    const { service } = buildService();

    await expect(
      service.create({
        ...BASE_DTO,
        userId: MEMBER,
        createUserAccount: true,
        userPassword: 'Tormenta7Azul',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sin ninguna de las dos opciones, el empleado queda sin cuenta', async () => {
    const { service, prisma } = buildService();

    await service.create({ ...BASE_DTO } as never);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: null }) }),
    );
  });
});

describe('EmployeesService.create — vincular una cuenta existente', () => {
  it('vincula una cuenta que es miembro del tenant', async () => {
    const { service, prisma } = buildService();

    await service.create({ ...BASE_DTO, userId: MEMBER } as never);

    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: MEMBER }) }),
    );
  });

  it('rechaza una cuenta de OTRA empresa (IDOR)', async () => {
    const { service, prisma } = buildService({ membershipExists: false });

    await expect(
      service.create({ ...BASE_DTO, userId: OTHER_TENANT_USER } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.employee.create).not.toHaveBeenCalled();
  });

  it('rechaza una cuenta ya vinculada a otro empleado', async () => {
    const { service } = buildService({
      alreadyLinkedTo: { id: 'emp-9', firstName: 'Luis', lastName: 'Pérez' },
    });

    await expect(
      service.create({ ...BASE_DTO, userId: MEMBER } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
