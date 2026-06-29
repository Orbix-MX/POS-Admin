import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { SuppliesService } from './supplies.service';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { BusinessConfigurationService } from '../../../common/business-config/business-configuration.service';

// BR-02: supplies are a Restaurant-only capability gated behind `enableSupplies`.
// Retail (feature off) cannot access the module; Restaurant (on) keeps full access.
describe('SuppliesService — BR-02 supplies gating', () => {
  let service: SuppliesService;

  const mockPrisma = {
    supply: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue({ id: 's1', recipeItems: [] }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn().mockResolvedValue({ id: 's1' }),
  };
  const mockTenantContext = {
    requireTenantId: jest.fn().mockReturnValue('tenant-1'),
    getBranchId: jest.fn().mockReturnValue(null),
  };
  const mockAuditContext = { getUserId: jest.fn().mockReturnValue('user-1') };
  const mockBusinessConfig = { hasFeature: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TenantContextService, useValue: mockTenantContext },
        { provide: AuditContextService, useValue: mockAuditContext },
        { provide: BusinessConfigurationService, useValue: mockBusinessConfig },
      ],
    }).compile();
    service = module.get(SuppliesService);
  });

  it('Retail (supplies off): every entry point is blocked', async () => {
    mockBusinessConfig.hasFeature.mockResolvedValue(false);

    await expect(service.findAll({} as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.findOne('s1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create({ sku: 'X', name: 'X' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update('s1', {} as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove('s1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.adjustStock('s1', { quantity: 1 } as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getLowStock()).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getMovements('s1')).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockBusinessConfig.hasFeature).toHaveBeenCalledWith('enableSupplies');
  });

  it('Restaurant (supplies on): read access works (no block)', async () => {
    mockBusinessConfig.hasFeature.mockResolvedValue(true);

    await expect(service.findAll({} as never)).resolves.toEqual({
      data: [],
      meta: { page: undefined, limit: undefined, total: 0, totalPages: NaN },
    });
    await expect(service.getLowStock()).resolves.toEqual([]);
    expect(mockBusinessConfig.hasFeature).toHaveBeenCalledWith('enableSupplies');
  });
});
