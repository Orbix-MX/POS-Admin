import { NotFoundException } from '@nestjs/common';
import { RestaurantVisibilityService } from './restaurant-visibility.service';

/**
 * Helper de visibilidad. Dos responsabilidades:
 *  - `resolveRestaurantVisibilityMode`: resuelve el modo de la sucursal (listado).
 *  - `assertCanAccessOrder`: autorización por recurso (acceso por id) — evita IDOR
 *    cuando el modo deja de ser SHARED.
 *
 * Default SHARED y acceso total para usuarios admin garantizan cero cambio
 * funcional observable hoy (todas las sucursales nacen SHARED).
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';
const OPERATOR = 'emp-operator';
const OTHER = 'emp-otro';

type Mode = 'SHARED' | 'OWN_ONLY' | 'OWN_WITH_SUPERVISOR';

function build(opts: { mode?: Mode; isOperator?: boolean; operatorId?: string | null } = {}) {
  const { mode = 'SHARED', isOperator = true, operatorId = OPERATOR } = opts;
  const findFirst = jest.fn().mockResolvedValue({ restaurantVisibilityMode: mode });
  const prisma = { branch: { findFirst } };
  const tenantContext = { requireTenantId: () => TENANT };
  const auditContext = { isOperator: () => isOperator, getUserId: () => operatorId };
  const service = new RestaurantVisibilityService(
    prisma as never,
    tenantContext as never,
    auditContext as never,
  );
  return { service, findFirst };
}

describe('RestaurantVisibilityService.resolveRestaurantVisibilityMode', () => {
  it('devuelve el modo configurado en la sucursal', async () => {
    const { service } = build({ mode: 'OWN_ONLY' });
    await expect(service.resolveRestaurantVisibilityMode(TENANT, BRANCH)).resolves.toBe('OWN_ONLY');
  });

  it('default SHARED cuando la sucursal no existe', async () => {
    const { service, findFirst } = build();
    findFirst.mockResolvedValue(null);
    await expect(service.resolveRestaurantVisibilityMode(TENANT, BRANCH)).resolves.toBe('SHARED');
  });

  it('consulta acotada por tenant + branch (aislamiento multi-tenant)', async () => {
    const { service, findFirst } = build();
    await service.resolveRestaurantVisibilityMode(TENANT, BRANCH);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: BRANCH, tenantId: TENANT },
      select: { restaurantVisibilityMode: true },
    });
  });
});

describe('RestaurantVisibilityService.assertCanAccessOrder', () => {
  const own = { waiterId: OPERATOR, branchId: BRANCH };
  const foreign = { waiterId: OTHER, branchId: BRANCH };

  it('usuario administrativo (no operador): acceso total a cualquier orden', async () => {
    const { service, findFirst } = build({ isOperator: false, mode: 'OWN_ONLY' });
    await expect(service.assertCanAccessOrder(foreign)).resolves.toBeUndefined();
    // Ni siquiera resuelve el modo: el flujo de usuario es inmune.
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('SHARED: el operador accede a cualquier orden (comportamiento actual)', async () => {
    const { service } = build({ mode: 'SHARED' });
    await expect(service.assertCanAccessOrder(foreign)).resolves.toBeUndefined();
  });

  it('OWN_ONLY: la propia pasa', async () => {
    const { service } = build({ mode: 'OWN_ONLY' });
    await expect(service.assertCanAccessOrder(own)).resolves.toBeUndefined();
  });

  it('OWN_ONLY: la ajena lanza NotFoundException (no revela existencia)', async () => {
    const { service } = build({ mode: 'OWN_ONLY' });
    await expect(service.assertCanAccessOrder(foreign)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('OWN_WITH_SUPERVISOR: la propia pasa', async () => {
    const { service } = build({ mode: 'OWN_WITH_SUPERVISOR' });
    await expect(service.assertCanAccessOrder(own)).resolves.toBeUndefined();
  });

  it('OWN_WITH_SUPERVISOR: ajena sin jerarquía resoluble lanza NotFound (fail-closed)', async () => {
    // Aún no existe Employee.supervisorId → isSubordinate=false → se deniega.
    const { service } = build({ mode: 'OWN_WITH_SUPERVISOR' });
    await expect(service.assertCanAccessOrder(foreign)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('operador sin identidad resoluble bajo modo restrictivo: fail-closed (NotFound)', async () => {
    const { service } = build({ mode: 'OWN_ONLY', operatorId: null });
    await expect(service.assertCanAccessOrder(own)).rejects.toBeInstanceOf(NotFoundException);
  });
});
