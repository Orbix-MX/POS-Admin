import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { AuditService } from '../../../common/services/audit.service';
import { EffectivePermissionsService } from '../../../common/services/effective-permissions.service';
import { PermissionCacheService } from '../../../common/cache/permission-cache.service';
import { InMemoryPermissionCacheStore } from '../../../common/cache/permission-cache.store';

/**
 * Regresión de escalación de privilegios sobre `UsersService`.
 *
 * Cubre dos vulnerabilidades ya corregidas; si alguna vuelve a abrirse, estos
 * tests se ponen en rojo:
 *
 *  - `setRoles` / `setPermissions` no validaban que el actor ya poseyera lo que
 *    otorga, así que cualquier usuario con `users:edit` podía auto-asignarse el
 *    rol de acceso total del tenant, o concederse permisos uno por uno, sin
 *    pasar nunca por `roles:edit`.
 *  - `setRoles` no validaba que los `roleId` pertenecieran al tenant actual
 *    (IDOR cross-tenant). El patrón correcto ya existía en
 *    `StaffService.assignPin`.
 *
 * Referencia externa: Odoo restringe la escritura de `groups_id` en `res.users`
 * y no permite otorgar privilegios por encima de los del actor.
 */

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';

// Actor acotado: un "RRHH" que solo debería poder dar de alta/baja personal.
const ACTOR = 'user-rrhh';
const ACTOR_ROLE = 'role-rrhh';

// Rol de acceso total del tenant — el objetivo de la escalación.
const OWNER_ROLE = 'role-owner';

// Rol perteneciente a OTRO tenant — el objetivo del IDOR.
const FOREIGN_ROLE = 'role-de-otro-tenant';

const PERM_USERS_EDIT = { id: 'perm-users-edit', key: 'users:edit' };
const PERM_ROLES_EDIT = { id: 'perm-roles-edit', key: 'roles:edit' };
const PERM_USERS_DELETE = { id: 'perm-users-delete', key: 'users:delete' };

/** Filas de `userRoleAssignment` por usuario, con sus permisos ya resueltos. */
const ROLE_ASSIGNMENTS: Record<string, unknown[]> = {
  [ACTOR]: [
    {
      userId: ACTOR,
      roleId: ACTOR_ROLE,
      tenantId: TENANT,
      role: {
        id: ACTOR_ROLE,
        name: 'RRHH',
        tenantId: TENANT,
        permissions: [{ permission: PERM_USERS_EDIT }],
      },
    },
  ],
};

