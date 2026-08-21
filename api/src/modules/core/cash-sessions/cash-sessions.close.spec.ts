import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CashSessionsService } from './cash-sessions.service';

/**
 * Fase 7 — cobertura del cierre, la parte del ciclo que la auditoría encontró
 * sin una sola prueba pese a concentrar dos hallazgos críticos: el cierre no era
 * atómico (CASH-002) y la diferencia podía quedar sin explicación (CASH-006).
 *
 * Cubre del checklist: caso que cuadra, faltante, sobrante, retiro con fondo
 * restante, cierre duplicado y dos cierres simultáneos.
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

interface BuildOpts {
  opening?: number;
  openingUsd?: number;
  movements?: Movement[];
  /** Filas afectadas por el reclamo. 0 simula que otro cierre ganó la carrera. */
  claimed?: number;
  /** `null` = la sesión no existe. */
  existing?: { id: string } | null;
  /** Umbral de diferencia del tenant; ausente equivale a 0. */
  threshold?: number;
}

function build(opts: BuildOpts = {}) {
  const {
    opening = 1000,
    openingUsd = 0,
    movements = [],
    claimed = 1,
    existing = { id: SESSION },
    threshold,
  } = opts;

  const updateMany = jest.fn().mockResolvedValue({ count: claimed });
  const update = jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: SESSION, ...args.data }),
  );
  const countCreate = jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'count-1', ...args.data }),
  );
  const auditLog = jest.fn();

  const tx = {
    cashSession: {
      updateMany,
      update,
      findFirst: jest.fn().mockResolvedValue(existing),
      findFirstOrThrow: jest.fn().mockResolvedValue({
        id: SESSION,
        openingAmount: opening,
        openingAmountUsd: openingUsd,
        notes: null,
        movements,
      }),
    },
    cashCount: { create: countCreate },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        settings: threshold === undefined ? {} : { cashDifferenceThreshold: threshold },
      }),
    },
  };

  const prisma = {
    // SUPER_ADMIN: `resolveCashAuthorizer` no pide PIN ni consulta permisos.
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'SUPER_ADMIN' }) },
    ...tx,
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const service = new CashSessionsService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => null } as never,
    { getUserId: () => 'user-1' } as never,
    { log: auditLog } as never,
    { assertCanOpenCashSession: jest.fn(), getCashSessionCapacity: jest.fn() } as never,
    { get: () => 'test-secret' } as never,
  );

  return { service, updateMany, update, countCreate, auditLog };
}

