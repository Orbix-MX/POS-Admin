import { BadRequestException } from '@nestjs/common';
import { DiningOrdersService } from './dining-orders.service';

/**
 * Auditoría del flujo de cocina sobre DiningOrder. Cubre el núcleo que vive en
 * DiningOrdersService:
 *  - fireRound: envío de una ronda (crea KitchenRound, sella SOLO los ítems
 *    pendientes, avanza el estado) — soporta rondas múltiples sin duplicar la
 *    orden ni re-enviar lo ya preparado.
 *  - changeStatus: grafo de transiciones SENT_TO_KITCHEN → IN_PREPARATION →
 *    READY → READY_FOR_PAYMENT (con cocina), rechazando saltos inválidos.
 * Servicio construido con mocks para evitar el ruido de Nest DI. isKitchenEnabled
 * se controla con un spy (independiente de la config de plan/módulos).
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';
const ORDER = 'order-1';

function build(opts: { orderStatus?: string; pending?: number; lastRound?: number | null; tableId?: string | null } = {}) {
  const orderStatus = opts.orderStatus ?? 'OPEN';
  const pending = opts.pending ?? 2;
  const lastRound = opts.lastRound ?? null;
  const tableId = opts.tableId ?? null;

  // Cliente de transacción para fireRound: numeración de rondas + sellado de ítems.
  const tx = {
    kitchenRound: {
      findFirst: jest.fn().mockResolvedValue(lastRound != null ? { roundNumber: lastRound } : null),
      create: jest.fn(({ data }: { data: { roundNumber: number; orderId: string; sentAt: Date } }) =>
        Promise.resolve({ id: `round-${data.roundNumber}`, ...data })),
    },
    diningOrderItem: {
      updateMany: jest.fn().mockResolvedValue({ count: pending }),
    },
    diningOrder: {
      update: jest.fn(({ data }: { data: { status: string } }) =>
        Promise.resolve({ id: ORDER, status: data.status, items: [] })),
    },
  };

  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: BRANCH }) }, // assertBranchBelongs
    diningOrder: {
      // requireEditableOrder (status notIn locked) y changeStatus comparten findFirst.
      findFirst: jest.fn().mockResolvedValue({ id: ORDER, status: orderStatus, tableId }),
      update: jest.fn(({ data }: { data: { status: string } }) =>
        Promise.resolve({ id: ORDER, status: data.status, items: [] })),
    },
    diningOrderItem: { count: jest.fn().mockResolvedValue(pending) },
    restaurantTable: { update: jest.fn().mockResolvedValue({}) },
    // fireRound pasa un callback; changeStatus (libera mesa) pasa un arreglo.
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (t: typeof tx) => Promise<unknown>)(tx)
        : Promise.all(arg as Promise<unknown>[])),
  };

  const service = new DiningOrdersService(
    prisma as never,
    { requireTenantId: () => TENANT } as never,
    { getUserId: () => 'user-1' } as never,
    { consume: jest.fn(), restore: jest.fn(), validate: jest.fn() } as never,
    { resolveActiveCashSession: jest.fn(), createPayments: jest.fn(), createCashMovements: jest.fn() } as never,
    { resolveRestaurantVisibilityMode: jest.fn().mockResolvedValue('SHARED') } as never,
  );

  const setKitchen = (enabled: boolean) =>
    jest
      .spyOn(service as unknown as { isKitchenEnabled(t: string): Promise<boolean> }, 'isKitchenEnabled')
      .mockResolvedValue(enabled);

  return { service, prisma, tx, setKitchen };
}

describe('DiningOrder — flujo de cocina', () => {
  // ── fireRound (envío de ronda) ─────────────────────────────────────────────
  describe('fireRound', () => {
    it('1) OPEN → SENT_TO_KITCHEN: crea la ronda 1, sella SOLO los pendientes y avanza estado', async () => {
      const { service, tx, setKitchen } = build({ orderStatus: 'OPEN', pending: 2, lastRound: null });
      setKitchen(true);

      const res = await service.fireRound(BRANCH, ORDER) as { status: string };

      // 6) KitchenRound: primera ronda = roundNumber 1, con sentAt.
      expect(tx.kitchenRound.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ orderId: ORDER, roundNumber: 1 }) }),
      );
      expect(tx.kitchenRound.create.mock.calls[0][0].data.sentAt).toBeInstanceOf(Date);

      // Sella SOLO ítems pendientes (sentToKitchenAt null) con la ronda creada.
      const upd = tx.diningOrderItem.updateMany.mock.calls[0][0];
      expect(upd.where).toEqual(expect.objectContaining({ orderId: ORDER, sentToKitchenAt: null }));
      expect(upd.data.kitchenRoundId).toBe('round-1');
      expect(upd.data.sentToKitchenAt).toBeInstanceOf(Date);

      expect(res.status).toBe('SENT_TO_KITCHEN');
    });

    it('sin cocina: fireRound lleva la cuenta directo a READY_FOR_PAYMENT', async () => {
      const { service, tx, setKitchen } = build({ orderStatus: 'OPEN', pending: 2 });
      setKitchen(false);

      const res = await service.fireRound(BRANCH, ORDER) as { status: string };

      // Igual se crea la ronda (registro de envío) pero el estado salta a cobro.
      expect(tx.kitchenRound.create).toHaveBeenCalled();
      expect(res.status).toBe('READY_FOR_PAYMENT');
    });

    it('5/8) segunda ronda: incrementa roundNumber a 2 sobre la MISMA orden y reabre el KDS', async () => {
      // La cuenta ya está en preparación; se capturó y envía una ronda nueva.
      const { service, tx, setKitchen } = build({ orderStatus: 'IN_PREPARATION', pending: 1, lastRound: 1 });
      setKitchen(true);

      const res = await service.fireRound(BRANCH, ORDER) as { status: string };

      expect(tx.kitchenRound.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ roundNumber: 2 }) }),
      );
      // Vuelve a SENT_TO_KITCHEN: la orden reentra a la cola sin duplicarse.
      expect(res.status).toBe('SENT_TO_KITCHEN');
    });

    it('7) reenvío: sin productos pendientes rechaza (no re-envía lo ya preparado)', async () => {
      const { service, tx, setKitchen } = build({ orderStatus: 'IN_PREPARATION', pending: 0, lastRound: 1 });
      setKitchen(true);

      await expect(service.fireRound(BRANCH, ORDER)).rejects.toBeInstanceOf(BadRequestException);
      // No crea ronda ni sella nada cuando no hay pendientes.
      expect(tx.kitchenRound.create).not.toHaveBeenCalled();
      expect(tx.diningOrderItem.updateMany).not.toHaveBeenCalled();
    });
  });

  // ── changeStatus (grafo de transiciones, cocina habilitada) ────────────────
  describe('changeStatus (KITCHEN_FLOW)', () => {
    const ok = async (from: string, to: string) => {
      const { service, setKitchen } = build({ orderStatus: from });
      setKitchen(true);
      const res = await service.changeStatus(BRANCH, ORDER, to as never) as { status: string };
      expect(res.status).toBe(to);
    };
    const invalid = async (from: string, to: string) => {
      const { service, setKitchen } = build({ orderStatus: from });
      setKitchen(true);
      await expect(service.changeStatus(BRANCH, ORDER, to as never)).rejects.toBeInstanceOf(BadRequestException);
    };

    it('2) SENT_TO_KITCHEN → IN_PREPARATION', () => ok('SENT_TO_KITCHEN', 'IN_PREPARATION'));
    it('3) IN_PREPARATION → READY', () => ok('IN_PREPARATION', 'READY'));
    it('4) READY → READY_FOR_PAYMENT', () => ok('READY', 'READY_FOR_PAYMENT'));

    it('rechaza salto inválido SENT_TO_KITCHEN → READY (sin pasar por preparación)', () =>
      invalid('SENT_TO_KITCHEN', 'READY'));
    it('rechaza retroceso IN_PREPARATION → SENT_TO_KITCHEN', () =>
      invalid('IN_PREPARATION', 'SENT_TO_KITCHEN'));
    it('rechaza avanzar desde READY_FOR_PAYMENT (estado de hand-off, sin salidas)', () =>
      invalid('READY_FOR_PAYMENT', 'PAID'));
  });
});
