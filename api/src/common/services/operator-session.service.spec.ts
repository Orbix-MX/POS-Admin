import { OPERATOR_STATUS_TTL_MS, OperatorSessionService } from './operator-session.service';

/** @odd acceso-residual-tras-baja T-002 */

function build(row: { status: string; tenant: { status: string } } | null) {
  const prisma = { employee: { findFirst: jest.fn().mockResolvedValue(row) } };
  return { service: new OperatorSessionService(prisma as never), prisma };
}

describe('OperatorSessionService', () => {
  afterEach(() => jest.useRealTimers());

  it.each([
    ['ACTIVE', 'ACTIVE', true],
    ['ACTIVE', 'TRIAL', true],
    ['INACTIVE', 'ACTIVE', false],
    ['SUSPENDED', 'ACTIVE', false],
    ['ON_LEAVE', 'ACTIVE', false],
    ['ACTIVE', 'SUSPENDED', false],
  ])('empleado %s en empresa %s -> %s', async (employee, tenant, expected) => {
    const { service } = build({ status: employee, tenant: { status: tenant } });
    await expect(service.isActive('t1', 'e1')).resolves.toBe(expected);
  });

  it('empleado inexistente (o de otra empresa): no activo', async () => {
    const { service, prisma } = build(null);
    await expect(service.isActive('t1', 'e1')).resolves.toBe(false);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'e1', tenantId: 't1' } }),
    );
  });

  it('cachea: una venta tras otra no repite la consulta dentro del TTL', async () => {
    const { service, prisma } = build({ status: 'ACTIVE', tenant: { status: 'ACTIVE' } });
    await service.isActive('t1', 'e1');
    await service.isActive('t1', 'e1');
    await service.isActive('t1', 'e1');
    expect(prisma.employee.findFirst).toHaveBeenCalledTimes(1);
  });

  it('invalidate: la baja se nota en la siguiente petición, sin esperar al TTL', async () => {
    const { service, prisma } = build({ status: 'ACTIVE', tenant: { status: 'ACTIVE' } });
    await expect(service.isActive('t1', 'e1')).resolves.toBe(true);
    prisma.employee.findFirst.mockResolvedValue({ status: 'INACTIVE', tenant: { status: 'ACTIVE' } });
    service.invalidate('t1', 'e1');
    await expect(service.isActive('t1', 'e1')).resolves.toBe(false);
  });

  it('otra instancia que no invalidó se entera al vencer el TTL (límite aceptado de 30 s)', async () => {
    jest.useFakeTimers();
    const { service, prisma } = build({ status: 'ACTIVE', tenant: { status: 'ACTIVE' } });
    await service.isActive('t1', 'e1');
    prisma.employee.findFirst.mockResolvedValue({ status: 'INACTIVE', tenant: { status: 'ACTIVE' } });
    jest.advanceTimersByTime(OPERATOR_STATUS_TTL_MS - 1);
    await expect(service.isActive('t1', 'e1')).resolves.toBe(true);
    jest.advanceTimersByTime(2);
    await expect(service.isActive('t1', 'e1')).resolves.toBe(false);
  });
});
