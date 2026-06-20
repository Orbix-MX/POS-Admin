import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DiningOrdersService } from './dining-orders.service';

/**
 * Tests for DiningOrdersService open paths: guarantee that a table can never hold
 * two active dining orders. Two layers are exercised:
 *  - Pre-check guard (rejects when an active order already exists, in ANY active
 *    state, not just OPEN).
 *  - DB-level partial unique index: simulated by the $transaction mock, which
 *    rejects with Prisma P2002 the second time the same table is inserted. This
 *    reproduces the race where two concurrent requests both pass the pre-check.
 * Service built directly with mocks to avoid Nest DI noise.
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';
const TABLE = 'table-1';
const WAITER = 'w1';
const UNIQUE_INDEX = 'dining_orders_active_table_key';

/**
 * Builds a service whose Prisma mock emulates the partial unique index: an
 * in-memory set of tables with an active order. The first insert for a table
 * wins; any further insert throws P2002 — exactly what PostgreSQL does.
 */
function buildOpen() {
  const activeTables = new Set<string>();

  const create = jest.fn((args: { data: { tableId: string } }) => ({
    __op: 'create' as const,
    tableId: args.data.tableId,
    data: args.data,
  }));

  const tableUpdate = jest.fn(() => ({ __op: 'tableUpdate' as const }));

  const prisma = {
    // assertBranchBelongs: por defecto la sucursal pertenece al tenant.
    branch: { findFirst: jest.fn().mockResolvedValue({ id: BRANCH }) },
    restaurantTable: {
      findFirst: jest.fn().mockResolvedValue({ id: TABLE, name: 'Mesa 1', status: 'AVAILABLE' }),
      update: tableUpdate,
    },
    employee: { findFirst: jest.fn().mockResolvedValue({ id: WAITER }) },
    diningOrder: {
      findFirst: jest.fn().mockResolvedValue(null), // pre-check: nadie activo (deja pasar)
      create,
    },
    $transaction: jest.fn(async (ops: Array<{ __op: string; tableId?: string; data?: Record<string, unknown> }>) => {
      const createOp = ops.find((o) => o.__op === 'create');
      const tableId = createOp?.tableId as string;
      if (activeTables.has(tableId)) {
        // Segunda inserción activa para la misma mesa → viola el índice parcial.
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: UNIQUE_INDEX },
        });
      }
      activeTables.add(tableId);
      return [{ id: `do-${activeTables.size}`, ...createOp?.data }, {}];
    }),
  };

  const service = new DiningOrdersService(
    prisma as never,
    { requireTenantId: () => TENANT } as never,
    { getUserId: () => WAITER } as never,
    { consume: jest.fn(), restore: jest.fn(), validate: jest.fn() } as never,
    { resolveActiveCashSession: jest.fn(), createPayments: jest.fn(), createCashMovements: jest.fn() } as never,
  );

  return { service, prisma, activeTables };
}

const dineIn = { serviceType: 'DINE_IN' as const, tableId: TABLE, waiterId: WAITER };

describe('DiningOrdersService.open — una sola cuenta activa por mesa', () => {
  it('abre la cuenta cuando la mesa está libre', async () => {
    const { service } = buildOpen();
    const order = await service.open(BRANCH, dineIn as never);
    expect(order).toEqual(expect.objectContaining({ tableId: TABLE }));
  });

  it('rechaza si la sucursal no pertenece al tenant (cross-tenant)', async () => {
    const { service, prisma } = buildOpen();
    prisma.branch.findFirst.mockResolvedValue(null); // sucursal de otro tenant
    await expect(service.open(BRANCH, dineIn as never)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.diningOrder.create).not.toHaveBeenCalled(); // frena antes de escribir
  });

  it('pre-check: rechaza si la mesa ya tiene una cuenta activa NO-OPEN (ej. en cocina)', async () => {
    const { service, prisma } = buildOpen();
    prisma.diningOrder.findFirst.mockResolvedValue({ id: 'do-existente' });
    await expect(service.open(BRANCH, dineIn as never)).rejects.toBeInstanceOf(ConflictException);
    // No debe intentar insertar si el pre-check ya detectó la cuenta activa.
    expect(prisma.diningOrder.create).not.toHaveBeenCalled();
  });

  it('CONCURRENCIA: dos requests simultáneos → solo UNA cuenta sobrevive', async () => {
    const { service, activeTables } = buildOpen();

    // Ambos cruzan el pre-check (findFirst → null) y compiten por insertar.
    const [a, b] = await Promise.allSettled([
      service.open(BRANCH, dineIn as never),
      service.open(BRANCH, dineIn as never),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(['fulfilled', 'rejected']); // exactamente una gana

    const loser = (a.status === 'rejected' ? a : b) as PromiseRejectedResult;
    expect(loser.reason).toBeInstanceOf(ConflictException);
    expect(loser.reason.message).toBe('La mesa ya tiene una cuenta activa.');

    // Evidencia: la BD (índice parcial) dejó una única cuenta activa para la mesa.
    expect(activeTables.size).toBe(1);
    expect(activeTables.has(TABLE)).toBe(true);
  });

  it('CONCURRENCIA x5: una sola gana, las otras 4 son ConflictException', async () => {
    const { service, activeTables } = buildOpen();

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => service.open(BRANCH, dineIn as never)),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    rejected.forEach((r) => expect(r.reason).toBeInstanceOf(ConflictException));
    expect(activeTables.size).toBe(1); // una única cuenta activa, sin importar la carga
  });
});