describe('CashSessionsService.close — arqueo y diferencias (Fase 7)', () => {
  it('caso normal: fondo 1000 + venta efectivo 5000, contado 6000 → cuadra', async () => {
    const { service, update, countCreate } = build({
      opening: 1000,
      movements: [{ type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 5000 }],
    });

    const result = await service.close(SESSION, { cashCounted: 6000 });

    expect(result.difference).toBe(0);
    expect(result.expectedAmount).toBe(6000); // el esperado, no lo contado
    // El arqueo FINAL congela el esperado del momento del conteo.
    const count = countCreate.mock.calls[0][0].data;
    expect(count.type).toBe('FINAL');
    expect(count.expectedMxn).toBe(6000);
    expect(count.countedMxn).toBe(6000);
    expect(count.differenceMxn).toBe(0);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('faltante: esperado 6000, contado 5800 → −200 (con motivo)', async () => {
    const { service, countCreate } = build({
      opening: 1000,
      movements: [{ type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 5000 }],
    });

    const result = await service.close(SESSION, {
      cashCounted: 5800,
      differenceReason: 'billete falso detectado',
    });

    expect(result.difference).toBe(-200);
    expect(result.differenceReason).toBe('billete falso detectado');
    expect(countCreate.mock.calls[0][0].data.differenceMxn).toBe(-200);
  });

  it('sobrante: esperado 6000, contado 6200 → +200 (con motivo)', async () => {
    const { service } = build({
      opening: 1000,
      movements: [{ type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 5000 }],
    });

    const result = await service.close(SESSION, {
      cashCounted: 6200,
      differenceReason: 'cobro no registrado',
    });

    expect(result.difference).toBe(200);
  });

  it('sin motivo, una diferencia por encima del umbral se rechaza (CASH-006)', async () => {
    const { service, countCreate } = build({
      opening: 1000,
      movements: [{ type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 5000 }],
    });

    await expect(service.close(SESSION, { cashCounted: 5800 })).rejects.toThrow(BadRequestException);
    expect(countCreate).not.toHaveBeenCalled();
  });

  it('el umbral del tenant tolera diferencias pequeñas sin motivo', async () => {
    const { service } = build({
      opening: 1000,
      movements: [{ type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 5000 }],
      threshold: 50,
    });

    // −20 queda dentro del umbral de 50.
    const result = await service.close(SESSION, { cashCounted: 5980 });
    expect(result.difference).toBe(-20);
  });

  it('retiro: contado 5500 con 4500 retirados durante la sesión → fondo restante 5500', async () => {
    const { service, update } = build({
      opening: 1000,
      movements: [
        { type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 9000 },
        { type: 'WITHDRAWAL', paymentMethod: 'CASH', currency: 'MXN', amount: 4500 },
      ],
    });

    // 1000 + 9000 − 4500 = 5500 esperados.
    const result = await service.close(SESSION, { cashCounted: 5500 });

    expect(result.difference).toBe(0);
    // El fondo restante es lo que queda físicamente y encadena con la apertura
    // siguiente; el retiro ya bajó el esperado, no se descuenta dos veces.
    expect(update.mock.calls[0][0].data.remainingFund).toBe(5500);
  });
});

describe('CashSessionsService.close — atomicidad (Fase 7 — CASH-002)', () => {
  it('cierre duplicado: la sesión ya cerrada se rechaza', async () => {
    // El reclamo condicionado a ABIERTA no afecta filas.
    const { service, update } = build({ claimed: 0 });

    await expect(service.close(SESSION, { cashCounted: 100 })).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('sesión inexistente: NotFound, no "ya cerrada"', async () => {
    const { service } = build({ claimed: 0, existing: null });

    await expect(service.close(SESSION, { cashCounted: 100 })).rejects.toThrow(NotFoundException);
  });

  it('CONCURRENCIA: dos cierres simultáneos, solo uno prospera', async () => {
    // Un único contador de reclamos compartido: el primer updateMany afecta una
    // fila, el segundo ninguna. Es la garantía que antes no existía, cuando ambos
    // leían ABIERTA y ambos escribían.
    let claims = 0;
    const { service } = build({
      opening: 1000,
      movements: [{ type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 5000 }],
    });
    // Reemplaza el mock por uno que solo concede el primer reclamo.
    const prisma = (service as unknown as { prisma: { cashSession: { updateMany: jest.Mock } } }).prisma;
    prisma.cashSession.updateMany = jest.fn().mockImplementation(() => {
      claims += 1;
      return Promise.resolve({ count: claims === 1 ? 1 : 0 });
    });

    const results = await Promise.allSettled([
      service.close(SESSION, { cashCounted: 6000 }),
      service.close(SESSION, { cashCounted: 6000 }),
    ]);

    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0]).reason).toBeInstanceOf(BadRequestException);
  });
});

describe('CashSessionsService.close — el esperado refleja devoluciones (Fase 7)', () => {
  it('venta 1000 en efectivo menos devolución de 300 → esperado 700', async () => {
    const { service } = build({
      opening: 0,
      movements: [
        { type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 1000 },
        // El reembolso se registra como EXPENSE con referenceType REFUND.
        { type: 'EXPENSE', paymentMethod: 'CASH', currency: 'MXN', amount: 300 },
      ],
    });

    const result = await service.close(SESSION, { cashCounted: 700 });

    expect(result.expectedAmount).toBe(700);
    expect(result.difference).toBe(0);
  });

  it('una venta con tarjeta no entra al efectivo esperado', async () => {
    const { service } = build({
      opening: 500,
      movements: [
        { type: 'SALE', paymentMethod: 'CARD', currency: 'MXN', amount: 3000 },
        { type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 200 },
      ],
    });

    // Solo el efectivo: 500 + 200.
    const result = await service.close(SESSION, { cashCounted: 700 });
    expect(result.expectedAmount).toBe(700);
    expect(result.difference).toBe(0);
  });
});
