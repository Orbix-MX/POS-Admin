import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../../database/prisma.service';
import { CouponsService } from '../coupons/coupons.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
  };

  const mockCouponsService = {
    getAutoApplicableCoupons: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CouponsService, useValue: mockCouponsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated orders', async () => {
      const paginationDto = { page: 1, limit: 10, skip: 0 };
      const mockOrders = [
        {
          id: '1',
          orderNumber: 'ORD-001',
          total: 100,
          customer: { id: '1', firstName: 'John' },
          items: [],
          payment: null,
        },
      ];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);
      mockPrismaService.order.count.mockResolvedValue(1);

      const result = await service.findAll(paginationDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return an order by id', async () => {
      const orderId = '1';
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-001',
        customer: { id: '1', firstName: 'John' },
        shippingAddress: {},
        items: [],
        payment: null,
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.findOne(orderId);

      expect(result.id).toBe(orderId);
      expect(result.orderNumber).toBe('ORD-001');
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      const orderId = '1';
      const newStatus = 'CONFIRMED';
      const mockOrder = {
        id: orderId,
        status: 'PENDING',
      };

      const updatedOrder = { ...mockOrder, status: newStatus };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue(updatedOrder);

      const result = await service.updateStatus(orderId, newStatus as any);

      expect(result.status).toBe(newStatus);
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus('invalid-id', 'CONFIRMED' as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('should return order statistics', async () => {
      mockPrismaService.order.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10);
      mockPrismaService.order.aggregate.mockResolvedValue({
        _sum: { total: 50000 },
      });
      mockPrismaService.order.findMany.mockResolvedValue([
        {
          id: '1',
          orderNumber: 'ORD-001',
          customer: {},
          _count: { items: 2 },
        },
      ]);

      const result = await service.getStats();

      expect(result.totalOrders).toBe(100);
      expect(result.totalRevenue).toBe(50000);
      expect(result.pendingOrders).toBe(10);
      expect(result.recentOrders).toHaveLength(1);
    });
  });
});
