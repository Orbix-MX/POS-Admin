import { BadRequestException } from '@nestjs/common';

import { CashSessionsService } from './cash-sessions.service';

/**
 * Fases 5 y 6 — retiro de efectivo y multi-moneda en el resumen.
 *
 * Cubre los dos hallazgos que quedaban de la auditoría en esta área: el retiro
 * no existía como concepto (CASH-005) y las columnas de tarjeta/transferencia
 * sumaban importes en USD junto a pesos (CASH-010).
 */

const TENANT = 'tenant-1';
const SESSION = 'cs-1';

type Movement = {
  type: string;
  paymentMethod: string;
  currency: string;
  amount: number;
  amountMxnEquivalent?: number;
};

function build(movements: Movement[], opening = 500, openingUsd = 0) {
  const create = jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'mov-1', ...args.data }),
  );
  const session = {
    id: SESSION,
    openingAmount: opening,
    openingAmountUsd: openingUsd,
    exchangeRateUsdMxn: 20,
    movements,
  };

  const prisma = {
    // SUPER_ADMIN: `resolveCashAuthorizer` no pide PIN ni consulta permisos.
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'SUPER_ADMIN' }) },
    cashSession: {
      findFirst: jest.fn().mockResolvedValue({ id: SESSION }),
      findFirstOrThrow: jest.fn().mockResolvedValue(session),
    },
    cashMovement: { create },
  };

  const service = new CashSessionsService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => null } as never,
    { getUserId: () => 'user-1' } as never,
    { log: jest.fn() } as never,
    { assertCanOpenCashSession: jest.fn(), getCashSessionCapacity: jest.fn() } as never,
    { get: () => 'test-secret' } as never,
  );

  return { service, create };
}

describe('CashSessionsService.withdrawCash (Fase 5 — CASH-005)', () => {
  it('registra el retiro como movimiento WITHDRAWAL en efectivo', async () => {
    const { service, create } = build([]);

    await service.withdrawCash({ amount: 200, reason: 'Traslado a caja fuerte' });

    const data = create.mock.calls[0][0].data;
    expect(data.type).toBe('WITHDRAWAL');
    expect(data.paymentMethod).toBe('CASH');
    expect(data.amount).toBe(200);
    expect(data.cashSessionId).toBe(SESSION);
    expect(data.notes).toBe('Traslado a caja fuerte');
  });

  it('rechaza retirar más efectivo del disponible', async () => {
    // Fondo 500, sin movimientos → disponible 500.
    const { service, create } = build([]);

    await expect(
      service.withdrawCash({ amount: 500.01, reason: 'de más' }),
    ).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('el disponible considera las ventas en efectivo de la sesión', async () => {
    const { service, create } = build([
      { type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 300 },
    ]);

    // 500 de fondo + 300 vendidos = 800 disponibles.
    await service.withdrawCash({ amount: 800, reason: 'corte de turno' });
    expect(create.mock.calls[0][0].data.amount).toBe(800);
  });

  it('retiro en USD se valida contra el efectivo en USD, no contra el de pesos', async () => {
    const { service, create } = build([], 10_000, 50);

    // Hay 10 000 MXN pero solo 50 USD: 60 USD debe rechazarse.
    await expect(
      service.withdrawCash({ amount: 60, currency: 'USD', reason: 'usd' }),
    ).rejects.toThrow(BadRequestException);

    await service.withdrawCash({ amount: 50, currency: 'USD', reason: 'usd' });
    const data = create.mock.calls[0][0].data;
    expect(data.currency).toBe('USD');
    expect(data.amountMxnEquivalent).toBe(1000); // 50 × TC 20
  });
});

describe('calculateExpectedCash — el retiro baja el esperado (CASH-005)', () => {
  const service = build([]).service;

  it('resta el retiro del efectivo esperado', () => {
    const expected = service.calculateExpectedCash(
      1000,
      [
        { type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 500 },
        { type: 'WITHDRAWAL', paymentMethod: 'CASH', currency: 'MXN', amount: 900 },
      ],
      'MXN',
    );
    // 1000 + 500 − 900
    expect(expected).toBe(600);
  });
});

describe('buildSummary — divisas separadas en no-efectivo (Fase 6 — CASH-010)', () => {
  const service = build([]).service;

  it('una venta con tarjeta en USD no suma dólares crudos a la columna de pesos', () => {
    const summary = service.buildSummary(0, 0, [
      { type: 'SALE', paymentMethod: 'CARD', currency: 'MXN', amount: 100 },
      // 20 USD a TC 20 = 400 MXN
      { type: 'SALE', paymentMethod: 'CARD', currency: 'USD', amount: 20, amountMxnEquivalent: 400 },
    ]);

    // Antes daba 120: sumaba 20 dólares como si fueran 20 pesos.
    expect(summary.totals.sales.card).toBe(500);
  });

  it('transferencia en USD se convierte igual que la tarjeta', () => {
    const summary = service.buildSummary(0, 0, [
      { type: 'SALE', paymentMethod: 'TRANSFER', currency: 'USD', amount: 10, amountMxnEquivalent: 200 },
    ]);
    expect(summary.totals.sales.transfer).toBe(200);
  });

  it('el retiro tiene su propia fila y no se mezcla con los egresos', () => {
    const summary = service.buildSummary(1000, 0, [
      { type: 'EXPENSE', paymentMethod: 'CASH', currency: 'MXN', amount: 50 },
      { type: 'WITHDRAWAL', paymentMethod: 'CASH', currency: 'MXN', amount: 300 },
    ]);

    expect(summary.totals.expense.cash).toBe(50);
    expect(summary.totals.withdrawal.cash).toBe(300);
    // 1000 − 50 − 300
    expect(summary.expectedCash).toBe(650);
  });
});
