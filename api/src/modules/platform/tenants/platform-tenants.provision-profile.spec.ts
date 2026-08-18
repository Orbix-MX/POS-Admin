import { Test, TestingModule } from '@nestjs/testing';
import { PlatformTenantsService } from './platform-tenants.service';
import { PrismaService } from '../../../database/prisma.service';
import { LicenseService } from '../../../common/services/license.service';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';

// BP-01: Business Profile is persisted at provisioning time only. These tests
// pin the persistence contract (explicit value + default) without exercising
// any vertical behaviour — nothing reads the profile yet.
describe('PlatformTenantsService — provision businessProfile (BP-01)', () => {
  let service: PlatformTenantsService;

  // tx captured so we can assert what tenant.create received.
  const txTenantCreate = jest.fn().mockImplementation(({ data }) => ({
    id: 'tenant-1',
    slug: data.slug,
    plan: data.plan,
    businessProfile: data.businessProfile,
  }));

  const tx = {
    tenant: { create: txTenantCreate, update: jest.fn() },
    branch: { create: jest.fn().mockResolvedValue({ id: 'branch-1', code: 'M1' }) },
    user: { create: jest.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com', firstName: 'A', lastName: 'B' }) },
    tenantMembership: { create: jest.fn() },
    role: { create: jest.fn().mockResolvedValue({ id: 'role-1' }) },
    userRoleAssignment: { create: jest.fn() },
  };

  const mockPrisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    permission: { createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([{ id: 'perm-1' }]) },
    platformAuditLog: { create: jest.fn() },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };

  const mockLicense = { createLicense: jest.fn() };

  const baseDto = (): ProvisionTenantDto =>
    ({
      tenant: { name: 'Acme', slug: 'acme', plan: 'FREE' },
      branch: { name: 'Main', code: 'M1' },
      adminUser: { email: 'a@b.com', firstName: 'A', lastName: 'B', password: 'password1' },
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformTenantsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LicenseService, useValue: mockLicense },
      ],
    }).compile();
    service = module.get(PlatformTenantsService);
  });

  it('persists the explicit businessProfile when provided', async () => {
    const dto = baseDto();
    dto.tenant.businessProfile = 'RETAIL_MANUFACTURING';

    await service.provision(dto, { id: 'actor-1' });

    expect(txTenantCreate).toHaveBeenCalledTimes(1);
    expect(txTenantCreate.mock.calls[0][0].data.businessProfile).toBe('RETAIL_MANUFACTURING');
  });

  it('defaults businessProfile to RETAIL when omitted (backward compatible)', async () => {
    await service.provision(baseDto(), { id: 'actor-1' });

    expect(txTenantCreate.mock.calls[0][0].data.businessProfile).toBe('RETAIL');
  });
});
