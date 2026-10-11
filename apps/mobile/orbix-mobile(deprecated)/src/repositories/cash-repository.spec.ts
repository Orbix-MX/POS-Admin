/**
 * El mapeo DTO → dominio de caja, contra cuerpos copiados de lo que devuelve
 * `CashSessionsService`. Lo que se vigila aquí es lo que rompe en silencio: un
 * `Decimal` que llega como string y se pinta como `NaN`, un `null` que se
 * convierte en `0` y borra la distinción entre "sin cerrar" y "cerró en cero",
 * y el `summary` que hasta ahora se tiraba a la basura.
 */
import type { CashSessionDto, CashSessionListItemDto } from '@/dto/cash.dto';

import { __test } from './cash-repository';

// Se eleva por encima de los imports: el módulo de arriba se resuelve ya con
// el transporte mockeado. Estas pruebas son del mapeo, no de la red.
jest.mock('@/services/api', () => ({ http: {} }));

const { toSession, toListItem, toRegister, toMovement, toCount } = __test;

/** Sesión abierta tal cual la devuelve `GET /cash-sessions/active`. */
function openSessionDto(): CashSessionDto {
  return {
    id: 'sess-1',
    status: 'ABIERTA',
    branchId: 'branch-1',
    cashRegisterId: 'reg-1',
    exchangeRateUsdMxn: '19.4500',
    openingAmount: '500.00',
    openingAmountUsd: '20.00',
    expectedAmount: null,
    cashCounted: null,
    cashCountedUsd: null,
    difference: null,
    differenceUsd: null,
    differenceReason: null,
    notes: null,
    openedAt: '2026-09-11T15:00:00.000Z',
    closedAt: null,
    branch: { id: 'branch-1', name: 'Matriz' },
    openedBy: { id: 'user-1', email: 'cajero@tienda.com' },
    movements: [
      {
        id: 'mov-1',
        cashSessionId: 'sess-1',
        type: 'SALE',
        currency: 'MXN',
        amount: '120.00',
        exchangeRateUsed: null,
        amountOriginalCurrency: null,
        amountMxnEquivalent: null,
        paymentMethod: 'CASH',
        referenceId: 'order-1',
        referenceType: 'ORDER',
        notes: null,
        createdById: 'user-1',
        createdAt: '2026-09-11T15:30:00.000Z',
      },
    ],
    summary: {
      openingAmount: 500,
      openingAmountUsd: 20,
      expectedCash: 620,
      expectedCashUsd: 20,
      movementsCount: 1,
      totals: {
        sales: { cash: 120, cashUsd: 0, card: 0, transfer: 0, total: 120 },
        cxc: { cash: 0, cashUsd: 0, card: 0, transfer: 0, total: 0 },
        supplier: { cash: 0, cashUsd: 0, card: 0, transfer: 0, total: 0 },
        income: { cash: 0, cashUsd: 0, total: 0 },
        expense: { cash: 0, cashUsd: 0, total: 0 },
        withdrawal: { cash: 0, cashUsd: 0, total: 0 },
        refund: { cash: 0, cashUsd: 0, card: 0, transfer: 0, total: 0 },
      },
    },
  };
}

describe('toSession', () => {
  it('convierte los Decimal que llegan como string', () => {
    const session = toSession(openSessionDto());

    expect(session.openingAmount).toBe(500);
    expect(session.openingAmountUsd).toBe(20);
    expect(session.exchangeRateUsdMxn).toBe(19.45);
  });

  it('conserva el summary del servidor sin recalcularlo', () => {
    const session = toSession(openSessionDto());

    expect(session.summary).not.toBeNull();
    expect(session.summary?.expectedCash).toBe(620);
    expect(session.summary?.totals.sales.cash).toBe(120);
    expect(session.summary?.movementsCount).toBe(1);
  });

  it('distingue "sin cerrar" de "cerró en cero"', () => {
    const abierta = toSession(openSessionDto());
    expect(abierta.difference).toBeNull();
    expect(abierta.expectedAmount).toBeNull();

    const cerrada = toSession({
      ...openSessionDto(),
      status: 'CERRADA',
      expectedAmount: '620.00',
      cashCounted: '620.00',
      difference: '0.00',
      closedAt: '2026-09-11T22:00:00.000Z',
      closedBy: { id: 'user-2', email: 'duena@tienda.com' },
    });
    expect(cerrada.difference).toBe(0);
    expect(cerrada.expectedAmount).toBe(620);
    expect(cerrada.closedByEmail).toBe('duena@tienda.com');
  });

  it.each(['ABIERTA', 'EN_ARQUEO', 'PENDIENTE_REVISION', 'CERRADA'] as const)(
    'acepta el estado %s',
    (status) => {
      expect(toSession({ ...openSessionDto(), status }).status).toBe(status);
    },
  );

  it('sobrevive a una sesión sin relaciones ni summary', () => {
    const dto = openSessionDto();
    delete dto.movements;
    delete dto.summary;
    delete dto.branch;
    delete dto.openedBy;

    const session = toSession(dto);

    expect(session.movements).toEqual([]);
    expect(session.summary).toBeNull();
    expect(session.branchName).toBeNull();
    expect(session.openedByEmail).toBeNull();
  });
});

