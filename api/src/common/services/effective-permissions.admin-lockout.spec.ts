import { BadRequestException } from '@nestjs/common';
import { EffectivePermissionsService } from './effective-permissions.service';
import { PermissionCacheService } from '../cache/permission-cache.service';
import { InMemoryPermissionCacheStore } from '../cache/permission-cache.store';

/**
 * Protección de "último administrador".
 *
 * Nada impedía dejar una empresa sin nadie capaz de administrarla: la única
 * protección era sobre el propietario, y ni siquiera cubría quitarle todos sus
 * permisos. Un admin podía degradarse a sí mismo y dejar el tenant bloqueado sin
 * forma de recuperarlo desde la propia aplicación.
 *
 * Cuenta como administrador quien tenga `users:edit` y `roles:edit` — con ambos
 * se puede volver a repartir acceso.
 */

const TENANT = 'tenant-1';

const PERM = (key: string) => ({ permission: { key } });

/** Construye una membresía ACTIVE con los permisos dados vía rol. */
function member(userId: string, permissionKeys: string[], role = 'STAFF') {
  return {
    userId,
    user: {
      role,
      roleAssignments: [{ role: { permissions: permissionKeys.map(PERM) } }],
      permissionGrants: [],
    },
  };
}

interface MembershipRow {
  userId: string;
  user: {
    role: string;
    roleAssignments: Array<{ role: { permissions: Array<{ permission: { key: string } }> } }>;
    permissionGrants: Array<{ granted: boolean; permission: { key: string } }>;
  };
}

function buildService(memberships: MembershipRow[]) {
  const prisma = {
    tenantMembership: {
      // Respeta el `userId: { not }` como haría Prisma: si el mock lo ignorara,
      // el test de exclusión pasaría sin comprobar nada.
      findMany: jest.fn().mockImplementation(({ where }: { where?: { userId?: { not?: string } } } = {}) => {
        const excluded = where?.userId?.not;
        return Promise.resolve(
          excluded ? memberships.filter((m) => m.userId !== excluded) : memberships,
        );
      }),
    },
  };

  const service = new EffectivePermissionsService(
    prisma as never,
    { getUserId: () => 'actor', isOperator: () => false } as never,
    { requireTenantId: () => TENANT } as never,
    new PermissionCacheService(new InMemoryPermissionCacheStore()),
  );

  return { service, prisma };
}

describe('EffectivePermissionsService.countAdmins', () => {
  it('cuenta a quien tiene users:edit y roles:edit', async () => {
    const { service } = buildService([member('u1', ['users:edit', 'roles:edit'])]);

    await expect(service.countAdmins(TENANT)).resolves.toBe(1);
  });

  it('NO cuenta a quien solo tiene uno de los dos', async () => {
    const { service } = buildService([
      member('u1', ['users:edit']),
      member('u2', ['roles:edit']),
    ]);

    await expect(service.countAdmins(TENANT)).resolves.toBe(0);
  });

  it('cuenta a un SUPER_ADMIN aunque su rol no traiga permisos', async () => {
    const { service } = buildService([member('u1', [], 'SUPER_ADMIN')]);

    await expect(service.countAdmins(TENANT)).resolves.toBe(1);
  });

  it('un revoke individual le quita la condición de administrador', async () => {
    const { service } = buildService([
      {
        userId: 'u1',
        user: {
          role: 'STAFF',
          roleAssignments: [{ role: { permissions: [PERM('users:edit'), PERM('roles:edit')] } }],
          permissionGrants: [{ granted: false, permission: { key: 'roles:edit' } }],
        },
      },
    ]);

    await expect(service.countAdmins(TENANT)).resolves.toBe(0);
  });

  it('un grant individual puede convertir a alguien en administrador', async () => {
    const { service } = buildService([
      {
        userId: 'u1',
        user: {
          role: 'STAFF',
          roleAssignments: [{ role: { permissions: [PERM('users:edit')] } }],
          permissionGrants: [{ granted: true, permission: { key: 'roles:edit' } }],
        },
      },
    ]);

    await expect(service.countAdmins(TENANT)).resolves.toBe(1);
  });

  it('excluye al usuario indicado (el que está a punto de perder el acceso)', async () => {
    const { service } = buildService([member('u1', ['users:edit', 'roles:edit'])]);

    await expect(service.countAdmins(TENANT, 'u1')).resolves.toBe(0);
  });

  it('solo mira miembros ACTIVE', async () => {
    const { service, prisma } = buildService([]);

    await service.countAdmins(TENANT);

    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT, status: 'ACTIVE' }),
      }),
    );
  });
});

describe('EffectivePermissionsService.assertTenantKeepsAnAdmin', () => {
  it('deja pasar mientras quede al menos un administrador', async () => {
    const { service } = buildService([
      member('u1', ['users:edit', 'roles:edit']),
      member('u2', ['users:edit', 'roles:edit']),
    ]);

    await expect(service.assertTenantKeepsAnAdmin(TENANT, 'u1')).resolves.toBeUndefined();
  });

  it('rechaza cuando el cambio dejaría a la empresa sin administrador', async () => {
    const { service } = buildService([member('u1', ['users:edit', 'roles:edit'])]);

    await expect(service.assertTenantKeepsAnAdmin(TENANT, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
