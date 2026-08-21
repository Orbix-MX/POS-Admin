import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CashSessionsService } from './cash-sessions.service';

/**
 * Tests for CashSessionsService.open: a branch must never hold two ABIERTA cash
 * sessions. Two layers are exercised:
 *  - Pre-check guard (rejects when an open session already exists).
 *  - DB-level partial unique index (one ABIERTA per tenant+branch): simulated by
 *    the create mock, which throws Prisma P2002 the second time the same
 *    (tenant, branch) is inserted while still open. Reproduces the race where two
 *    operators both pass the pre-check.
 * Service built directly with mocks to avoid Nest DI noise.
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';
const UNIQUE_INDEX = 'cash_sessions_one_open_per_register_key';

/**
 * Builds a service whose Prisma mock emulates the partial unique index: an
 * in-memory set of (tenant:branch) keys with an ABIERTA session. The first
 * insert wins; any further insert while still open throws P2002 — exactly what
 * PostgreSQL does. Exposes the set + a `close` helper to mimic a CERRADA.
 */
function buildOpen() {
  const openKeys = new Set<string>();
  const keyOf = (_t: string, _b: string | null) => 'reg-1';

  const create = jest.fn((args: { data: { tenantId: string; branchId: string | null } }) => {
    const k = keyOf(args.data.tenantId, args.data.branchId);
    if (openKeys.has(k)) {
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: UNIQUE_INDEX },
      });
    }
    openKeys.add(k);
    return { id: `cs-${openKeys.size}`, ...args.data };
  });

  const prisma = {
    // SUPER_ADMIN: `resolveCashAuthorizer` no pide PIN ni consulta permisos.
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'SUPER_ADMIN' }) },
    cashSession: {
      findFirst: jest.fn().mockResolvedValue(null), // pre-check: nadie abierto (deja pasar)
      create,
    },
    // La sesión se abre sobre una caja física; la sucursal ya tiene la suya.
    cashRegister: {
      findFirst: jest.fn().mockResolvedValue({ id: 'reg-1' }),
      // Libre: la contención que prueba esta suite es la del índice único al
      // insertar, no la elección de caja.
      findMany: jest.fn().mockResolvedValue([{ id: 'reg-1', sessions: [] }]),
      create: jest.fn().mockResolvedValue({ id: 'reg-1' }),
    },
    $transaction: jest.fn(async (cb: (tx: { cashSession: { create: typeof create } }) => Promise<unknown>) =>
      cb({ cashSession: { create } }),
    ),
  };

  const service = new CashSessionsService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => BRANCH } as never,
    { getUserId: () => 'user-1' } as never,
    { log: jest.fn() } as never,
    { assertCanOpenCashSession: jest.fn(), getCashSessionCapacity: jest.fn() } as never,
    { get: () => 'test-secret' } as never,
  );

  const close = () => openKeys.delete(keyOf(TENANT, BRANCH));
  return { service, prisma, openKeys, close };
}

const dto = { branchId: BRANCH, exchangeRateUsdMxn: 17, openingAmount: 1000 };

describe('CashSessionsService.open — una sola sesión viva por caja física', () => {
  it('abre la caja cuando la sucursal no tiene sesión activa', async () => {
    const { service, openKeys } = buildOpen();
    const session = await service.open(dto);
    expect(session).toEqual(expect.objectContaining({ branchId: BRANCH, status: 'ABIERTA' }));
    expect(openKeys.size).toBe(1);
  });

  it('pre-check: rechaza si ya hay una sesión ABIERTA en la sucursal', async () => {
    const { service, prisma } = buildOpen();
    prisma.cashSession.findFirst.mockResolvedValue({ id: 'cs-existente', status: 'ABIERTA' });
    await expect(service.open(dto as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.cashSession.create).not.toHaveBeenCalled();
  });

  it('CONCURRENCIA: 2 operadores abriendo a la vez → solo UNA sesión sobrevive', async () => {
    const { service, openKeys } = buildOpen();

    // Ambos cruzan el pre-check (findFirst → null) y compiten por insertar.
    const [a, b] = await Promise.allSettled([service.open(dto as never), service.open(dto as never)]);

    expect([a.status, b.status].sort()).toEqual(['fulfilled', 'rejected']);
    const loser = (a.status === 'rejected' ? a : b) as PromiseRejectedResult;
    expect(loser.reason).toBeInstanceOf(BadRequestException);
    expect(loser.reason.message).toBe('Ya existe una sesión de caja abierta para esta caja');

    // Evidencia: la BD (índice parcial) dejó una única sesión ABIERTA.
    expect(openKeys.size).toBe(1);
  });

  it('REINTENTO: reintento con pre-check obsoleto no crea duplicado (P2002 → BadRequest)', async () => {
    const { service, openKeys } = buildOpen();
    // findFirst sigue devolviendo null (lectura obsoleta), simulando un reintento
    // que no “ve” la sesión recién creada por la primera llamada.
    await service.open(dto); // primera apertura: gana
    await expect(service.open(dto as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(openKeys.size).toBe(1); // sigue habiendo una sola
  });

  it('APERTURA TRAS CIERRE: tras cerrar la sesión, se puede abrir una nueva', async () => {
    const { service, openKeys, close } = buildOpen();
    await service.open(dto);
    close(); // la sesión pasa a CERRADA → el índice parcial ya no la cuenta
    const reopened = await service.open(dto);
    expect(reopened).toEqual(expect.objectContaining({ status: 'ABIERTA' }));
    expect(openKeys.size).toBe(1);
  });

  it('CONCURRENCIA x5: una sola gana, las otras 4 son BadRequestException', async () => {
    const { service, openKeys } = buildOpen();
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => service.open(dto as never)));
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    rejected.forEach((r) => expect(r.reason).toBeInstanceOf(BadRequestException));
    expect(openKeys.size).toBe(1);
  });
});
