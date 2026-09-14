/**
 * Atribución del turno: qué movió cada persona, y quién estuvo en la caja.
 *
 * `CashSession` solo nombra a dos —`openedById` y `closedById`— y el dominio
 * admite que sean distintas. Con un relevo en medio, el operador intermedio no
 * aparecía en ninguna parte del corte, y averiguar de quién era un faltante
 * obligaba a recorrer los movimientos uno a uno.
 *
 * Se cubre con dos piezas y las dos se prueban aquí:
 *   A · `summary.byUser[]` — quién movió cuánto (derivado de los movimientos).
 *   B · bitácora de relevos — quién estuvo (presencia, no actividad).
 */
import { BadRequestException } from '@nestjs/common';

import { CashSessionsService } from './cash-sessions.service';

const TENANT = 'tenant-1';
const SESSION = 'cs-1';

type Mov = {
  type: string;
  paymentMethod: string;
  currency: string;
  amount: number;
  amountMxnEquivalent?: number;
  createdById?: string | null;
  createdBy?: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
};

function ana(): NonNullable<Mov['createdBy']> {
  return { id: 'u-ana', firstName: 'Ana', lastName: 'Ruiz', email: 'ana@tienda.com' };
}
function beto(): NonNullable<Mov['createdBy']> {
  return { id: 'u-beto', firstName: 'Beto', lastName: 'Lara', email: 'beto@tienda.com' };
}

function cash(type: string, amount: number, by: NonNullable<Mov['createdBy']> | null): Mov {
  return {
    type,
    paymentMethod: 'CASH',
    currency: 'MXN',
    amount,
    createdById: by?.id ?? null,
    createdBy: by,
  };
}

/** Servicio con lo mínimo para ejercitar `buildSummary`, que es puro. */
function summaryService(): CashSessionsService {
  return new CashSessionsService(
    {} as never,
    { requireTenantId: () => TENANT, getBranchId: () => null } as never,
    { getUserId: () => 'u-ana' } as never,
    { log: jest.fn() } as never,
    {} as never,
    { get: () => 'secret' } as never,
  );
}

describe('A · summary.byUser — qué movió cada persona', () => {
  const service = summaryService();

  it('separa a dos operadores del mismo turno', () => {
    const summary = service.buildSummary(1000, 0, [
      cash('SALE', 200, ana()),
      cash('SALE', 300, ana()),
      cash('SALE', 150, beto()),
    ] as never);

    const byUser = summary.byUser;
    expect(byUser).toHaveLength(2);

    const a = byUser.find((u) => u.userId === 'u-ana');
    const b = byUser.find((u) => u.userId === 'u-beto');
    expect(a?.sales).toBe(500);
    expect(b?.sales).toBe(150);
    expect(a?.name).toBe('Ana Ruiz');
  });

  it('el neto de cajón resta lo que cada quien sacó', () => {
    const summary = service.buildSummary(1000, 0, [
      cash('SALE', 500, ana()),
      cash('EXPENSE', 120, ana()),
      cash('WITHDRAWAL', 300, ana()),
    ] as never);

    const a = summary.byUser[0];
    // 500 − 120 − 300 = 80 que Ana dejó de más en el cajón.
    expect(a.netCash).toBe(80);
    expect(a.expense).toBe(120);
    expect(a.withdrawal).toBe(300);
  });

  it('el neto ignora tarjeta: no deja billetes que puedan faltar', () => {
    const summary = service.buildSummary(0, 0, [
      { type: 'SALE', paymentMethod: 'CARD', currency: 'MXN', amount: 900, createdById: 'u-ana', createdBy: ana() },
      cash('SALE', 100, ana()),
    ] as never);

    const a = summary.byUser[0];
    expect(a.sales).toBe(1000); // vendió mil
    expect(a.netCash).toBe(100); // pero solo cien en efectivo
  });

  it('cuenta el USD por su equivalente para poder sumarlo', () => {
    const summary = service.buildSummary(0, 0, [
      {
        type: 'SALE',
        paymentMethod: 'CASH',
        currency: 'USD',
        amount: 10,
        amountMxnEquivalent: 194.5,
        createdById: 'u-ana',
        createdBy: ana(),
      },
    ] as never);

    const a = summary.byUser[0];
    expect(a.sales).toBe(194.5);
    // El USD se cuenta y se descuadra aparte: no entra en el neto en pesos.
    expect(a.netCash).toBe(0);
  });

  it('los movimientos sin autor tienen su propio cubo, no se pierden', () => {
    // La FK es SetNull: borrar a una persona no borra su dinero de la caja.
    const summary = service.buildSummary(0, 0, [
      cash('SALE', 400, null),
      cash('SALE', 100, ana()),
    ] as never);

    const huerfano = summary.byUser.find((u) => u.userId === null);
    expect(huerfano?.sales).toBe(400);
    expect(huerfano?.name).toBe('Sin usuario');
  });

  it('cae al correo cuando la persona no tiene nombre', () => {
    const summary = service.buildSummary(0, 0, [
      cash('SALE', 50, { id: 'u-x', firstName: null, lastName: null, email: 'x@tienda.com' }),
    ] as never);

    expect(summary.byUser[0].name).toBe('x@tienda.com');
  });

  it('ordena por quién movió más — es por donde se busca un faltante', () => {
    const summary = service.buildSummary(0, 0, [
      cash('SALE', 10, ana()),
      cash('SALE', 10, beto()),
      cash('SALE', 10, beto()),
      cash('SALE', 10, beto()),
    ] as never);

    expect(summary.byUser[0].userId).toBe('u-beto');
    expect(summary.byUser[0].movementsCount).toBe(3);
  });

  it('el desglose por persona cuadra con el total de la sesión', () => {
    const movements = [
      cash('SALE', 500, ana()),
      cash('SALE', 300, beto()),
      cash('EXPENSE', 150, beto()),
    ] as never as Mov[];

    const summary = service.buildSummary(1000, 0, movements as never);
    const netoPorPersona = summary.byUser.reduce((sum, u) => sum + u.netCash, 0);

    // Fondo + lo que entre todos dejaron = el esperado del corte.
    expect(1000 + netoPorPersona).toBe(summary.expectedCash);
  });

  it('un turno sin movimientos no inventa operadores', () => {
    expect(service.buildSummary(1000, 0, []).byUser).toEqual([]);
  });
});

