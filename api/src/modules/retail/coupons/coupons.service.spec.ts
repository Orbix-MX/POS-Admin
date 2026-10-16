import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';

describe('CouponsService', () => {
  let service: CouponsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    coupon: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: TenantContextService, useValue: { requireTenantId: () => 'tenant-1', getBranchId: () => null } },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new coupon', async () => {
      const createCouponDto = {
        code: 'TEST10',
        type: 'PERCENTAGE' as any,
        value: 10,
        scope: 'GLOBAL' as any,
        startDate: new Date().toISOString(),
        isActive: true,
      };

      const mockCoupon = {
        id: '1',
        ...createCouponDto,
        startDate: new Date(createCouponDto.startDate),
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(null);
      mockPrismaService.coupon.findFirst.mockResolvedValue(null);
      mockPrismaService.coupon.create.mockResolvedValue(mockCoupon);

      const result = await service.create(createCouponDto);

      expect(result).toEqual(mockCoupon);
      expect(mockPrismaService.coupon.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if code already exists', async () => {
      const createCouponDto = {
        code: 'EXISTING',
        type: 'PERCENTAGE' as any,
        value: 10,
        scope: 'GLOBAL' as any,
        startDate: new Date().toISOString(),
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue({ id: '1' });
      mockPrismaService.coupon.findFirst.mockResolvedValue({ id: '1' });

      await expect(service.create(createCouponDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if PRODUCT scope without productId', async () => {
      const createCouponDto = {
        code: 'TEST10',
        type: 'PERCENTAGE' as any,
        value: 10,
        scope: 'PRODUCT' as any,
        startDate: new Date().toISOString(),
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(null);
      mockPrismaService.coupon.findFirst.mockResolvedValue(null);

      await expect(service.create(createCouponDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all coupons', async () => {
      const mockCoupons = [
        {
          id: '1',
          code: 'TEST10',
          type: 'PERCENTAGE',
          value: 10,
        },
      ];

      mockPrismaService.coupon.findMany.mockResolvedValue(mockCoupons);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('TEST10');
    });

    it('should filter coupons by search term', async () => {
      const query = { search: 'TEST' };
      mockPrismaService.coupon.findMany.mockResolvedValue([]);

      await service.findAll(query);

      expect(mockPrismaService.coupon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a coupon by id', async () => {
      const mockCoupon = {
        id: '1',
        code: 'TEST10',
        type: 'PERCENTAGE',
        value: 10,
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(mockCoupon);
      mockPrismaService.coupon.findFirst.mockResolvedValue(mockCoupon);

      const result = await service.findOne('1');

      expect(result).toEqual(mockCoupon);
    });

    it('should throw NotFoundException if coupon not found', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue(null);
      mockPrismaService.coupon.findFirst.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateCoupon', () => {
    it('should validate a valid coupon', async () => {
      const mockCoupon = {
        id: '1',
        code: 'TEST10',
        type: 'PERCENTAGE',
        value: 10,
        scope: 'GLOBAL',
        isActive: true,
        startDate: new Date(Date.now() - 1000),
        endDate: new Date(Date.now() + 10000),
        usageLimit: 100,
        usageCount: 50,
        customerTypes: [],
        isFirstPurchaseOnly: false,
        minOrders: null,
        minPurchase: null,
        maxDiscount: null,
        usageLimitPerCustomer: null,
        productId: null,
        categoryId: null,
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(mockCoupon);
      mockPrismaService.coupon.findFirst.mockResolvedValue(mockCoupon);

      const result = await service.validateCoupon({
        code: 'TEST10',
        totalAmount: 100,
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(10);
    });

    it('should return invalid for expired coupon', async () => {
      const mockCoupon = {
        id: '1',
        code: 'EXPIRED',
        isActive: true,
        startDate: new Date(Date.now() - 10000),
        endDate: new Date(Date.now() - 1000),
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(mockCoupon);
      mockPrismaService.coupon.findFirst.mockResolvedValue(mockCoupon);

      const result = await service.validateCoupon({ code: 'EXPIRED' });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('expirado');
    });

    it('should return invalid for inactive coupon', async () => {
      const mockCoupon = {
        id: '1',
        code: 'INACTIVE',
        isActive: false,
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(mockCoupon);
      mockPrismaService.coupon.findFirst.mockResolvedValue(mockCoupon);

      const result = await service.validateCoupon({ code: 'INACTIVE' });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('inactivo');
    });

    it('should return invalid for non-existent coupon', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue(null);
      mockPrismaService.coupon.findFirst.mockResolvedValue(null);

      const result = await service.validateCoupon({ code: 'NOTFOUND' });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('no encontrado');
    });
  });

  describe('update', () => {
    it('should update a coupon', async () => {
      const mockCoupon = {
        id: '1',
        code: 'TEST10',
      };

      const updateDto = {
        value: 15,
      };

      const updatedCoupon = {
        ...mockCoupon,
        value: 15,
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(mockCoupon);
      mockPrismaService.coupon.findFirst.mockResolvedValue(mockCoupon);
      mockPrismaService.coupon.update.mockResolvedValue(updatedCoupon);

      const result = await service.update('1', updateDto);

      expect(result.value).toBe(15);
    });
  });

  describe('remove', () => {
    it('should delete a coupon', async () => {
      const mockCoupon = {
        id: '1',
        code: 'TEST10',
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(mockCoupon);
      mockPrismaService.coupon.findFirst.mockResolvedValue(mockCoupon);
      mockPrismaService.coupon.delete.mockResolvedValue(mockCoupon);

      await service.remove('1');

      expect(mockPrismaService.coupon.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });

  /** @odd aislamiento-de-cupones T-001/T-002 */
  describe('incrementUsage', () => {
    const sqlOf = (call: unknown[]) => (call[0] as TemplateStringsArray).join('?');

    it('suma un uso con UNA sentencia acotada por empresa y por cupo', async () => {
      mockPrismaService.$executeRaw.mockResolvedValue(1);

      await service.incrementUsage('1');

      const call = mockPrismaService.$executeRaw.mock.calls[0];
      const sql = sqlOf(call);
      expect(sql).toContain('"tenantId" =');
      expect(sql).toContain('"usageCount" < "usageLimit"');
      expect(sql).toContain('"usageLimit" IS NULL');
      expect(call.slice(1)).toEqual(['1', 'tenant-1']); // id y tenantId van como parámetros, no concatenados
    });

    it('con tx usa el cliente de la transacción y no el global', async () => {
      const tx = { $executeRaw: jest.fn().mockResolvedValue(1) };

      await service.incrementUsage('1', tx as never);

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.$executeRaw).not.toHaveBeenCalled();
    });

    it('un cupón que no es de esta empresa no se toca y falla con NotFound', async () => {
      mockPrismaService.$executeRaw.mockResolvedValue(0);
      mockPrismaService.coupon.findFirst.mockResolvedValue(null);

      await expect(service.incrementUsage('cupon-de-otra-empresa')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.coupon.findFirst).toHaveBeenCalledWith({
        where: { id: 'cupon-de-otra-empresa', tenantId: 'tenant-1' },
        select: { id: true },
      });
    });

    it('un cupón de la empresa sin cupo responde 409 COUPON_EXHAUSTED', async () => {
      mockPrismaService.$executeRaw.mockResolvedValue(0);
      mockPrismaService.coupon.findFirst.mockResolvedValue({ id: '1' });

      const err = await service.incrementUsage('1').catch((e) => e);

      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({ statusCode: 409, code: 'COUPON_EXHAUSTED' });
    });
  });
});