describe('toMovement', () => {
  it('usa amountMxnEquivalent cuando el movimiento es en USD', () => {
    const movement = toMovement({
      id: 'mov-2',
      cashSessionId: 'sess-1',
      type: 'SALE',
      currency: 'USD',
      amount: '10.00',
      exchangeRateUsed: '19.4500',
      amountOriginalCurrency: '10.00',
      amountMxnEquivalent: '194.50',
      paymentMethod: 'CASH',
      referenceId: null,
      referenceType: null,
      notes: null,
      createdById: null,
      createdAt: '2026-09-11T16:00:00.000Z',
    });

    expect(movement.amount).toBe(10);
    expect(movement.amountMxn).toBe(194.5);
  });

  it('cae al propio importe cuando ya es MXN', () => {
    const movement = toMovement({
      id: 'mov-3',
      cashSessionId: 'sess-1',
      type: 'EXPENSE',
      currency: 'MXN',
      amount: '150.00',
      exchangeRateUsed: null,
      amountOriginalCurrency: null,
      amountMxnEquivalent: null,
      paymentMethod: 'CASH',
      referenceId: null,
      referenceType: null,
      notes: 'Garrafón de agua',
      createdById: null,
      createdAt: '2026-09-11T17:00:00.000Z',
    });

    expect(movement.amountMxn).toBe(150);
    expect(movement.notes).toBe('Garrafón de agua');
  });
});

describe('toCount', () => {
  it('mapea el arqueo con su desglose por denominación', () => {
    const count = toCount({
      id: 'count-1',
      cashSessionId: 'sess-1',
      type: 'PARCIAL',
      countedMxn: '620.00',
      countedUsd: '20.00',
      expectedMxn: '620.00',
      expectedUsd: '20.00',
      differenceMxn: '0.00',
      differenceUsd: '0.00',
      denominations: { '500': 1, '100': 1, '20': 1 },
      reason: 'Cambio de turno',
      countedById: 'user-1',
      createdAt: '2026-09-11T18:00:00.000Z',
    });

    expect(count.countedMxn).toBe(620);
    expect(count.differenceMxn).toBe(0);
    expect(count.denominations).toEqual({ '500': 1, '100': 1, '20': 1 });
  });
});

describe('toListItem', () => {
  it('lee el conteo de movimientos del _count de Prisma', () => {
    const dto: CashSessionListItemDto = {
      id: 'sess-0',
      status: 'CERRADA',
      branchId: 'branch-1',
      cashRegisterId: 'reg-1',
      openingAmount: '500.00',
      openingAmountUsd: '0.00',
      expectedAmount: '1250.00',
      cashCounted: '1245.00',
      difference: '-5.00',
      openedAt: '2026-09-10T15:00:00.000Z',
      closedAt: '2026-09-10T22:00:00.000Z',
      branch: { id: 'branch-1', name: 'Matriz' },
      openedBy: { id: 'user-1', email: 'cajero@tienda.com' },
      closedBy: { id: 'user-1', email: 'cajero@tienda.com' },
      _count: { movements: 14 },
    };

    const item = toListItem(dto);

    expect(item.movementsCount).toBe(14);
    expect(item.difference).toBe(-5);
    expect(item.branchName).toBe('Matriz');
  });

  it('no explota sin _count', () => {
    expect(
      toListItem({
        id: 'sess-2',
        status: 'ABIERTA',
        branchId: null,
        cashRegisterId: null,
        openingAmount: 0,
        openingAmountUsd: null,
        expectedAmount: null,
        cashCounted: null,
        difference: null,
        openedAt: '2026-09-11T15:00:00.000Z',
        closedAt: null,
      }).movementsCount,
    ).toBe(0);
  });
});

describe('toRegister', () => {
  it('expone la sesión viva de la caja', () => {
    const register = toRegister({
      id: 'reg-1',
      tenantId: 't-1',
      branchId: 'branch-1',
      name: 'Caja 1',
      isActive: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      sessions: [
        {
          id: 'sess-1',
          status: 'ABIERTA',
          openedAt: '2026-09-11T15:00:00.000Z',
          openedBy: { email: 'cajero@tienda.com' },
        },
      ],
    });

    expect(register.liveSession?.id).toBe('sess-1');
    expect(register.liveSession?.openedByEmail).toBe('cajero@tienda.com');
  });

  it('trata una caja sin sesiones como libre', () => {
    const register = toRegister({
      id: 'reg-2',
      tenantId: 't-1',
      branchId: 'branch-1',
      name: 'Caja 2',
      isActive: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      sessions: [],
    });

    expect(register.liveSession).toBeNull();
  });

  it('trata la respuesta de POST /registers (sin relaciones) como libre', () => {
    const register = toRegister({
      id: 'reg-3',
      tenantId: 't-1',
      branchId: 'branch-1',
      name: 'Caja 3',
      isActive: true,
      createdAt: '2026-09-11T00:00:00.000Z',
      updatedAt: '2026-09-11T00:00:00.000Z',
    });

    expect(register.liveSession).toBeNull();
  });
});
