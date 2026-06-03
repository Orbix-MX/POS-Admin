import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { AuditContextService } from '../../common/context/audit-context.service';
import { KitchenOrderStatus } from './dto/update-kitchen-status.dto';

const TENANT_ID = 'tenant-abc';
const BRANCH_ID = 'branch-xyz';
const USER_ID   = 'user-111';
const ORDER_ID  = 'order-001';

const mockPrismaService = {
  order: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockTenantContext = {
  requireTenantId: jest.fn().mockReturnValue(TENANT_ID),
  getBranchId: jest.fn().mockReturnValue(BRANCH_ID),
};

const mockAuditContext = {
  getUserId: jest.fn().mockReturnValue(USER_ID),
};

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    orderNumber: 'C-001',
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    tableNumber: '5',
    employeeNumber: 'E01',
    kitchenStatus: KitchenOrderStatus.PENDING,
    kitchenStartedAt: null,
    kitchenReadyAt: null,
    kitchenPausedAt: null,
    kitchenRejectedAt: null,
    kitchenRejectedById: null,
    kitchenRejectionComment: null,
    notes: null,
    createdAt: new Date().toISOString(),
    items: [],
    createdBy: null,
    ...overrides,
  };
}

describe('KitchenService', () => {
  let service: KitchenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KitchenService,
        { provide: PrismaService,        useValue: mockPrismaService   },
        { provide: TenantContextService, useValue: mockTenantContext   },
        { provide: AuditContextService,  useValue: mockAuditContext    },
      ],
    }).compile();

    service = module.get<KitchenService>(KitchenService);
    jest.clearAllMocks();
    mockTenantContext.requireTenantId.mockReturnValue(TENANT_ID);
    mockTenantContext.getBranchId.mockReturnValue(BRANCH_ID);
    mockAuditContext.getUserId.mockReturnValue(USER_ID);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getKitchenOrders ────────────────────────────────────────────────────────

  describe('getKitchenOrders', () => {
    it('returns active orders scoped to tenant + branch', async () => {
      const orders = [makeOrder(), makeOrder({ id: 'order-002', kitchenStatus: KitchenOrderStatus.IN_PROGRESS })];
      mockPrismaService.order.findMany.mockResolvedValue(orders);

      const result = await service.getKitchenOrders();

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            branchId: BRANCH_ID,
            kitchenStatus: { in: expect.arrayContaining(['PENDING', 'IN_PROGRESS', 'PAUSED', 'READY']) },
          }),
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no active kitchen orders exist', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);

      const result = await service.getKitchenOrders();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('omits branchId filter when no branch selected', async () => {
      mockTenantContext.getBranchId.mockReturnValue(null);
      mockPrismaService.order.findMany.mockResolvedValue([]);

      await service.getKitchenOrders();

      const call = mockPrismaService.order.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('branchId');
    });

    it('filters only active statuses (not REJECTED or DELIVERED)', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);

      await service.getKitchenOrders();

      const call = mockPrismaService.order.findMany.mock.calls[0][0];
      const statuses: string[] = call.where.kitchenStatus.in;
      expect(statuses).toContain('PENDING');
      expect(statuses).toContain('IN_PROGRESS');
      expect(statuses).toContain('PAUSED');
      expect(statuses).toContain('READY');
      expect(statuses).not.toContain('REJECTED');
      expect(statuses).not.toContain('DELIVERED');
    });

    it('orders results by createdAt ascending', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);

      await service.getKitchenOrders();

      const call = mockPrismaService.order.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: 'asc' });
    });
  });

  // ─── updateKitchenStatus ─────────────────────────────────────────────────────

  describe('updateKitchenStatus', () => {
    it('throws NotFoundException when order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(
        service.updateKitchenStatus(ORDER_ID, { status: KitchenOrderStatus.IN_PROGRESS }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for invalid transition (PENDING → READY)', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(makeOrder());

      await expect(
        service.updateKitchenStatus(ORDER_ID, { status: KitchenOrderStatus.READY }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid transition (DELIVERED → anything)', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(
        makeOrder({ kitchenStatus: KitchenOrderStatus.DELIVERED }),
      );

      await expect(
        service.updateKitchenStatus(ORDER_ID, { status: KitchenOrderStatus.IN_PROGRESS }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when rejecting without comment', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(makeOrder());

      await expect(
        service.updateKitchenStatus(ORDER_ID, { status: KitchenOrderStatus.REJECTED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when rejecting with blank comment', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(makeOrder());

      await expect(
        service.updateKitchenStatus(ORDER_ID, {
          status: KitchenOrderStatus.REJECTED,
          rejectionComment: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('PENDING → IN_PROGRESS sets kitchenStartedAt', async () => {
      const order = makeOrder();
      mockPrismaService.order.findFirst.mockResolvedValue(order);
      mockPrismaService.order.update.mockResolvedValue({
        ...order,
        kitchenStatus: KitchenOrderStatus.IN_PROGRESS,
      });

      await service.updateKitchenStatus(ORDER_ID, { status: KitchenOrderStatus.IN_PROGRESS });

      const updateCall = mockPrismaService.order.update.mock.calls[0][0];
      expect(updateCall.data.kitchenStatus).toBe(KitchenOrderStatus.IN_PROGRESS);
      expect(updateCall.data.kitchenStartedAt).toBeInstanceOf(Date);
    });

    it('does not overwrite kitchenStartedAt when already set (resume from pause)', async () => {
      const existingStart = new Date('2026-01-01T10:00:00Z');
      const order = makeOrder({
        kitchenStatus: KitchenOrderStatus.PAUSED,
        kitchenStartedAt: existingStart,
      });
      mockPrismaService.order.findFirst.mockResolvedValue(order);
      mockPrismaService.order.update.mockResolvedValue({
        ...order,
        kitchenStatus: KitchenOrderStatus.IN_PROGRESS,
      });

      await service.updateKitchenStatus(ORDER_ID, { status: KitchenOrderStatus.IN_PROGRESS });

      const updateCall = mockPrismaService.order.update.mock.calls[0][0];
      expect(updateCall.data.kitchenStartedAt).toEqual(existingStart);
    });

    it('IN_PROGRESS → PAUSED sets kitchenPausedAt', async () => {
      const order = makeOrder({ kitchenStatus: KitchenOrderStatus.IN_PROGRESS });
      mockPrismaService.order.findFirst.mockResolvedValue(order);
      mockPrismaService.order.update.mockResolvedValue({ ...order, kitchenStatus: KitchenOrderStatus.PAUSED });

      await service.updateKitchenStatus(ORDER_ID, { status: KitchenOrderStatus.PAUSED });

      const updateCall = mockPrismaService.order.update.mock.calls[0][0];
      expect(updateCall.data.kitchenPausedAt).toBeInstanceOf(Date);
    });

    it('IN_PROGRESS → READY sets kitchenReadyAt', async () => {
      const order = makeOrder({ kitchenStatus: KitchenOrderStatus.IN_PROGRESS });
      mockPrismaService.order.findFirst.mockResolvedValue(order);
      mockPrismaService.order.update.mockResolvedValue({ ...order, kitchenStatus: KitchenOrderStatus.READY });

      await service.updateKitchenStatus(ORDER_ID, { status: KitchenOrderStatus.READY });

      const updateCall = mockPrismaService.order.update.mock.calls[0][0];
      expect(updateCall.data.kitchenReadyAt).toBeInstanceOf(Date);
    });

    it('PENDING → REJECTED saves comment + timestamps + rejectedById', async () => {
      const order = makeOrder();
      mockPrismaService.order.findFirst.mockResolvedValue(order);
      mockPrismaService.order.update.mockResolvedValue({ ...order, kitchenStatus: KitchenOrderStatus.REJECTED });

      await service.updateKitchenStatus(ORDER_ID, {
        status: KitchenOrderStatus.REJECTED,
        rejectionComment: 'Falta ingrediente',
      });

      const updateCall = mockPrismaService.order.update.mock.calls[0][0];
      expect(updateCall.data.kitchenStatus).toBe(KitchenOrderStatus.REJECTED);
      expect(updateCall.data.kitchenRejectedAt).toBeInstanceOf(Date);
      expect(updateCall.data.kitchenRejectedById).toBe(USER_ID);
      expect(updateCall.data.kitchenRejectionComment).toBe('Falta ingrediente');
    });

    it('READY → DELIVERED sets deliveryStatus and deliveredAt', async () => {
      const order = makeOrder({ kitchenStatus: KitchenOrderStatus.READY });
      mockPrismaService.order.findFirst.mockResolvedValue(order);
      mockPrismaService.order.update.mockResolvedValue({ ...order, kitchenStatus: KitchenOrderStatus.DELIVERED });

      await service.updateKitchenStatus(ORDER_ID, { status: KitchenOrderStatus.DELIVERED });

      const updateCall = mockPrismaService.order.update.mock.calls[0][0];
      expect(updateCall.data.kitchenStatus).toBe(KitchenOrderStatus.DELIVERED);
      expect(updateCall.data.deliveryStatus).toBe('DELIVERED');
      expect(updateCall.data.deliveredAt).toBeInstanceOf(Date);
    });

    it('always scopes findFirst to tenantId + branchId', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      try {
        await service.updateKitchenStatus(ORDER_ID, { status: KitchenOrderStatus.IN_PROGRESS });
      } catch {
        // NotFoundException expected
      }

      const findCall = mockPrismaService.order.findFirst.mock.calls[0][0];
      expect(findCall.where.tenantId).toBe(TENANT_ID);
      expect(findCall.where.branchId).toBe(BRANCH_ID);
    });

    it('sets updatedById from audit context on every update', async () => {
      const order = makeOrder();
      mockPrismaService.order.findFirst.mockResolvedValue(order);
      mockPrismaService.order.update.mockResolvedValue({ ...order, kitchenStatus: KitchenOrderStatus.IN_PROGRESS });

      await service.updateKitchenStatus(ORDER_ID, { status: KitchenOrderStatus.IN_PROGRESS });

      const updateCall = mockPrismaService.order.update.mock.calls[0][0];
      expect(updateCall.data.updatedById).toBe(USER_ID);
    });
  });
});