describe('B · bitácora de relevos — quién estuvo en la caja', () => {
  function build(opts: { userId: string | null; current?: { id: string; userId: string | null } | null }) {
    const findFirstSession = jest.fn().mockResolvedValue({ id: SESSION });
    const findFirstHandover = jest.fn().mockResolvedValue(opts.current ?? null);
    const update = jest.fn().mockResolvedValue({});
    const create = jest
      .fn()
      .mockImplementation(({ data }) => Promise.resolve({ id: 'h-new', ...data }));

    const prisma = {
      cashSession: { findFirst: findFirstSession },
      cashSessionHandover: { findFirst: findFirstHandover, update, create },
    };

    const service = new CashSessionsService(
      prisma as never,
      { requireTenantId: () => TENANT, getBranchId: () => null } as never,
      { getUserId: () => opts.userId } as never,
      { log: jest.fn() } as never,
      {} as never,
      { get: () => 'secret' } as never,
    );

    return { service, update, create, findFirstSession };
  }

  it('abre el primer tramo cuando nadie había tomado la caja', async () => {
    const { service, create, update } = build({ userId: 'u-ana', current: null });

    await service.registerHandover();

    expect(create).toHaveBeenCalledWith({
      data: { tenantId: TENANT, cashSessionId: SESSION, userId: 'u-ana' },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('el relevo cierra el tramo anterior y abre el suyo', async () => {
    const { service, create, update } = build({
      userId: 'u-beto',
      current: { id: 'h-ana', userId: 'u-ana' },
    });

    await service.registerHandover();

    // El tramo de Ana se cierra AQUÍ, con la entrada de Beto: en un móvil no
    // hay evento de salida fiable.
    expect(update).toHaveBeenCalledWith({
      where: { id: 'h-ana' },
      data: { leftAt: expect.any(Date) },
    });
    expect(create).toHaveBeenCalledWith({
      data: { tenantId: TENANT, cashSessionId: SESSION, userId: 'u-beto' },
    });
  });

  it('es idempotente: reabrir la app no duplica el tramo', async () => {
    const { service, create, update } = build({
      userId: 'u-ana',
      current: { id: 'h-ana', userId: 'u-ana' },
    });

    const result = await service.registerHandover();

    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'h-ana', userId: 'u-ana' });
  });

  it('sin caja viva no se registra nada', async () => {
    const { service, findFirstSession, create } = build({ userId: 'u-ana' });
    findFirstSession.mockResolvedValue(null);

    await expect(service.registerHandover()).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('busca la sesión viva sin exigir ABIERTA — estar en una caja en arqueo también cuenta', async () => {
    const { service, findFirstSession } = build({ userId: 'u-ana', current: null });

    await service.registerHandover();

    expect(findFirstSession.mock.calls[0][0].where.status).toEqual({ not: 'CERRADA' });
  });
});
