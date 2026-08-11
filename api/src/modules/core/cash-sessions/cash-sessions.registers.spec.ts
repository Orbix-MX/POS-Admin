import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CashSessionsService } from './cash-sessions.service';

/**
 * Fase 8 — caja física y reembolsos.
 *
 * `CashRegister` es lo que permite más de una caja por sucursal: antes la
 * sesión *era* la caja, y el índice único por sucursal impedía abrir una
 * segunda. También cubre que un reembolso deje de contarse como egreso manual
 * (CASH-013).
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';

interface Opts {
  /** Cajas activas que ya existen en la sucursal. */
  registers?: { id: string; name: string }[];
  /** Sesión viva encontrada en el pre-chequeo. */
  liveSession?: { id: string } | null;
}

function build({ registers = [{ id: 'reg-1', name: 'Caja 1' }], liveSession = null }: Opts = {}) {
  const sessionCreate = jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'cs-1', ...args.data }),
  );
  const registerCreate = jest.fn().mockResolvedValue({ id: 'reg-nuevo' });

  const prisma = {
    cashSession: {
      findFirst: jest.fn().mockResolvedValue(liveSession),
      create: sessionCreate,
    },
    cashRegister: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) => {
        if (where.id) return Promise.resolve(registers.find((r) => r.id === where.id) ?? null);
        return Promise.resolve(registers[0] ?? null);
      }),
      findMany: jest.fn().mockResolvedValue(registers),
      create: registerCreate,
    },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) =>
      cb({ cashSession: { create: sessionCreate } }),
    ),
  };

  const service = new CashSessionsService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => BRANCH } as never,
    { getUserId: () => 'user-1' } as never,
    { log: jest.fn() } as never,
  );

  return { service, sessionCreate, registerCreate, prisma };
}

const dto = { exchangeRateUsdMxn: 20, openingAmount: 500 };

describe('CashSessionsService.open — caja física (Fase 8)', () => {
  it('sin caja indicada usa la primera activa de la sucursal', async () => {
    const { service, sessionCreate } = build();

    await service.open(dto as never);

    expect(sessionCreate.mock.calls[0][0].data.cashRegisterId).toBe('reg-1');
  });

  it('abre en la caja indicada cuando hay varias en la sucursal', async () => {
    const { service, sessionCreate } = build({
      registers: [
        { id: 'reg-1', name: 'Caja 1' },
        { id: 'reg-2', name: 'Caja 2' },
      ],
    });

    await service.open({ ...dto, cashRegisterId: 'reg-2' } as never);

    expect(sessionCreate.mock.calls[0][0].data.cashRegisterId).toBe('reg-2');
  });

  it('una caja inexistente se rechaza en vez de caer en otra', async () => {
    const { service, sessionCreate } = build();

    await expect(
      service.open({ ...dto, cashRegisterId: 'reg-fantasma' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(sessionCreate).not.toHaveBeenCalled();
  });

  it('sucursal sin cajas: crea "Caja 1" para no exigir un alta manual previa', async () => {
    const { service, registerCreate, sessionCreate } = build({ registers: [] });

    await service.open(dto as never);

    expect(registerCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Caja 1', branchId: BRANCH }) }),
    );
    expect(sessionCreate.mock.calls[0][0].data.cashRegisterId).toBe('reg-nuevo');
  });

  it('rechaza abrir si esa misma caja ya tiene una sesión viva', async () => {
    const { service, sessionCreate } = build({ liveSession: { id: 'cs-viva' } });

    await expect(service.open(dto as never)).rejects.toThrow(BadRequestException);
    expect(sessionCreate).not.toHaveBeenCalled();
  });

  it('el pre-chequeo mira la caja, no la sucursal, y excluye solo las CERRADAS', async () => {
    const { service, prisma } = build();

    await service.open(dto as never);

    expect(prisma.cashSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT, cashRegisterId: 'reg-1', status: { not: 'CERRADA' } },
      }),
    );
  });
});

describe('buildSummary — el reembolso no es un egreso manual (Fase 8 — CASH-013)', () => {
  const { service } = build();

  it('REFUND tiene fila propia y no se mezcla con los egresos', () => {
    const summary = service.buildSummary(1000, 0, [
      { type: 'EXPENSE', paymentMethod: 'CASH', currency: 'MXN', amount: 50 },
      { type: 'REFUND', paymentMethod: 'CASH', currency: 'MXN', amount: 300 },
    ]);

    expect(summary.totals.expense.cash).toBe(50);
    expect(summary.totals.refund.cash).toBe(300);
  });

  it('el reembolso sigue bajando el efectivo esperado', () => {
    const summary = service.buildSummary(1000, 0, [
      { type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 500 },
      { type: 'REFUND', paymentMethod: 'CASH', currency: 'MXN', amount: 300 },
    ]);

    // 1000 + 500 − 300
    expect(summary.expectedCash).toBe(1200);
  });

  it('un reembolso con tarjeta no toca el efectivo pero sí su fila', () => {
    const summary = service.buildSummary(1000, 0, [
      { type: 'REFUND', paymentMethod: 'CARD', currency: 'MXN', amount: 400 },
    ]);

    expect(summary.expectedCash).toBe(1000);
    expect(summary.totals.refund.card).toBe(400);
    expect(summary.totals.refund.cash).toBe(0);
  });
});
