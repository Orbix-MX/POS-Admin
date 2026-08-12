import { NotFoundException } from '@nestjs/common';
import { DiningOrdersService } from './dining-orders.service';

/**
 * Identidad del mesero en open(): el operador autenticado es la ÚNICA fuente de
 * verdad. Con token operador, `waiterId` proviene exclusivamente del token y se
 * ignora cualquier `dto.waiterId` del cliente — un operador no puede atribuir una
 * cuenta a otro empleado. Con sesión de usuario (sin operador) se conserva la ruta
 * legacy (waiter explícito del cliente). Servicio construido con mocks directos.
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';
const OPERATOR_EMP = 'emp-operator';   // empleado real del token operador
const ATTACKER_EMP = 'emp-otro';       // waiterId falso enviado por el cliente
const USER_ID = 'user-1';              // sesión de usuario (no operador)

interface BuildOpts {
  isOperator: boolean;
  tokenUserId?: string;
  /** true: employee.findFirst resuelve (operador/mesero válido). false: null (inválido). */
  employeeValid?: boolean;
}

function build({ isOperator, tokenUserId, employeeValid = true }: BuildOpts) {
  const create = jest.fn((args: { data: Record<string, unknown> }) => ({
    id: 'do-1',
    ...args.data,
  }));

  // employee.findFirst: eco del id consultado si es válido; null si inválido.
  const employeeFindFirst = jest.fn((args: { where: { id: string } }) =>
    Promise.resolve(employeeValid ? { id: args.where.id } : null),
  );

  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: BRANCH }) }, // assertBranchBelongs
    employee: { findFirst: employeeFindFirst },
    diningOrder: { create },
  };

  const service = new DiningOrdersService(
    prisma as never,
    { requireTenantId: () => TENANT } as never,
    { getUserId: () => tokenUserId, isOperator: () => isOperator } as never,
    { consume: jest.fn(), restore: jest.fn(), validate: jest.fn() } as never,
    { resolveActiveCashSession: jest.fn(), createPayments: jest.fn(), createCashMovements: jest.fn() } as never,
    { resolveRestaurantVisibilityMode: jest.fn().mockResolvedValue('SHARED'), assertCanAccessOrder: jest.fn().mockResolvedValue(undefined) } as never,
  );

  return { service, prisma, create, employeeFindFirst };
}

/** Lee el waiterId con el que se creó la DiningOrder. */
function createdWaiterId(create: jest.Mock): unknown {
  return create.mock.calls[0][0].data.waiterId;
}

const counter = { serviceType: 'COUNTER' as const, reference: 'Mostrador' };

describe('DiningOrdersService.open — identidad del mesero', () => {
  it('operador abre orden: waiterId proviene del token', async () => {
    const { service, create, employeeFindFirst } = build({ isOperator: true, tokenUserId: OPERATOR_EMP });

    await service.open(BRANCH, counter);

    // El empleado se busca por el id del token, y la cuenta se atribuye a él.
    expect(employeeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: OPERATOR_EMP, tenantId: TENANT, status: 'ACTIVE' }) }),
    );
    expect(createdWaiterId(create)).toBe(OPERATOR_EMP);
  });

  it('waiterId falso en body: se IGNORA, gana el token', async () => {
    const dto = { ...counter, waiterId: ATTACKER_EMP };
    const { service, create, employeeFindFirst } = build({ isOperator: true, tokenUserId: OPERATOR_EMP });

    await service.open(BRANCH, dto);

    // Nunca se consulta ni se usa el id del atacante.
    expect(employeeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: OPERATOR_EMP }) }),
    );
    expect(createdWaiterId(create)).toBe(OPERATOR_EMP);
    expect(createdWaiterId(create)).not.toBe(ATTACKER_EMP);
  });

  it('waiterId omitido (operador): usa el token sin requerir el body', async () => {
    const { service, create } = build({ isOperator: true, tokenUserId: OPERATOR_EMP });

    await service.open(BRANCH, counter);

    expect(createdWaiterId(create)).toBe(OPERATOR_EMP);
  });

  it('operador inválido (empleado inexistente/inactivo): NotFound, no crea cuenta', async () => {
    const { service, create } = build({ isOperator: true, tokenUserId: OPERATOR_EMP, employeeValid: false });

    await expect(service.open(BRANCH, counter)).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('compat: sesión de usuario (no operador) conserva el waiter explícito del cliente', async () => {
    const dto = { ...counter, waiterId: ATTACKER_EMP };
    const { service, create } = build({ isOperator: false, tokenUserId: USER_ID });

    await service.open(BRANCH, dto);

    // Sin token operador, el waiter del body sigue siendo válido (web legacy).
    expect(createdWaiterId(create)).toBe(ATTACKER_EMP);
  });
});
