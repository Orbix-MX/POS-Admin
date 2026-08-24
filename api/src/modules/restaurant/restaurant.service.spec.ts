import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { AuditContextService } from '../../common/context/audit-context.service';
import { InventoryConsumptionEngine } from '../retail/inventory/inventory-consumption.engine';
import { OrderCheckoutEngine } from '../retail/checkout/order-checkout.engine';

const TENANT_ID = 'tenant-abc';
const BRANCH_ID = 'branch-xyz';
const USER_ID   = 'user-111';
const ORDER_ID  = 'order-001';

// Mock $transaction: runs callback with same tx object (mirrors Prisma behavior)
function mockTransaction(tx: object) {
  return jest.fn().mockImplementation((cb: (tx: object) => Promise<unknown>) => cb(tx));
}

const txMock = {
  order: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  orderItem: { create: jest.fn() },
  product:   { findUnique: jest.fn(), updateMany: jest.fn() },
  payment:   { create: jest.fn() },
  cashMovement: { create: jest.fn() },
  cashSession: { findFirst: jest.fn() },
};

const mockPrismaService = {
  $transaction: mockTransaction(txMock),
  order: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
  },
  // Todo `productId` del body se valida contra el tenant antes de crear la
  // comanda (`assertProductsInTenant`). Por defecto los ids de estos tests son
  // del tenant; los casos de producto ajeno viven en su propio spec.
  product: {
    findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(where.id.in.map((id) => ({ id }))),
    ),
  },
  cashSession: { findFirst: jest.fn() },
};

const mockTenantContext = {
  requireTenantId: jest.fn().mockReturnValue(TENANT_ID),
  getBranchId:     jest.fn().mockReturnValue(BRANCH_ID),
};

const mockAuditContext = {
  getUserId: jest.fn().mockReturnValue(USER_ID),
};

const mockInventory = {
  consume: jest.fn(),
  restore: jest.fn(),
  validate: jest.fn(),
};

const mockCheckout = {
  resolveActiveCashSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
  createPayments: jest.fn(),
  createCashMovements: jest.fn(),
};

function makeComandaDto(overrides: Record<string, unknown> = {}) {
  return {
    tableNumber:    '5',
    employeeNumber: 'E01',
    items: [
      { itemType: 'PRODUCT' as const, productId: 'prod-1', name: 'Burger', quantity: 2, price: 80 },
      { itemType: 'PRODUCT' as const, productId: 'prod-2', name: 'Papas',  quantity: 1, price: 40 },
    ],
    ...overrides,
  };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id:             ORDER_ID,
    orderNumber:    'C-001',
    tenantId:       TENANT_ID,
    branchId:       BRANCH_ID,
    tableNumber:    '5',
    employeeNumber: 'E01',
    status:         'PENDING',
    paymentStatus:  'PENDING',
    kitchenStatus:  'PENDING',
    total:          200,
    subtotal:       200,
    items: [],
    ...overrides,
  };
}

