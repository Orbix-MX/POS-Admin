import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CashSessionsService } from './cash-sessions.service';
import { requireOpenSession } from '../../../common/helpers/cash-session.helper';

/**
 * CASH-011 — el ciclo de caja recorre sus estados intermedios.
 *
 * Los estados existían en el enum desde la Fase 5 pero el servicio iba de
 * ABIERTA a CERRADA directo, así que no podía representarse «contando, caja
 * congelada» ni «corte hecho, esperando autorización».
 *
 *   ABIERTA ──start-count──► EN_ARQUEO ──resume──► ABIERTA
 *      │                         │
 *      └──────── close ──────────┘
 *                  │
 *        ┌─────────┴──────────┐
 *   dentro del umbral    fuera del umbral
 *        │                    │
 *     CERRADA        PENDIENTE_REVISION ──closeWithAuth──► CERRADA
 */

const TENANT = 'tenant-1';
const SESSION = 'cs-1';

type Movement = { type: string; paymentMethod: string; currency: string; amount: number };

interface Opts {
  status?: string;
  movements?: Movement[];
  opening?: number;
  threshold?: number;
}

function build({ status = 'ABIERTA', movements = [], opening = 1000, threshold }: Opts = {}) {
  // Estado en memoria: el updateMany solo prospera si el estado actual está
  // entre los admitidos, igual que hace el `where` contra Postgres.
  const state = { status };

  const updateMany = jest.fn().mockImplementation(
    ({ where, data }: { where: { status?: { in: string[] } }; data: { status: string } }) => {
      const allowed = where.status?.in ?? [];
      if (!allowed.includes(state.status)) return Promise.resolve({ count: 0 });
      state.status = data.status;
      return Promise.resolve({ count: 1 });
    },
  );

  const update = jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
    if (typeof args.data.status === 'string') state.status = args.data.status;
    return Promise.resolve({ id: SESSION, ...args.data });
  });

  const sessionRow = () => ({
    id: SESSION,
    status: state.status,
    openingAmount: opening,
    openingAmountUsd: 0,
    notes: null,
    movements,
  });

  const tx = {
    cashSession: {
      updateMany,
      update,
      findFirst: jest.fn().mockImplementation(({ where }: { where: { status?: unknown } }) => {
        // Usado tanto para el diagnóstico del reclamo fallido como por
        // requireOpenSession, que solo acepta ABIERTA.
        if (where.status === 'ABIERTA' && state.status !== 'ABIERTA') return Promise.resolve(null);
        return Promise.resolve(sessionRow());
      }),
      findFirstOrThrow: jest.fn().mockImplementation(() => Promise.resolve(sessionRow())),
    },
    cashCount: { create: jest.fn().mockResolvedValue({ id: 'count-1' }) },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        settings: threshold === undefined ? {} : { cashDifferenceThreshold: threshold },
      }),
    },
  };

  const prisma = {
    ...tx,
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const auditLog = jest.fn();
  const service = new CashSessionsService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => null } as never,
    { getUserId: () => 'user-1' } as never,
    { log: auditLog } as never,
  );

  return { service, prisma, state, update, auditLog };
}

describe('Ciclo de caja — arqueo (CASH-011)', () => {
  it('start-count congela la caja: ABIERTA → EN_ARQUEO', async () => {
    const { service, state, auditLog } = build();

    await service.startCount(SESSION);

    expect(state.status).toBe('EN_ARQUEO');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CASH_COUNT_START' }),
    );
  });

  it('mientras cuenta, ningún movimiento entra a la caja', async () => {
    const { service, prisma, state } = build();
    await service.startCount(SESSION);
    expect(state.status).toBe('EN_ARQUEO');

    // requireOpenSession exige ABIERTA: es lo que congela el efectivo mientras
    // el cajero cuenta, para que no se mueva bajo sus pies.
    await expect(requireOpenSession(prisma as never, TENANT, null)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('resume devuelve la caja a operación: EN_ARQUEO → ABIERTA', async () => {
    const { service, state, prisma } = build({ status: 'EN_ARQUEO' });

    await service.resumeOperation(SESSION);

    expect(state.status).toBe('ABIERTA');
    // Y vuelve a admitir movimientos.
    await expect(requireOpenSession(prisma as never, TENANT, null)).resolves.toEqual({ id: SESSION });
  });

  it('no se puede arquear una caja que ya está en arqueo', async () => {
    const { service } = build({ status: 'EN_ARQUEO' });
    await expect(service.startCount(SESSION)).rejects.toThrow(BadRequestException);
  });

  it('no se puede reanudar una caja que nunca entró en arqueo', async () => {
    const { service } = build({ status: 'ABIERTA' });
    await expect(service.resumeOperation(SESSION)).rejects.toThrow(BadRequestException);
  });

  it('una sesión inexistente da NotFound, no un error de transición', async () => {
    // El reclamo no afecta filas y el diagnóstico posterior no encuentra la
    // sesión: es el caso "id inválido", distinto de "estado incompatible".
    const { service, prisma } = build({ status: 'CERRADA' });
    prisma.cashSession.findFirst = jest.fn().mockResolvedValue(null);
    await expect(service.startCount(SESSION)).rejects.toThrow(NotFoundException);
  });
});

describe('Ciclo de caja — revisión del corte (CASH-011)', () => {
  const cuadra = [{ type: 'SALE', paymentMethod: 'CASH', currency: 'MXN', amount: 5000 }];

  it('sin diferencia el corte cierra en el acto', async () => {
    const { service, state } = build({ movements: cuadra });

    await service.close(SESSION, { cashCounted: 6000 });

    expect(state.status).toBe('CERRADA');
  });

  it('una diferencia sobre el umbral deja el corte PENDIENTE_REVISION, no CERRADA', async () => {
    const { service, state, update } = build({ movements: cuadra });

    await service.close(SESSION, {
      cashCounted: 5800,
      differenceReason: 'faltante detectado',
    });

    // El arqueo queda registrado y la diferencia explicada, pero la sesión no se
    // da por cerrada sin que alguien la autorice.
    expect(state.status).toBe('PENDIENTE_REVISION');
    expect(update.mock.calls[0][0].data.closedAt).toBeUndefined();
    expect(update.mock.calls[0][0].data.difference).toBe(-200);
  });

  it('dentro del umbral del tenant sí cierra pese a la diferencia', async () => {
    const { service, state } = build({ movements: cuadra, threshold: 500 });

    await service.close(SESSION, { cashCounted: 5800 });

    expect(state.status).toBe('CERRADA');
  });

  it('un corte en revisión no puede cerrarse por la vía normal', async () => {
    const { service } = build({ status: 'PENDIENTE_REVISION', movements: cuadra });

    await expect(service.close(SESSION, { cashCounted: 5800 })).rejects.toThrow(
      /pendiente de revisión/i,
    );
  });

  it('el corte también puede hacerse desde EN_ARQUEO', async () => {
    const { service, state } = build({ status: 'EN_ARQUEO', movements: cuadra });

    await service.close(SESSION, { cashCounted: 6000 });

    expect(state.status).toBe('CERRADA');
  });

  it('la caja en revisión sigue congelada: no admite movimientos', async () => {
    const { prisma } = build({ status: 'PENDIENTE_REVISION' });
    await expect(requireOpenSession(prisma as never, TENANT, null)).rejects.toThrow(
      BadRequestException,
    );
  });
});