function buildModule(overrides: { actorIsSuperAdmin?: boolean } = {}) {
  const prisma = {
    user: {
      // Validación de pertenencia del target al tenant.
      findFirst: jest.fn().mockResolvedValue({ id: ACTOR, email: 'rrhh@example.com' }),
      // `getEffectivePermissions` resuelve el rol global del usuario aquí.
      findUnique: jest.fn().mockResolvedValue({
        id: ACTOR,
        role: overrides.actorIsSuperAdmin ? 'SUPER_ADMIN' : 'STAFF',
      }),
    },
    role: {
      // Solo los roles del tenant actual son visibles con este filtro.
      findMany: jest.fn().mockImplementation(({ where }: { where: { id?: { in: string[] }; tenantId?: string } }) => {
        const ids = where?.id?.in ?? [];
        const catalog = [
          {
            id: OWNER_ROLE,
            name: 'Owner',
            tenantId: TENANT,
            permissions: [
              { permission: PERM_USERS_EDIT },
              { permission: PERM_ROLES_EDIT },
              { permission: PERM_USERS_DELETE },
            ],
          },
          { id: ACTOR_ROLE, name: 'RRHH', tenantId: TENANT, permissions: [{ permission: PERM_USERS_EDIT }] },
          { id: FOREIGN_ROLE, name: 'Owner ajeno', tenantId: OTHER_TENANT, permissions: [] },
        ];
        return Promise.resolve(
          catalog.filter(
            (r) => ids.includes(r.id) && (where?.tenantId === undefined || r.tenantId === where.tenantId),
          ),
        );
      }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    permission: {
      findMany: jest.fn().mockImplementation(({ where }: { where?: { id?: { in: string[] } } } = {}) => {
        const catalog = [PERM_USERS_EDIT, PERM_ROLES_EDIT, PERM_USERS_DELETE];
        const ids = where?.id?.in;
        // Sin filtro devuelve el catálogo entero, igual que Prisma.
        return Promise.resolve(ids ? catalog.filter((p) => ids.includes(p.id)) : catalog);
      }),
    },
    userRoleAssignment: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { userId: string } }) =>
        Promise.resolve(ROLE_ASSIGNMENTS[where.userId] ?? []),
      ),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    userPermissionGrant: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    tenant: { findUnique: jest.fn().mockResolvedValue({ ownerUserId: 'otro-usuario' }) },
    // La protección de "último administrador" consulta las membresías activas.
    // Por defecto hay otro admin, así que nunca bloquea estos tests.
    tenantMembership: {
      findMany: jest.fn().mockResolvedValue([
        {
          userId: 'otro-admin',
          user: {
            role: 'STAFF',
            roleAssignments: [
              { role: { permissions: [{ permission: PERM_USERS_EDIT }, { permission: PERM_ROLES_EDIT }] } },
            ],
            permissionGrants: [],
          },
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
      typeof cb === 'function' ? cb(prisma) : Promise.all(cb as unknown as unknown[]),
    ),
  };

  return { prisma };
}

async function buildService(overrides: { actorIsSuperAdmin?: boolean } = {}) {
  const { prisma } = buildModule(overrides);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      UsersService,
      // El servicio de permisos efectivos va REAL sobre el prisma simulado: es la
      // pieza que decide si hay escalación, así que mockearla vaciaría el test.
      EffectivePermissionsService,
      // Caché real en memoria: si algún día se cachea de más, estos tests lo ven.
      { provide: PermissionCacheService, useValue: new PermissionCacheService(new InMemoryPermissionCacheStore()) },
      { provide: PrismaService, useValue: prisma },
      { provide: TenantContextService, useValue: { requireTenantId: () => TENANT, getBranchId: () => null } },
      { provide: AuditContextService, useValue: { getUserId: () => ACTOR, isOperator: () => false } },
      { provide: PlanLimitsService, useValue: { assertCanAddActiveUser: jest.fn(), recomputeOverLimit: jest.fn(), getCapacity: jest.fn() } },
      { provide: AuditService, useValue: { log: jest.fn() } },
    ],
  }).compile();

  return { service: module.get(UsersService), prisma };
}

