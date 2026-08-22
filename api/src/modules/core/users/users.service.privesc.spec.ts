import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { AuditService } from '../../../common/services/audit.service';

/**
 * FASE 0 — Tests de escalación de privilegios sobre `UsersService`.
 *
 * Estos tests describen el comportamiento CORRECTO, no el actual. Los que están
 * marcados `it.failing()` fallan hoy a propósito: documentan una vulnerabilidad
 * abierta y pasan mientras siga abierta. Cuando la Fase 1 la cierre, Jest
 * reportará "Failing test passed unexpectedly" — en ese momento hay que quitar el
 * `.failing` y el test queda como regresión permanente.
 *
 * Vulnerabilidades cubiertas:
 *  - `setRoles` / `setPermissions` no validan que el actor ya posea lo que otorga
 *    → cualquier usuario con `users:edit` se auto-escala a Owner del tenant.
 *  - `setRoles` no valida que los `roleId` pertenezcan al tenant actual (IDOR
 *    cross-tenant). El patrón correcto ya existe en `StaffService.assignPin`.
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
      findMany: jest.fn().mockResolvedValue([PERM_USERS_EDIT, PERM_ROLES_EDIT, PERM_USERS_DELETE]),
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
      { provide: PrismaService, useValue: prisma },
      { provide: TenantContextService, useValue: { requireTenantId: () => TENANT, getBranchId: () => null } },
      // Provisto desde ya: la corrección de Fase 1 necesita conocer al actor para
      // comparar sus permisos contra los que intenta otorgar.
      { provide: AuditContextService, useValue: { getUserId: () => ACTOR, isOperator: () => false } },
      { provide: PlanLimitsService, useValue: { assertCanAddActiveUser: jest.fn(), recomputeOverLimit: jest.fn(), getCapacity: jest.fn() } },
      { provide: AuditService, useValue: { log: jest.fn() } },
    ],
  }).compile();

  return { service: module.get(UsersService), prisma };
}

describe('UsersService — escalación de privilegios vía asignación de roles', () => {
  it.failing(
    'un actor con solo `users:edit` NO puede auto-asignarse el rol de acceso total',
    async () => {
      const { service } = await buildService();

      // El actor se apunta a sí mismo el rol Owner, que incluye `roles:edit` y
      // `users:delete` — permisos que él no posee.
      await expect(service.setRoles(ACTOR, [OWNER_ROLE])).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.failing('la asignación rechazada no debe persistirse', async () => {
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
  it.failing(
    'un actor con solo `users:edit` NO puede auto-concederse `roles:edit`',
    async () => {
      const { service } = await buildService();

      await expect(
        service.setPermissions(ACTOR, [{ permissionId: PERM_ROLES_EDIT.id, granted: true }]),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.failing('el grant rechazado no debe persistirse', async () => {
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

describe('UsersService — aislamiento multi-tenant en asignación de roles', () => {
  it.failing('NO puede asignarse un rol que pertenece a otro tenant (IDOR)', async () => {
    const { service } = await buildService();

    await expect(service.setRoles(ACTOR, [FOREIGN_ROLE])).rejects.toBeInstanceOf(BadRequestException);
  });

  it.failing('el rol ajeno no debe persistirse en `userRoleAssignment`', async () => {
    const { service, prisma } = await buildService();

    await service.setRoles(ACTOR, [FOREIGN_ROLE]).catch(() => undefined);

    expect(prisma.userRoleAssignment.createMany).not.toHaveBeenCalled();
  });
});
