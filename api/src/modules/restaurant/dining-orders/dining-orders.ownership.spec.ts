import { NotFoundException } from '@nestjs/common';
import { DiningOrdersService } from './dining-orders.service';
import { RestaurantVisibilityService } from '../visibility/restaurant-visibility.service';

/**
 * Enforcement de ownership por recurso (anti-IDOR). Aquí el `RestaurantVisibilityService`
 * es REAL (no mock): se prueba el cableado extremo a extremo en DiningOrdersService.
 *
 * Garantía objetivo: cuando una sucursal pasa a OWN_ONLY, un operador NO puede
 * leer ni mutar por id una comanda ajena, aunque conozca el id (vía mesas/cocina
 * globales). La respuesta es NotFoundException (no revela existencia).
 *
 * Con SHARED (default de todas las sucursales) el enforcement es transparente:
 * acceso total, igual que hoy. checkout/open/cleanupEmpty NO se protegen.
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';
const TABLE = 'table-1';
const ORDER = 'do-1';
const OPERATOR = 'emp-operador';
const OTHER = 'emp-otro';

type Mode = 'SHARED' | 'OWN_ONLY' | 'OWN_WITH_SUPERVISOR';

/**
 * Construye el service con visibilidad real. `ownerId` es el mesero dueño de la
 * orden que devuelve la BD; `mode` el modo de la sucursal; `isOperator` el tipo
 * de principal. La misma fila de `branch` satisface assertBranchBelongs (id) y
 * la resolución del modo (restaurantVisibilityMode).
 */
function build(opts: { mode?: Mode; ownerId?: string; isOperator?: boolean } = {}) {
  const { mode = 'OWN_ONLY', ownerId = OTHER, isOperator = true } = opts;

  const orderRow = {
    id: ORDER,
    status: 'OPEN',
    tableId: TABLE,
    branchId: BRANCH,
    waiterId: ownerId,
    reference: null,
    openedAt: new Date(),
    closedAt: null,
    table: { id: TABLE, name: 'Mesa 1', capacity: 4 },
    waiter: { id: ownerId, firstName: 'Otro', lastName: 'Mesero' },
    items: [],
    _count: { items: 0 },
  };

  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: BRANCH, restaurantVisibilityMode: mode }) },
    diningOrder: {
      findFirst: jest.fn().mockResolvedValue(orderRow),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: ORDER }),
      update: jest.fn().mockResolvedValue({ id: ORDER }),
    },
    diningOrderItem: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'item-1' }),
      count: jest.fn().mockResolvedValue(0),
    },
    employee: { findFirst: jest.fn().mockResolvedValue({ id: OPERATOR }) },
    tenant: { findUnique: jest.fn().mockResolvedValue(null) }, // cocina deshabilitada
  };

  const tenantContext = { requireTenantId: () => TENANT };
  const auditContext = { isOperator: () => isOperator, getUserId: () => OPERATOR };

  const visibility = new RestaurantVisibilityService(
    prisma as never,
    tenantContext as never,
    auditContext as never,
  );
  const spy = jest.spyOn(visibility, 'assertCanAccessOrder');

  const service = new DiningOrdersService(
    prisma as never,
    tenantContext as never,
    auditContext as never,
    { consume: jest.fn(), restore: jest.fn(), validate: jest.fn() } as never,
    { resolveActiveCashSession: jest.fn(), createPayments: jest.fn(), createCashMovements: jest.fn() } as never,
    visibility,
  );

  return { service, spy, prisma };
}

describe('DiningOrdersService — ownership por recurso (anti-IDOR)', () => {
  describe('OWN_ONLY: acceso por id a una comanda AJENA → NotFoundException', () => {
    it('findOne (lectura por id)', async () => {
      const { service, spy } = build();
      await expect(service.findOne(BRANCH, ORDER)).rejects.toBeInstanceOf(NotFoundException);
      expect(spy).toHaveBeenCalledWith({ waiterId: OTHER, branchId: BRANCH });
    });

    it('findForTable (lectura por mesa: protege el detalle, no la ocupación)', async () => {
      const { service } = build();
      await expect(service.findForTable(BRANCH, TABLE)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('addItem (escritura vía requireEditableOrder)', async () => {
      const { service } = build();
      await expect(
        service.addItem(BRANCH, ORDER, { productName: 'Taco', unitPrice: 10, quantity: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('fireRound (escritura vía requireEditableOrder)', async () => {
      const { service } = build();
      await expect(service.fireRound(BRANCH, ORDER)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('changeStatus (escritura por id)', async () => {
      const { service } = build();
      await expect(
        service.changeStatus(BRANCH, ORDER, 'READY_FOR_PAYMENT'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('discardIfEmpty (escritura por id)', async () => {
      const { service } = build();
      await expect(service.discardIfEmpty(BRANCH, ORDER)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('OWN_ONLY: la comanda PROPIA del operador es accesible', () => {
    it('findOne devuelve la orden propia', async () => {
      const { service } = build({ ownerId: OPERATOR });
      await expect(service.findOne(BRANCH, ORDER)).resolves.toEqual(expect.objectContaining({ id: ORDER }));
    });
  });

  describe('SHARED: enforcement transparente (acceso total, como hoy)', () => {
    it('findOne sobre comanda ajena NO lanza', async () => {
      const { service } = build({ mode: 'SHARED', ownerId: OTHER });
      await expect(service.findOne(BRANCH, ORDER)).resolves.toEqual(expect.objectContaining({ id: ORDER }));
    });
  });

  describe('Usuario administrativo (no operador): acceso total', () => {
    it('findOne sobre comanda ajena bajo OWN_ONLY NO lanza (caja/admin inmunes)', async () => {
      const { service } = build({ mode: 'OWN_ONLY', ownerId: OTHER, isOperator: false });
      await expect(service.findOne(BRANCH, ORDER)).resolves.toEqual(expect.objectContaining({ id: ORDER }));
    });
  });

  describe('Puntos NO protegidos: checkout / open / cleanupEmpty no consultan ownership', () => {
    it('checkout NO invoca assertCanAccessOrder', async () => {
      const { service, spy } = build();
      await service.checkout(BRANCH, ORDER, { payments: [] }).catch(() => undefined);
      expect(spy).not.toHaveBeenCalled();
    });

    it('open NO invoca assertCanAccessOrder', async () => {
      const { service, spy } = build();
      await service.open(BRANCH, { serviceType: 'COUNTER', reference: 'Mostrador' } as never).catch(() => undefined);
      expect(spy).not.toHaveBeenCalled();
    });

    it('cleanupEmptyOrders NO invoca assertCanAccessOrder', async () => {
      const { service, spy } = build();
      await service.cleanupEmptyOrders(BRANCH, 120).catch(() => undefined);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
