import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { DiningOrdersService } from './dining-orders/dining-orders.service';

const TENANT_ID = 'tenant-abc';
const BRANCH_ID = 'branch-xyz';
const ORDER_ID = 'order-001';

const mockPrismaService = {
  diningOrder: { findMany: jest.fn() },
  product: { findMany: jest.fn() },
};

const mockTenantContext = {
  requireTenantId: jest.fn().mockReturnValue(TENANT_ID),
  getBranchId: jest.fn().mockReturnValue(BRANCH_ID),
};

const mockDiningOrders = {
  changeStatus: jest.fn(),
};

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    reference: 'Mesa 5',
    status: 'SENT_TO_KITCHEN',
    serviceType: 'DINE_IN',
    openedAt: new Date().toISOString(),
    table: { id: 'table-1', name: 'Mesa 5' },
    waiter: { id: 'emp-1', firstName: 'Ana', lastName: 'Lopez' },
    items: [],
    ...overrides,
  };
}

describe('KitchenService (DiningOrder KDS)', () => {
  let service: KitchenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KitchenService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TenantContextService, useValue: mockTenantContext },
        { provide: DiningOrdersService, useValue: mockDiningOrders },
      ],
    }).compile();

    service = module.get<KitchenService>(KitchenService);
    jest.clearAllMocks();
    mockTenantContext.requireTenantId.mockReturnValue(TENANT_ID);
    mockTenantContext.getBranchId.mockReturnValue(BRANCH_ID);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getKitchenOrders', () => {
    it('reads DiningOrder scoped to tenant + branch, only active kitchen statuses', async () => {
      mockPrismaService.diningOrder.findMany.mockResolvedValue([]);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      await service.getKitchenOrders();

      const call = mockPrismaService.diningOrder.findMany.mock.calls[0][0];
      expect(call.where.tenantId).toBe(TENANT_ID);
      expect(call.where.branchId).toBe(BRANCH_ID);
      const statuses: string[] = call.where.status.in;
      expect(statuses).toContain('SENT_TO_KITCHEN');
      expect(statuses).toContain('IN_PREPARATION');
      expect(statuses).toContain('READY');
      expect(statuses).not.toContain('OPEN');
      expect(statuses).not.toContain('DELIVERED');
    });

    it('omits branchId filter when no branch selected', async () => {
      mockTenantContext.getBranchId.mockReturnValue(null);
      mockPrismaService.diningOrder.findMany.mockResolvedValue([]);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      await service.getKitchenOrders();

      const call = mockPrismaService.diningOrder.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('branchId');
    });

    it('attaches resolved product (recipe/combo) to each item by productId', async () => {
      const order = makeOrder({
        items: [{ id: 'it-1', productId: 'prod-1', productName: 'Tacos', quantity: 2, notes: null }],
      });
      mockPrismaService.diningOrder.findMany.mockResolvedValue([order]);
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Tacos', type: 'RECIPE', recipe: { id: 'r1', items: [] }, comboItems: [] },
      ]);

      const result = await service.getKitchenOrders();

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: { in: ['prod-1'] }, tenantId: TENANT_ID }) }),
      );
      expect(result[0].items[0].product).toMatchObject({ id: 'prod-1', type: 'RECIPE' });
    });

    it('skips product lookup when there are no product items', async () => {
      const order = makeOrder({
        items: [{ id: 'it-1', productId: null, productName: 'Nota libre', quantity: 1, notes: null }],
      });
      mockPrismaService.diningOrder.findMany.mockResolvedValue([order]);

      const result = await service.getKitchenOrders();

      expect(mockPrismaService.product.findMany).not.toHaveBeenCalled();
      expect(result[0].items[0].product).toBeNull();
    });

    it('orders results by openedAt ascending', async () => {
      mockPrismaService.diningOrder.findMany.mockResolvedValue([]);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      await service.getKitchenOrders();

      const call = mockPrismaService.diningOrder.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ openedAt: 'asc' });
    });
  });

  describe('updateKitchenStatus', () => {
    it('delegates transition to DiningOrdersService.changeStatus with branch from context', async () => {
      mockDiningOrders.changeStatus.mockResolvedValue({ id: ORDER_ID, status: 'IN_PREPARATION' });

      await service.updateKitchenStatus(ORDER_ID, 'IN_PREPARATION' as never);

      expect(mockDiningOrders.changeStatus).toHaveBeenCalledWith(BRANCH_ID, ORDER_ID, 'IN_PREPARATION');
    });

    it('throws BadRequestException when no branch selected', async () => {
      mockTenantContext.getBranchId.mockReturnValue(null);

      await expect(
        service.updateKitchenStatus(ORDER_ID, 'IN_PREPARATION' as never),
      ).rejects.toThrow(BadRequestException);
      expect(mockDiningOrders.changeStatus).not.toHaveBeenCalled();
    });
  });
});
