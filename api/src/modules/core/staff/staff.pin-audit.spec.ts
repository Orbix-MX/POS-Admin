import { JwtService } from '@nestjs/jwt';
import { StaffService } from './staff.service';

/**
 * Auditoría de los PIN operativos.
 *
 * Asignar un PIN crea una credencial y puede además darle un rol al empleado,
 * así que tiene que quedar registrado. Pero el registro no debe convertirse en
 * una fuga: ni el PIN en claro ni su hash pueden acabar en `audit_logs`, que se
 * consulta con muchos menos privilegios que los que protegen la tabla de
 * empleados.
 */

const TENANT = 'tenant-1';
const EMPLOYEE = 'emp-1';
const PIN = '4321';

function buildService() {
  const employee = { id: EMPLOYEE, tenantId: TENANT, roleId: null, pinHash: null };

  const prisma = {
    employee: {
      findFirst: jest.fn().mockResolvedValue(employee),
      update: jest.fn().mockResolvedValue({ ...employee, pinHash: 'hash' }),
    },
    role: { findFirst: jest.fn().mockResolvedValue({ id: 'role-1' }) },
  };

  const audit = { log: jest.fn() };
  const permissionCache = { invalidateUser: jest.fn(), invalidateTenant: jest.fn() };
  const effectivePermissions = {
    assertActorCanGrant: jest.fn(),
    keysForRoles: jest.fn().mockResolvedValue([]),
  };

  const service = new StaffService(
    prisma as never,
    { get: jest.fn().mockReturnValue('secret') } as never,
    { authorizeByToken: jest.fn() } as never,
    new JwtService({ secret: 'secret' }),
    effectivePermissions as never,
    permissionCache as never,
    audit as never,
  );

  return { service, audit, prisma, effectivePermissions };
}

/** Serializa la entrada de auditoría para buscar secretos dentro. */
function serialized(audit: { log: jest.Mock }): string {
  return JSON.stringify(audit.log.mock.calls);
}

describe('StaffService — auditoría de PIN', () => {
  it('registra la asignación del PIN', async () => {
    const { service, audit } = buildService();

    await service.assignPin(TENANT, EMPLOYEE, PIN);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_PIN_ASSIGN', entityId: EMPLOYEE }),
    );
  });

  it('NUNCA registra el PIN en claro ni su hash', async () => {
    const { service, audit, prisma } = buildService();

    await service.assignPin(TENANT, EMPLOYEE, PIN);

    const entry = serialized(audit);
    expect(entry).not.toContain(PIN);

    // El hash que se escribió en la base tampoco debe aparecer en el log.
    const written = prisma.employee.update.mock.calls[0][0].data.pinHash as string;
    expect(written).toBeTruthy();
    expect(entry).not.toContain(written);
  });

  it('registra el rol que acompaña al PIN, porque es un otorgamiento de permisos', async () => {
    const { service, audit } = buildService();

    await service.assignPin(TENANT, EMPLOYEE, PIN, 'role-1');

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMPLOYEE_PIN_ASSIGN',
        after: expect.objectContaining({ roleId: 'role-1' }),
      }),
    );
  });

  it('el rol que acompaña al PIN pasa por el control anti-escalación', async () => {
    const { service, effectivePermissions } = buildService();

    await service.assignPin(TENANT, EMPLOYEE, PIN, 'role-1');

    expect(effectivePermissions.assertActorCanGrant).toHaveBeenCalled();
  });

  it('registra el borrado del PIN', async () => {
    const { service, audit } = buildService();

    await service.clearPin(TENANT, EMPLOYEE);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_PIN_CLEAR', entityId: EMPLOYEE }),
    );
  });
});
