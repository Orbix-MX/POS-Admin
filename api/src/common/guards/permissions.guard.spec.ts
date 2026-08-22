import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

/**
 * FASE 0 — Tests de `PermissionsGuard`.
 *
 * Los `it.failing()` describen el comportamiento CORRECTO y fallan hoy a
 * propósito: documentan una vulnerabilidad abierta. Cuando la corrección
 * aterrice, Jest reportará "Failing test passed unexpectedly" → quitar el
 * `.failing` y el test queda como regresión.
 *
 * Vulnerabilidades cubiertas:
 *  1. FAIL-OPEN: si un handler no declara `@RequirePermissions`, el guard
 *     concede acceso a cualquier usuario autenticado. Un olvido del decorador
 *     abre el endpoint en silencio (así quedó abierto `StaffController`).
 *  2. CACHÉ SIN INVALIDACIÓN: los permisos efectivos se cachean 60 s sin que
 *     ningún cambio de rol/grant lo limpie → un permiso revocado sigue
 *     concediendo acceso hasta un minuto. Odoo invalida su caché de forma
 *     síncrona al escribir `groups_id`; aquí no hay equivalente.
 */

const USER_ID = 'user-1';
const TENANT = 'tenant-1';

type PrismaStub = {
  userRoleAssignment: { findMany: jest.Mock };
  userPermissionGrant: { findMany: jest.Mock };
};

/** Construye un ExecutionContext con el `user` y la metadata de permisos dados. */
function buildContext(user: unknown, requiredPermissions?: string[]): ExecutionContext {
  const handler = () => undefined;
  if (requiredPermissions) {
    Reflect.defineMetadata(PERMISSIONS_KEY, requiredPermissions, handler);
  }

  return {
    getHandler: () => handler,
    getClass: () => class Anon {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function buildGuard(permissionKeys: string[]) {
  const prisma: PrismaStub = {
    userRoleAssignment: {
      findMany: jest.fn().mockResolvedValue([
        {
          role: { permissions: permissionKeys.map((key) => ({ permission: { key } })) },
        },
      ]),
    },
    userPermissionGrant: { findMany: jest.fn().mockResolvedValue([]) },
  };

  const guard = new PermissionsGuard(new Reflector(), prisma as never);
  return { guard, prisma };
}

describe('PermissionsGuard — fail-open cuando falta el decorador', () => {
  it.failing(
    'un handler SIN @RequirePermissions debe denegar por defecto (fail-closed)',
    async () => {
      const { guard } = buildGuard([]);
      const context = buildContext({ id: USER_ID, role: 'STAFF', tenantId: TENANT });

      // Hoy devuelve true: cualquier usuario autenticado entra a un endpoint al
      // que se le olvidó poner el decorador.
      await expect(guard.canActivate(context)).resolves.toBe(false);
    },
  );

  it('deniega cuando no hay usuario en el request', async () => {
    const { guard } = buildGuard([]);
    const context = buildContext(undefined, ['users:view']);

    await expect(guard.canActivate(context)).resolves.toBe(false);
  });

  it('deniega a un usuario sin tenantId en el JWT', async () => {
    const { guard } = buildGuard(['users:view']);
    const context = buildContext({ id: USER_ID, role: 'STAFF' }, ['users:view']);

    await expect(guard.canActivate(context)).resolves.toBe(false);
  });
});

describe('PermissionsGuard — comportamiento vigente que no debe romperse', () => {
  it('SUPER_ADMIN bypasea toda verificación', async () => {
    const { guard, prisma } = buildGuard([]);
    const context = buildContext({ id: USER_ID, role: 'SUPER_ADMIN', tenantId: TENANT }, ['users:delete']);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    // Ni siquiera consulta la base.
    expect(prisma.userRoleAssignment.findMany).not.toHaveBeenCalled();
  });

  it('concede cuando el usuario tiene el permiso exigido', async () => {
    const { guard } = buildGuard(['users:view']);
    const context = buildContext({ id: USER_ID, role: 'STAFF', tenantId: TENANT }, ['users:view']);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('deniega cuando le falta el permiso exigido', async () => {
    const { guard } = buildGuard(['users:view']);
    const context = buildContext({ id: USER_ID, role: 'STAFF', tenantId: TENANT }, ['users:delete']);

    await expect(guard.canActivate(context)).resolves.toBe(false);
  });

  it('soporta grupos OR con `|` (basta uno de los permisos)', async () => {
    const { guard } = buildGuard(['pos:access']);
    const context = buildContext({ id: USER_ID, role: 'STAFF', tenantId: TENANT }, ['users:view|pos:access']);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('DEVICE_OPERATOR resuelve permisos desde el JWT, sin consultar la base', async () => {
    const { guard, prisma } = buildGuard([]);
    const context = buildContext(
      { id: 'emp-1', role: 'DEVICE_OPERATOR', tenantId: TENANT, permissions: ['comanda:view'] },
      ['comanda:view'],
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.userRoleAssignment.findMany).not.toHaveBeenCalled();
  });

  it('los permisos revocados individualmente ganan sobre los del rol', async () => {
    const prisma: PrismaStub = {
      userRoleAssignment: {
        findMany: jest.fn().mockResolvedValue([
          { role: { permissions: [{ permission: { key: 'users:delete' } }] } },
        ]),
      },
      userPermissionGrant: {
        findMany: jest.fn().mockResolvedValue([
          { granted: false, permission: { key: 'users:delete' } },
        ]),
      },
    };
    const guard = new PermissionsGuard(new Reflector(), prisma as never);
    const context = buildContext({ id: USER_ID, role: 'STAFF', tenantId: TENANT }, ['users:delete']);

    await expect(guard.canActivate(context)).resolves.toBe(false);
  });
});

describe('PermissionsGuard — invalidación del caché de permisos', () => {
  it.failing(
    'revocar un permiso debe surtir efecto de inmediato, no tras el TTL de 60 s',
    async () => {
      const { guard, prisma } = buildGuard(['users:delete']);
      const context = buildContext({ id: USER_ID, role: 'STAFF', tenantId: TENANT }, ['users:delete']);

      // 1) El usuario entra: tiene el permiso y queda cacheado.
      await expect(guard.canActivate(context)).resolves.toBe(true);

      // 2) Se le revoca el rol en la base (simula un despido o una degradación).
      prisma.userRoleAssignment.findMany.mockResolvedValue([]);

      // 3) Hoy sigue entrando durante 60 s: el guard nunca releé la base ni nadie
      //    invalida la entrada. Debería denegar ya.
      await expect(guard.canActivate(context)).resolves.toBe(false);
    },
  );

  it.failing('el guard debe exponer una forma de invalidar a un usuario concreto', () => {
    const { guard } = buildGuard(['users:view']);

    // La Fase 2 extrae el caché a un `PermissionCacheService` inyectable con
    // `invalidate(userId, tenantId)` / `invalidateTenant(tenantId)`, para que
    // UsersService/RolesService/StaffService puedan limpiarlo al escribir.
    expect(typeof (guard as unknown as { invalidate?: unknown }).invalidate).toBe('function');
  });
});