describe('UsersService — escalación de privilegios vía asignación de roles', () => {
  it(
    'un actor con solo `users:edit` NO puede auto-asignarse el rol de acceso total',
    async () => {
      const { service } = await buildService();

      // El actor se apunta a sí mismo el rol Owner, que incluye `roles:edit` y
      // `users:delete` — permisos que él no posee.
      await expect(service.setRoles(ACTOR, [OWNER_ROLE])).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('la asignación rechazada no debe persistirse', async () => {
    const { service, prisma } = await buildService();

    await service.setRoles(ACTOR, [OWNER_ROLE]).catch(() => undefined);

    expect(prisma.userRoleAssignment.createMany).not.toHaveBeenCalled();
  });

  it('un SUPER_ADMIN sí puede asignar cualquier rol del tenant (regresión: no romper el bypass)', async () => {
    const { service, prisma } = await buildService({ actorIsSuperAdmin: true });

    await expect(service.setRoles(ACTOR, [OWNER_ROLE])).resolves.toBeUndefined();
    expect(prisma.userRoleAssignment.createMany).toHaveBeenCalled();
  });

  it('asignar un rol cuyos permisos el actor ya posee sigue permitido', async () => {
    const { service, prisma } = await buildService();

    await expect(service.setRoles(ACTOR, [ACTOR_ROLE])).resolves.toBeUndefined();
    expect(prisma.userRoleAssignment.createMany).toHaveBeenCalled();
  });

  it('quitar todos los roles sigue permitido (revocar nunca escala)', async () => {
    const { service, prisma } = await buildService();

    await expect(service.setRoles(ACTOR, [])).resolves.toBeUndefined();
    expect(prisma.userRoleAssignment.deleteMany).toHaveBeenCalled();
  });
});

describe('UsersService — escalación de privilegios vía grants individuales', () => {
  it(
    'un actor con solo `users:edit` NO puede auto-concederse `roles:edit`',
    async () => {
      const { service } = await buildService();

      await expect(
        service.setPermissions(ACTOR, [{ permissionId: PERM_ROLES_EDIT.id, granted: true }]),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('el grant rechazado no debe persistirse', async () => {
    const { service, prisma } = await buildService();

    await service
      .setPermissions(ACTOR, [{ permissionId: PERM_USERS_DELETE.id, granted: true }])
      .catch(() => undefined);

    expect(prisma.userPermissionGrant.createMany).not.toHaveBeenCalled();
  });

  it('revocar un permiso (granted:false) siempre está permitido, aunque el actor no lo tenga', async () => {
    const { service } = await buildService();

    await expect(
      service.setPermissions(ACTOR, [{ permissionId: PERM_ROLES_EDIT.id, granted: false }]),
    ).resolves.toBeUndefined();
  });

  it('conceder un permiso que el actor SÍ posee sigue permitido', async () => {
    const { service } = await buildService();

    await expect(
      service.setPermissions(ACTOR, [{ permissionId: PERM_USERS_EDIT.id, granted: true }]),
    ).resolves.toBeUndefined();
  });
});

describe('UsersService — invalidación del caché de permisos', () => {
  /**
   * El caché deja de ser correcto en cuanto un cambio de RBAC no lo limpia: el
   * usuario conservaría el permiso revocado hasta que expire el TTL. Estos tests
   * vigilan la llamada, que es la parte que se olvida al añadir un método nuevo.
   */
  async function buildWithCacheSpy() {
    const { prisma } = buildModule();
    const permissionCache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
      invalidateUser: jest.fn(),
      invalidateTenant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        EffectivePermissionsService,
        { provide: PermissionCacheService, useValue: permissionCache },
        { provide: PrismaService, useValue: prisma },
        { provide: TenantContextService, useValue: { requireTenantId: () => TENANT, getBranchId: () => null } },
        { provide: AuditContextService, useValue: { getUserId: () => ACTOR, isOperator: () => false } },
        { provide: PlanLimitsService, useValue: { assertCanAddActiveUser: jest.fn(), recomputeOverLimit: jest.fn(), getCapacity: jest.fn() } },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    return { service: module.get(UsersService), permissionCache, prisma };
  }

  it('setRoles invalida al usuario afectado', async () => {
    const { service, permissionCache } = await buildWithCacheSpy();

    await service.setRoles(ACTOR, [ACTOR_ROLE]);

    expect(permissionCache.invalidateUser).toHaveBeenCalledWith(ACTOR, TENANT);
  });

  it('setPermissions invalida al usuario afectado', async () => {
    const { service, permissionCache } = await buildWithCacheSpy();

    await service.setPermissions(ACTOR, [{ permissionId: PERM_USERS_EDIT.id, granted: true }]);

    expect(permissionCache.invalidateUser).toHaveBeenCalledWith(ACTOR, TENANT);
  });

  it('desactivar a un usuario invalida su caché de inmediato (despido)', async () => {
    const { service, permissionCache, prisma } = await buildWithCacheSpy();
    prisma.tenantMembership = {
      ...prisma.tenantMembership,
      findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
      update: jest.fn().mockResolvedValue({}),
    } as never;
    // `setMembershipStatus` relee el usuario al final para devolverlo.
    prisma.user.findFirst.mockResolvedValue({
      id: ACTOR,
      email: 'rrhh@example.com',
      tenantMemberships: [{ status: 'INACTIVE' }],
    });

    await service.setMembershipStatus(ACTOR, 'INACTIVE');

    expect(permissionCache.invalidateUser).toHaveBeenCalledWith(ACTOR, TENANT);
  });
});

describe('UsersService — aislamiento multi-tenant en asignación de roles', () => {
  it('NO puede asignarse un rol que pertenece a otro tenant (IDOR)', async () => {
    const { service } = await buildService();

    await expect(service.setRoles(ACTOR, [FOREIGN_ROLE])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('el rol ajeno no debe persistirse en `userRoleAssignment`', async () => {
    const { service, prisma } = await buildService();

    await service.setRoles(ACTOR, [FOREIGN_ROLE]).catch(() => undefined);

    expect(prisma.userRoleAssignment.createMany).not.toHaveBeenCalled();
  });
});
