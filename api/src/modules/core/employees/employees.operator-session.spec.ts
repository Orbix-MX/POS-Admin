import { EmployeesService } from './employees.service';

/**
 * @odd acceso-residual-tras-baja T-002
 * Dar de baja o cambiar el estado de un empleado debe descartar el veredicto en caché de su token
 * de operador: sin esto, la baja tarda hasta 30 s en notarse en la misma instancia.
 */

const TENANT = 'tenant-1';

function build() {
  const employee = { id: 'emp-1', tenantId: TENANT, status: 'ACTIVE', userId: null, pinHash: null, email: 'a@b.c', employeeNumber: 'E1' };
  const prisma = {
    employee: {
      findFirst: jest.fn().mockResolvedValue(employee),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...employee, ...data }),
      ),
    },
  };
  const operatorSession = { invalidate: jest.fn() };
  const service = new EmployeesService(
    prisma as never,
    { requireTenantId: () => TENANT } as never,
    { getUserId: () => 'actor' } as never,
    { log: jest.fn() } as never,
    {} as never,
    {} as never,
    operatorSession as never,
  );
  return { service, prisma, operatorSession };
}

describe('EmployeesService — invalida la sesión de operador al cambiar el estado', () => {
  it('remove (baja) invalida el veredicto del empleado', async () => {
    const { service, operatorSession } = build();

    await service.remove('emp-1');

    expect(operatorSession.invalidate).toHaveBeenCalledWith(TENANT, 'emp-1');
  });

  it('update invalida el veredicto del empleado (el estado pudo cambiar)', async () => {
    const { service, operatorSession } = build();

    await service.update('emp-1', { status: 'SUSPENDED' } as never);

    expect(operatorSession.invalidate).toHaveBeenCalledWith(TENANT, 'emp-1');
  });

  it('empleado de otra empresa: 404 y no invalida nada', async () => {
    const { service, prisma, operatorSession } = build();
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(service.remove('emp-ajeno')).rejects.toThrow('Employee not found');
    expect(operatorSession.invalidate).not.toHaveBeenCalled();
  });
});
