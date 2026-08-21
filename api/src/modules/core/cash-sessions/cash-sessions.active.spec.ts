import { CashSessionsService } from './cash-sessions.service';

/**
 * `getActive` — qué sesión ve quien pregunta.
 *
 * La caja pertenece al puesto, no a la persona: el relevo de turno entra en la
 * misma terminal y sigue operando la sesión que dejó abierta el turno anterior.
 * Pero sin saber en qué caja se está, con varias abiertas no se puede adivinar
 * —hacerlo metía los cobros de un cajero en el cajón de otro—.
 */

const TENANT = 'tenant-1';

interface Opts {
  /** Sesiones vivas en la sucursal. */
  live?: { id: string; cashRegisterId: string; openedById: string }[];
  /** Usuario que hace la petición. */
  userId?: string;
}

function build({ live = [], userId = 'user-1' }: Opts = {}) {
  const findFirst = jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    const match = live.find(
      (s) =>
        (where.cashRegisterId == null || s.cashRegisterId === where.cashRegisterId) &&
        (where.openedById == null || s.openedById === where.openedById),
    );
    return Promise.resolve(match ? { ...match, openingAmount: 0, openingAmountUsd: 0, movements: [] } : null);
  });

  const prisma = {
    // SUPER_ADMIN: `resolveCashAuthorizer` no pide PIN ni consulta permisos.
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'SUPER_ADMIN' }) },
    cashSession: { findFirst, count: jest.fn().mockResolvedValue(live.length) },
  };

  const service = new CashSessionsService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => null } as never,
    { getUserId: () => userId } as never,
    { log: jest.fn() } as never,
    { assertCanOpenCashSession: jest.fn(), getCashSessionCapacity: jest.fn() } as never,
    { get: () => 'test-secret' } as never,
  );

  return { service, findFirst };
}

describe('CashSessionsService.getActive — relevo de turno y cajas múltiples', () => {
  it('con una sola caja abierta la devuelve aunque la abriera otro (relevo de turno)', async () => {
    const { service } = build({
      live: [{ id: 'cs-1', cashRegisterId: 'reg-1', openedById: 'cajero-saliente' }],
      userId: 'cajero-entrante',
    });

    const session = await service.getActive();

    expect(session?.id).toBe('cs-1');
  });

  it('con la caja de la terminal indicada devuelve esa, la abriera quien la abriera', async () => {
    const { service } = build({
      live: [
        { id: 'cs-1', cashRegisterId: 'reg-1', openedById: 'cajero-a' },
        { id: 'cs-2', cashRegisterId: 'reg-2', openedById: 'cajero-b' },
      ],
      userId: 'cajero-entrante',
    });

    const session = await service.getActive(undefined, 'reg-2');

    expect(session?.id).toBe('cs-2');
  });

  it('con varias abiertas y sin caja indicada devuelve la propia, no la del vecino', async () => {
    const { service } = build({
      live: [
        { id: 'cs-1', cashRegisterId: 'reg-1', openedById: 'cajero-a' },
        { id: 'cs-2', cashRegisterId: 'reg-2', openedById: 'cajero-b' },
      ],
      userId: 'cajero-b',
    });

    const session = await service.getActive();

    expect(session?.id).toBe('cs-2');
  });

  it('con varias abiertas, sin caja indicada y ninguna propia, no devuelve ninguna', async () => {
    const { service } = build({
      live: [
        { id: 'cs-1', cashRegisterId: 'reg-1', openedById: 'cajero-a' },
        { id: 'cs-2', cashRegisterId: 'reg-2', openedById: 'cajero-b' },
      ],
      userId: 'supervisor',
    });

    expect(await service.getActive()).toBeNull();
  });
});