describe('RestaurantService', () => {
  let service: RestaurantService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantService,
        { provide: PrismaService,        useValue: mockPrismaService  },
        { provide: TenantContextService, useValue: mockTenantContext  },
        { provide: AuditContextService,  useValue: mockAuditContext   },
        { provide: InventoryConsumptionEngine, useValue: mockInventory },
        { provide: OrderCheckoutEngine, useValue: mockCheckout },
      ],
    }).compile();

    service = module.get<RestaurantService>(RestaurantService);
    jest.clearAllMocks();

    mockTenantContext.requireTenantId.mockReturnValue(TENANT_ID);
    mockTenantContext.getBranchId.mockReturnValue(BRANCH_ID);
    mockAuditContext.getUserId.mockReturnValue(USER_ID);
    mockCheckout.resolveActiveCashSession.mockResolvedValue({ id: 'session-1' });
    mockPrismaService.$transaction.mockImplementation(
      (cb: (tx: object) => Promise<unknown>) => cb(txMock),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── createComanda ───────────────────────────────────────────────────────────

  describe('createComanda', () => {
    beforeEach(() => {
      const created = makeOrder();
      txMock.order.create.mockResolvedValue(created);
      txMock.orderItem.create.mockResolvedValue({});
      txMock.order.findUnique.mockResolvedValue({ ...created, items: [] });
    });

    it('throws BadRequestException when items array is empty', async () => {
      await expect(
        service.createComanda({ tableNumber: '5', employeeNumber: 'E01', items: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when items is undefined', async () => {
      await expect(
        service.createComanda({ tableNumber: '5', employeeNumber: 'E01', items: undefined as never }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates order with kitchenStatus PENDING', async () => {
      await service.createComanda(makeComandaDto());

      const createCall = txMock.order.create.mock.calls[0][0];
      expect(createCall.data.kitchenStatus).toBe('PENDING');
    });

    it('creates order with correct tenantId and branchId', async () => {
      await service.createComanda(makeComandaDto());

      const createCall = txMock.order.create.mock.calls[0][0];
      expect(createCall.data.tenantId).toBe(TENANT_ID);
      expect(createCall.data.branchId).toBe(BRANCH_ID);
    });

    it('sets tableNumber and employeeNumber on order', async () => {
      await service.createComanda(makeComandaDto({ tableNumber: '12', employeeNumber: 'E99' }));

      const createCall = txMock.order.create.mock.calls[0][0];
      expect(createCall.data.tableNumber).toBe('12');
      expect(createCall.data.employeeNumber).toBe('E99');
    });

    it('computes subtotal correctly from items (2×80 + 1×40 = 200)', async () => {
      await service.createComanda(makeComandaDto());

      const createCall = txMock.order.create.mock.calls[0][0];
      expect(Number(createCall.data.subtotal)).toBe(200);
      expect(Number(createCall.data.total)).toBe(200);
    });

    it('creates one orderItem per dto item', async () => {
      await service.createComanda(makeComandaDto());

      expect(txMock.orderItem.create).toHaveBeenCalledTimes(2);
    });

    it('sets initial order status to PENDING', async () => {
      await service.createComanda(makeComandaDto());

      const createCall = txMock.order.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('PENDING');
      expect(createCall.data.paymentStatus).toBe('PENDING');
    });

    it('omits branchId when no branch selected', async () => {
      mockTenantContext.getBranchId.mockReturnValue(null);

      await service.createComanda(makeComandaDto());

      const createCall = txMock.order.create.mock.calls[0][0];
      expect(createCall.data.branchId).toBeUndefined();
    });
  });

  // ─── getOpenTables ───────────────────────────────────────────────────────────

  describe('getOpenTables', () => {
    it('returns orders with tableNumber and PENDING paymentStatus', async () => {
      const orders = [makeOrder(), makeOrder({ id: 'order-002', tableNumber: '7' })];
      mockPrismaService.order.findMany.mockResolvedValue(orders);

      const result = await service.getOpenTables();

      expect(result).toHaveLength(2);
      const query = mockPrismaService.order.findMany.mock.calls[0][0];
      expect(query.where.tenantId).toBe(TENANT_ID);
      expect(query.where.branchId).toBe(BRANCH_ID);
      expect(query.where.paymentStatus).toBe('PENDING');
      expect(query.where.tableNumber).toEqual({ not: null });
    });

    it('returns empty array when no open tables exist', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);

      const result = await service.getOpenTables();

      expect(result).toEqual([]);
    });

    it('omits branchId filter when no branch selected', async () => {
      mockTenantContext.getBranchId.mockReturnValue(null);
      mockPrismaService.order.findMany.mockResolvedValue([]);

      await service.getOpenTables();

      const query = mockPrismaService.order.findMany.mock.calls[0][0];
      expect(query.where).not.toHaveProperty('branchId');
    });

    it('orders results by createdAt ascending', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);

      await service.getOpenTables();

      const query = mockPrismaService.order.findMany.mock.calls[0][0];
      expect(query.orderBy).toEqual({ createdAt: 'asc' });
    });
  });

  // ─── checkoutComanda ─────────────────────────────────────────────────────────

  describe('checkoutComanda', () => {
    // Multi-payment dto matching CheckoutComandaDto; total order is 200.
    const dto = { payments: [{ paymentMethod: 'CASH', amount: 200 }] };

    it('throws NotFoundException when order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.checkoutComanda(ORDER_ID, dto)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when order has no tableNumber', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(makeOrder({ tableNumber: null }));

      await expect(service.checkoutComanda(ORDER_ID, dto)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when order already paid', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(
        makeOrder({ paymentStatus: 'PAID' }),
      );

      await expect(service.checkoutComanda(ORDER_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no active cash session', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(makeOrder({ items: [] }));
      mockCheckout.resolveActiveCashSession.mockRejectedValue(new BadRequestException('no session'));

      await expect(service.checkoutComanda(ORDER_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when payment is insufficient', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(makeOrder({ items: [] }));

      await expect(
        service.checkoutComanda(ORDER_ID, { payments: [{ paymentMethod: 'CASH', amount: 50 }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('delegates inventory consumption to the engine on checkout', async () => {
      const items = [{ id: 'item-1', itemType: 'PRODUCT', productId: 'prod-1', quantity: 2, name: 'Burger' }];
      const order = makeOrder({ items });
      mockPrismaService.order.findFirst.mockResolvedValue(order);
      txMock.order.update.mockResolvedValue(makeOrder({ status: 'DELIVERED', paymentStatus: 'PAID' }));

      await service.checkoutComanda(ORDER_ID, dto);

      expect(mockInventory.consume).toHaveBeenCalledTimes(1);
      const [, lines, ctx] = mockInventory.consume.mock.calls[0];
      expect(lines).toEqual([{ productId: 'prod-1', quantity: 2, itemType: 'PRODUCT' }]);
      expect(ctx).toEqual(expect.objectContaining({ referenceId: ORDER_ID, referenceType: 'ORDER' }));
    });

    // `checkoutComanda` crea el pago y el movimiento de caja en línea dentro de
    // su transacción; no delega en OrderCheckoutEngine (solo le pide la sesión
    // activa). La prueba afirmaba la delegación y por eso fallaba.
    it('completes checkout: registers payment and cash movement, updates order to DELIVERED+PAID', async () => {
      const order = makeOrder({ items: [] });
      mockPrismaService.order.findFirst.mockResolvedValue(order);
      const finalOrder = makeOrder({ status: 'DELIVERED', paymentStatus: 'PAID' });
      txMock.order.update.mockResolvedValue(finalOrder);

      const result = await service.checkoutComanda(ORDER_ID, dto);

      expect(mockCheckout.resolveActiveCashSession).toHaveBeenCalledTimes(1);
      expect(txMock.payment.create).toHaveBeenCalledTimes(1);
      expect(txMock.cashMovement.create).toHaveBeenCalledTimes(1);
      // Todo movimiento debe quedar atado a la sesión abierta (CASH-001).
      expect(txMock.cashMovement.create.mock.calls[0][0].data.cashSessionId).toBe('session-1');
      expect(txMock.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DELIVERED', paymentStatus: 'PAID' }),
        }),
      );
      expect(result.status).toBe('DELIVERED');
      expect(result.paymentStatus).toBe('PAID');
    });
  });
});
