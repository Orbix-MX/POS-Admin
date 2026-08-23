import { BadRequestException } from '@nestjs/common';
import { RolesService } from './roles.service';

/**
 * Invalidación del caché de permisos al tocar un rol.
 *
 * Cambiar los permisos de un rol afecta a todos los usuarios que lo tienen, así
 * que se invalida el tenant entero. Sin esta llamada, un permiso quitado a un
 * rol seguiría concediendo acceso hasta que expire el TTL de 60 s.
 */

const TENANT = 'tenant-1';
const ROLE = 'role-1';

function buildService(overrides: { isSystem?: boolean } = {}) {
  const role = { id: ROLE, tenantId: TENANT, name: 'Vendedor', isSystem: overrides.isSystem ?? false };

  const prisma = {
    role: {
      findFirst: jest.fn().mockResolvedValue(role),
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(role),
      update: jest.fn().mockResolvedValue(role),
    },
    rolePermission: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockResolvedValue([]),
  };

  const permissionCache = { invalidateUser: jest.fn(), invalidateTenant: jest.fn() };
  const audit = { log: jest.fn() };
  // Siempre queda un administrador salvo que un test diga lo contrario.
  const effectivePermissions = { countAdmins: jest.fn().mockResolvedValue(1) };

  const service = new RolesService(
    prisma as never,
    { requireTenantId: () => TENANT } as never,
    permissionCache as never,
    audit as never,
    effectivePermissions as never,
  );

  return { service, prisma, permissionCache, audit, effectivePermissions };
}

describe('RolesService — invalidación del caché de permisos', () => {
  it('setPermissions invalida el tenant completo', async () => {
    const { service, permissionCache } = buildService();

    await service.setPermissions(ROLE, ['perm-1']);

    expect(permissionCache.invalidateTenant).toHaveBeenCalledWith(TENANT);
  });

  it('eliminar un rol invalida el tenant completo', async () => {
    const { service, permissionCache } = buildService();

    await service.remove(ROLE);

    expect(permissionCache.invalidateTenant).toHaveBeenCalledWith(TENANT);
  });

  it('no invalida si la operación fue rechazada', async () => {
    const { service, permissionCache } = buildService({ isSystem: true });

    // Vaciar por completo un rol de sistema está prohibido.
    await expect(service.setPermissions(ROLE, [])).rejects.toBeInstanceOf(BadRequestException);

    expect(permissionCache.invalidateTenant).not.toHaveBeenCalled();
  });
});

describe('RolesService — auditoría', () => {
  it('registra el cambio de permisos con el antes y el después', async () => {
    const { service, prisma, audit } = buildService();
    prisma.rolePermission.findMany = jest
      .fn()
      .mockResolvedValue([{ permissionId: 'perm-viejo' }]);

    await service.setPermissions(ROLE, ['perm-nuevo']);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ROLE_PERMISSIONS_CHANGE',
        entityId: ROLE,
        before: { permissionIds: ['perm-viejo'] },
        after: { permissionIds: ['perm-nuevo'] },
      }),
    );
  });

  it('registra la eliminación del rol', async () => {
    const { service, audit } = buildService();

    await service.remove(ROLE);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ROLE_DELETE', entityId: ROLE }),
    );
  });
});

describe('RolesService — protecciones de roles de sistema (regresión)', () => {
  it('no se puede eliminar un rol de sistema', async () => {
    const { service } = buildService({ isSystem: true });

    await expect(service.remove(ROLE)).rejects.toBeInstanceOf(BadRequestException);
  });
});
