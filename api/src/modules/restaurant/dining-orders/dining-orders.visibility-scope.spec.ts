import { DiningOrdersService } from './dining-orders.service';

/**
 * Infraestructura de visibilidad de GET /dining-orders (preparación de
 * `restaurantVisibilityMode`). El parámetro `scope` declara la intención del
 * solicitante ('all' caja / 'own' operador). HOY no filtra: ambos scopes
 * devuelven todas las cuentas activas y el `where` NO incluye `waiterId`. Estas
 * pruebas fijan ese contrato para que la futura OWN_ONLY:
 *   - restrinja solo 'own', y
 *   - jamás afecte a la caja ('all').
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';

const ORDERS = [
  { id: 'do-1', waiter: { id: 'w1' } },
  { id: 'do-2', waiter: { id: 'w2' } },
  { id: 'do-3', waiter: { id: 'w1' } },
];

type Mode = 'SHARED' | 'OWN_ONLY' | 'OWN_WITH_SUPERVISOR';

function build(mode: Mode = 'SHARED') {
  const findMany = jest.fn().mockResolvedValue(ORDERS);
  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: BRANCH }) }, // assertBranchBelongs
    diningOrder: { findMany },
  };
  const resolveRestaurantVisibilityMode = jest.fn().mockResolvedValue(mode);
  const service = new DiningOrdersService(
    prisma as never,
    { requireTenantId: () => TENANT } as never,
    { getUserId: () => 'op-1', isOperator: () => true } as never,
    { consume: jest.fn(), restore: jest.fn(), validate: jest.fn() } as never,
    { resolveActiveCashSession: jest.fn(), createPayments: jest.fn(), createCashMovements: jest.fn() } as never,
    { resolveRestaurantVisibilityMode, assertCanAccessOrder: jest.fn().mockResolvedValue(undefined) } as never,
  );
  return { service, findMany, resolveRestaurantVisibilityMode };
}

/** `where` con el que se consultó la BD. */
function whereOf(findMany: jest.Mock): Record<string, unknown> {
  return findMany.mock.calls[0][0].where;
}

describe('DiningOrdersService.findActive — infraestructura de visibilidad (scope)', () => {
  it("scope 'all' (caja): devuelve todas, sin filtro por mesero", async () => {
    const { service, findMany } = build();
    const res = await service.findActive(BRANCH, 'all');

    expect(res).toHaveLength(ORDERS.length);
    const where = whereOf(findMany);
    expect(where).toEqual(expect.objectContaining({ tenantId: TENANT, branchId: BRANCH }));
    expect(where).not.toHaveProperty('waiterId'); // hoy no se filtra
  });

  it("scope 'own' (operador): HOY idéntico a 'all' — sin filtro aún", async () => {
    const { service, findMany } = build();
    const res = await service.findActive(BRANCH, 'own');

    expect(res).toHaveLength(ORDERS.length);
    expect(whereOf(findMany)).not.toHaveProperty('waiterId');
  });

  it("default: scope omitido se comporta como 'all'", async () => {
    const { service, findMany } = build();
    const res = await service.findActive(BRANCH);

    expect(res).toHaveLength(ORDERS.length);
    expect(whereOf(findMany)).not.toHaveProperty('waiterId');
  });

  it('caja y operador reciben el MISMO conjunto hoy (OWN_ONLY aún no afecta a caja)', async () => {
    const cashier = build();
    const operator = build();
    const all = await cashier.service.findActive(BRANCH, 'all');
    const own = await operator.service.findActive(BRANCH, 'own');

    expect(all.map((o) => o.id)).toEqual(own.map((o) => o.id));
  });

  it('siempre excluye estados terminales (PAID/CLOSED/CANCELLED), en cualquier scope', async () => {
    const { service, findMany } = build();
    await service.findActive(BRANCH, 'own');
    expect(whereOf(findMany).status).toEqual({ notIn: ['PAID', 'CLOSED', 'CANCELLED'] });
  });

  // ─── restaurantVisibilityMode: infraestructura, sin filtros ──────────────────

  it("scope 'all' (caja) NO consulta el modo: inmune por construcción", async () => {
    const { service, resolveRestaurantVisibilityMode } = build('OWN_ONLY');
    await service.findActive(BRANCH, 'all');
    // La caja se resuelve antes de mirar el modo → nunca se consulta.
    expect(resolveRestaurantVisibilityMode).not.toHaveBeenCalled();
  });

  it("scope 'own' SÍ resuelve el modo de la sucursal", async () => {
    const { service, resolveRestaurantVisibilityMode } = build('OWN_ONLY');
    await service.findActive(BRANCH, 'own');
    expect(resolveRestaurantVisibilityMode).toHaveBeenCalledWith(TENANT, BRANCH);
  });

  it.each(['SHARED', 'OWN_ONLY', 'OWN_WITH_SUPERVISOR'] as const)(
    "modo %s + scope 'own': HOY no filtra (where sin waiterId)",
    async (mode) => {
      const { service, findMany } = build(mode);
      const res = await service.findActive(BRANCH, 'own');

      expect(res).toHaveLength(ORDERS.length);
      expect(whereOf(findMany)).not.toHaveProperty('waiterId');
    },
  );

  it('OWN_ONLY no afecta a la caja: scope=all devuelve TODO incluso con el modo restrictivo', async () => {
    const { service, findMany } = build('OWN_ONLY');
    const res = await service.findActive(BRANCH, 'all');

    expect(res).toHaveLength(ORDERS.length);
    expect(whereOf(findMany)).not.toHaveProperty('waiterId');
  });
});
