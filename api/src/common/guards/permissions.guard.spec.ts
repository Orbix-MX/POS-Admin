import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { NO_PERMISSIONS_REQUIRED_KEY } from '../decorators/no-permissions-required.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { EffectivePermissionsService } from '../services/effective-permissions.service';
import { PermissionCacheService } from '../cache/permission-cache.service';
import { InMemoryPermissionCacheStore } from '../cache/permission-cache.store';

/**
 * `PermissionsGuard` y el caché de permisos efectivos.
 *
 * Cubre dos vulnerabilidades ya corregidas:
 *
 *  1. FAIL-OPEN: si un handler no declaraba `@RequirePermissions`, el guard
 *     concedía acceso a cualquier usuario autenticado, así que un olvido del
 *     decorador abría el endpoint en silencio (así quedaron abiertos los
 *     endpoints de PIN). Ahora deniega salvo `@NoPermissionsRequired`.
 *  2. CACHÉ SIN INVALIDACIÓN: los permisos efectivos se cacheaban 60 s sin que
 *     ningún cambio de rol o de grant lo limpiara, así que un permiso revocado
 *     seguía concediendo acceso hasta un minuto. Odoo invalida su caché de
 *     forma síncrona al escribir `groups_id`; ahora hay equivalente.
 */

const USER_ID = 'user-1';
const TENANT = 'tenant-1';

type PrismaStub = {
  user: { findUnique: jest.Mock };
  userRoleAssignment: { findMany: jest.Mock };
  userPermissionGrant: { findMany: jest.Mock };
};

/** Construye un ExecutionContext con el `user` y la metadata dados. */
function buildContext(
  user: unknown,
  requiredPermissions?: string[],
  opts: { noPermissionsRequired?: boolean; isPublic?: boolean } = {},
): ExecutionContext {
  const handler = () => undefined;
  if (requiredPermissions) {
    Reflect.defineMetadata(PERMISSIONS_KEY, requiredPermissions, handler);
  }
  if (opts.noPermissionsRequired) {
    Reflect.defineMetadata(NO_PERMISSIONS_REQUIRED_KEY, true, handler);
  }
  if (opts.isPublic) {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
  }

  return {
    getHandler: () => handler,
    getClass: () => class Anon {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function buildGuard(permissionKeys: string[]) {
  const prisma: PrismaStub = {
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'STAFF' }) },
    userRoleAssignment: {
      findMany: jest.fn().mockResolvedValue([
        { role: { permissions: permissionKeys.map((key) => ({ permission: { key } })) } },
      ]),
    },
    userPermissionGrant: { findMany: jest.fn().mockResolvedValue([]) },
  };

  // Caché y resolución reales: el objeto de esta suite es justamente comprobar
  // que cachear no deja permisos revocados con vida.
  const cache = new PermissionCacheService(new InMemoryPermissionCacheStore());
  const effectivePermissions = new EffectivePermissionsService(
    prisma as never,
    { getUserId: () => USER_ID, isOperator: () => false } as never,
    { requireTenantId: () => TENANT } as never,
    cache,
  );

  const guard = new PermissionsGuard(new Reflector(), effectivePermissions);
  return { guard, prisma, cache };
}

describe('PermissionsGuard — comportamiento por defecto (fail-closed)', () => {
  it('un handler SIN @RequirePermissions deniega por defecto', async () => {
    const { guard } = buildGuard([]);
    const context = buildContext({ id: USER_ID, role: 'STAFF', tenantId: TENANT });

    // Un decorador olvidado se convierte en un 403 que alguien reporta, no en un
    // endpoint abierto a cualquier usuario autenticado del tenant.
    await expect(guard.canActivate(context)).resolves.toBe(false);
  });

  it('@NoPermissionsRequired permite el paso de forma explícita', async () => {
    const { guard } = buildGuard([]);
    const context = buildContext(
      { id: USER_ID, role: 'STAFF', tenantId: TENANT },
      undefined,
      { noPermissionsRequired: true },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('@NoPermissionsRequired concede sin consultar la base de permisos', async () => {
    const { guard, prisma } = buildGuard([]);
    const context = buildContext(
      { id: USER_ID, role: 'STAFF', tenantId: TENANT },
      undefined,
      { noPermissionsRequired: true },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.userRoleAssignment.findMany).not.toHaveBeenCalled();
  });

  it('@Public() pasa: no hay sesión que comprobar', async () => {
    const { guard } = buildGuard([]);
    // Un endpoint público llega aquí sin `user` porque JwtAuthGuard lo dejó
    // pasar. Denegarlo rompía login, activación de dispositivos y la tienda.
    const context = buildContext(undefined, undefined, { isPublic: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

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
    const { guard, prisma } = buildGuard(['users:delete']);
    prisma.userPermissionGrant.findMany.mockResolvedValue([
      { granted: false, permission: { key: 'users:delete' } },
    ]);
    const context = buildContext({ id: USER_ID, role: 'STAFF', tenantId: TENANT }, ['users:delete']);

    await expect(guard.canActivate(context)).resolves.toBe(false);
  });
});

describe('PermissionsGuard — invalidación del caché de permisos', () => {
  it('cachea: dos comprobaciones seguidas consultan la base una sola vez', async () => {
    const { guard, prisma } = buildGuard(['users:view']);
    const context = buildContext({ id: USER_ID, role: 'STAFF', tenantId: TENANT }, ['users:view']);

    await guard.canActivate(context);
    await guard.canActivate(context);

    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledTimes(1);
  });

  it('revocar un permiso surte efecto de inmediato tras invalidar al usuario', async () => {
    const { guard, prisma, cache } = buildGuard(['users:delete']);
    const context = buildContext({ id: USER_ID, role: 'STAFF', tenantId: TENANT }, ['users:delete']);

    // 1) El usuario entra: tiene el permiso y queda cacheado.
    await expect(guard.canActivate(context)).resolves.toBe(true);

    // 2) Se le revoca el rol en la base (simula un despido o una degradación).
    prisma.userRoleAssignment.findMany.mockResolvedValue([]);
    await cache.invalidateUser(USER_ID, TENANT);

    // 3) Deja de entrar en la siguiente petición, sin esperar al TTL.
    await expect(guard.canActivate(context)).resolves.toBe(false);
  });

  it('invalidar el tenant afecta a todos sus usuarios (cambio de rol)', async () => {
    const { guard, prisma, cache } = buildGuard(['users:delete']);
    const context = buildContext({ id: USER_ID, role: 'STAFF', tenantId: TENANT }, ['users:delete']);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    prisma.userRoleAssignment.findMany.mockResolvedValue([]);
    await cache.invalidateTenant(TENANT);

    await expect(guard.canActivate(context)).resolves.toBe(false);
  });

  it('invalidar otro tenant no tira el caché de este', async () => {
    const { guard, prisma, cache } = buildGuard(['users:view']);
    const context = buildContext({ id: USER_ID, role: 'STAFF', tenantId: TENANT }, ['users:view']);

    await guard.canActivate(context);
    await cache.invalidateTenant('otro-tenant');
    await guard.canActivate(context);

    // Sigue sirviéndose de caché: una sola consulta.
    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledTimes(1);
  });
});
