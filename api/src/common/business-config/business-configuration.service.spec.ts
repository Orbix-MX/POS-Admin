import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BusinessConfigurationService } from './business-configuration.service';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../context/tenant-context.service';
import { PROFILE_DEFAULT_FEATURES } from './business-features';

// BP-02/03/04: validate the facade reads the persisted profile, derives the
// expected features and memoises per request. No vertical behaviour exercised.
describe('BusinessConfigurationService', () => {
  let module: TestingModule;
  let service: BusinessConfigurationService;

  const mockPrisma = { tenant: { findUnique: jest.fn() } };
  const mockTenantContext = { requireTenantId: jest.fn().mockReturnValue('tenant-1') };

  const withProfile = (businessProfile: string | null) =>
    mockPrisma.tenant.findUnique.mockResolvedValue(
      businessProfile === null ? null : { businessProfile },
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    module = await Test.createTestingModule({
      providers: [
        BusinessConfigurationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TenantContextService, useValue: mockTenantContext },
      ],
    }).compile();
    // REQUEST-scoped → resolve() yields a fresh per-request instance.
    service = await module.resolve(BusinessConfigurationService);
  });

  it('getConfiguration returns a unified { profile, features } object', async () => {
    withProfile('RESTAURANT');
    const config = await service.getConfiguration();
    expect(config).toEqual({
      profile: 'RESTAURANT',
      features: PROFILE_DEFAULT_FEATURES.RESTAURANT,
    });
  });

  it('every public accessor reuses getConfiguration (single constructor)', async () => {
    withProfile('RESTAURANT');
    const spy = jest.spyOn(service, 'getConfiguration');

    await service.getBusinessProfile();
    await service.getBusinessFeatures();
    await service.hasFeature('enableKitchen');
    await service.isRetail();
    await service.isRestaurant();
    await service.isManufacturing();

    // 6 wrappers → 6 delegations, none building the config on their own.
    expect(spy).toHaveBeenCalledTimes(6);
  });

  it('getBusinessProfile returns the persisted profile', async () => {
    withProfile('RESTAURANT');
    expect(await service.getBusinessProfile()).toBe('RESTAURANT');
    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      select: { businessProfile: true },
    });
  });

  it('getBusinessFeatures derives the profile feature set', async () => {
    withProfile('RESTAURANT');
    expect(await service.getBusinessFeatures()).toEqual(PROFILE_DEFAULT_FEATURES.RESTAURANT);
  });

  it('hasFeature reflects the derived set (per request instance)', async () => {
    withProfile('RESTAURANT');
    expect(await service.hasFeature('enableKitchen')).toBe(true);

    // A different request (fresh instance) sees its own profile.
    withProfile('RETAIL');
    const other = await module.resolve(BusinessConfigurationService);
    expect(await other.hasFeature('enableKitchen')).toBe(false);
  });

  it('BP-04: builds the configuration once per request across all accessors', async () => {
    withProfile('RESTAURANT');
    const buildSpy = jest.spyOn(
      service as unknown as { buildConfiguration: () => Promise<unknown> },
      'buildConfiguration',
    );

    await service.getConfiguration();
    await service.getBusinessProfile();
    await service.getBusinessFeatures();
    await service.hasFeature('enableKitchen');
    await service.isRetail();
    await service.isRestaurant();
    await service.isManufacturing();

    // Single construction, single DB hit — memoised for the whole request.
    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(1);
  });

  it('BP-04: cache does not survive across requests (no shared state)', async () => {
    withProfile('RESTAURANT');
    await service.getConfiguration();

    const next = await module.resolve(BusinessConfigurationService);
    await next.getConfiguration();

    // Two separate requests → two independent constructions.
    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(2);
  });

  it('profile predicates are strict to the named profile', async () => {
    withProfile('RETAIL');
    expect(await service.isRetail()).toBe(true);
    expect(await service.isRestaurant()).toBe(false);
    expect(await service.isManufacturing()).toBe(false);
  });

  it('existing tenant defaulting to RETAIL keeps retail features', async () => {
    // A tenant provisioned before BP-01 carries the column default RETAIL.
    withProfile('RETAIL');
    expect(await service.getBusinessFeatures()).toEqual(PROFILE_DEFAULT_FEATURES.RETAIL);
    expect(await service.isRetail()).toBe(true);
  });

  it('throws when the tenant does not exist', async () => {
    withProfile(null);
    await expect(service.getBusinessProfile()).rejects.toBeInstanceOf(NotFoundException);
  });
});
