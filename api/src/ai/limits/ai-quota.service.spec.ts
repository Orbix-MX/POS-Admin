import { AiQuotaService } from './ai-quota.service';

describe('AiQuotaService', () => {
  const mockPrisma = {
    tenant: { findUniqueOrThrow: jest.fn() },
  };
  const mockUsageRepository = {
    getCounter: jest.fn(),
  };
  const mockMetrics = {
    recordQuotaRejection: jest.fn(),
  };

  let service: AiQuotaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiQuotaService(mockPrisma as any, mockUsageRepository as any, mockMetrics as any);
  });

  it('permite la invocación cuando el contador está bajo el límite del plan', async () => {
    mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ plan: 'STARTER' });
    mockUsageRepository.getCounter.mockResolvedValue({ invocationCount: 299 });

    await expect(service.assertCanInvoke('tenant-1', 'ai.echo')).resolves.toBeUndefined();
    expect(mockMetrics.recordQuotaRejection).not.toHaveBeenCalled();
  });

  it('rechaza con AI_QUOTA_EXCEEDED al alcanzar el límite del plan', async () => {
    mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ plan: 'FREE' });
    mockUsageRepository.getCounter.mockResolvedValue({ invocationCount: 50 });

    await expect(service.assertCanInvoke('tenant-1', 'ai.echo')).rejects.toMatchObject({
      code: 'AI_QUOTA_EXCEEDED',
    });
    expect(mockMetrics.recordQuotaRejection).toHaveBeenCalledWith('FREE');
  });

  it('sin contador previo (primera invocación del mes) permite pasar', async () => {
    mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ plan: 'PRO' });
    mockUsageRepository.getCounter.mockResolvedValue(null);

    await expect(service.assertCanInvoke('tenant-1', 'ai.echo')).resolves.toBeUndefined();
  });

  it('ENTERPRISE no tiene tope automático en v1', async () => {
    mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ plan: 'ENTERPRISE' });

    await expect(service.assertCanInvoke('tenant-1', 'ai.echo')).resolves.toBeUndefined();
    expect(mockUsageRepository.getCounter).not.toHaveBeenCalled();
  });
});
