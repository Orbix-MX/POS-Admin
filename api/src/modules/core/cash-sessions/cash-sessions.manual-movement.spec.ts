import { CashSessionsService } from './cash-sessions.service';

/**
 * P1-01 — Caja multi-sucursal (Retail).
 *
 * Un movimiento manual de efectivo debe resolverse SIEMPRE contra la CashSession
 * de la sucursal del operador (tenant + branch + ABIERTA). Antes el lookup omitía
 * branchId y tomaba cualquier caja abierta del tenant → cruce entre sucursales.
 */

const TENANT = 'tenant-1';

/**
 * Service con dos sucursales con caja ABIERTA (A y B). `findFirst` enruta por el
 * branchId recibido: devuelve la sesión de esa sucursal o null si no tiene caja.
 */
function build(branchId: string | null) {
  const sessionsByBranch: Record<string, { id: string }> = {
    'branch-A': { id: 'cs-A' },
    'branch-B': { id: 'cs-B' },
  };

  const findFirst = jest.fn(
    ({ where }: { where: { branchId?: string } }) =>
      Promise.resolve(where.branchId ? (sessionsByBranch[where.branchId] ?? null) : null),
  );
  const create = jest.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'mov-1', ...args.data }),
  );

  const prisma = { cashSession: { findFirst }, cashMovement: { create } };

  const service = new CashSessionsService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => branchId } as never,
    { getUserId: () => 'user-1' } as never,
  );

  return { service, findFirst, create };
}

const dto = { type: 'INCOME' as never, amount: 100, reason: 'ajuste' };

describe('CashSessionsService.createManualMovement (P1-01 — multi-sucursal)', () => {
  it('dos sucursales abiertas: el movimiento de la sucursal A usa la caja de A (no la de B)', async () => {
    const { service, findFirst, create } = build('branch-A');

    await service.createManualMovement(dto);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT, branchId: 'branch-A', status: 'ABIERTA' } }),
    );
    expect(create.mock.calls[0][0].data.cashSessionId).toBe('cs-A');
  });

  it('movimiento en la sucursal B usa la caja de B', async () => {
    const { service, create } = build('branch-B');
    await service.createManualMovement(dto);
    expect(create.mock.calls[0][0].data.cashSessionId).toBe('cs-B');
  });

  it('sucursal sin caja abierta: cashSessionId null (no toma la caja de otra sucursal)', async () => {
    const { service, create } = build('branch-sin-caja');
    await service.createManualMovement(dto);
    expect(create.mock.calls[0][0].data.cashSessionId).toBeNull();
  });
});
