import { AiUsageRepository, RecordEventInput } from './ai-usage.repository';

describe('AiUsageRepository', () => {
  const mockTx = {
    aiUsageEvent: { create: jest.fn() },
    aiUsageCounter: { upsert: jest.fn() },
  };
  const mockPrisma = {
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(mockTx)),
    aiUsageEvent: { update: jest.fn() },
    aiUsageCounter: { findUnique: jest.fn() },
  };

  let repository: AiUsageRepository;

  const baseInput: RecordEventInput = {
    requestId: 'req-1',
    tenantId: 'tenant-1',
    featureKey: 'ai.echo',
    promptVersion: 1,
    schemaVersion: 1,
    providerId: 'mock',
    modelKey: 'mock-echo-v1',
    attemptNumber: 1,
    degradations: [],
    estimatedCostMicros: 0n,
    latencyMsTotal: 12,
    status: 'SUCCESS',
    outcome: 'PENDING',
    countsTowardLimit: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new AiUsageRepository(mockPrisma as any);
  });

  it('escribe el evento y hace upsert del contador cuando countsTowardLimit es true', async () => {
    await repository.recordEvent(baseInput);

    expect(mockTx.aiUsageEvent.create).toHaveBeenCalledTimes(1);
    expect(mockTx.aiUsageEvent.create.mock.calls[0][0].data).toMatchObject({
      requestId: 'req-1',
      tenantId: 'tenant-1',
      status: 'SUCCESS',
    });
    expect(mockTx.aiUsageCounter.upsert).toHaveBeenCalledTimes(1);
  });

  it('escribe el evento pero NO toca el contador cuando countsTowardLimit es false (D-18 / rechazos de límite)', async () => {
    await repository.recordEvent({ ...baseInput, status: 'QUOTA_EXCEEDED', countsTowardLimit: false });

    expect(mockTx.aiUsageEvent.create).toHaveBeenCalledTimes(1);
    expect(mockTx.aiUsageCounter.upsert).not.toHaveBeenCalled();
  });

  it('solo incrementa successCount para SUCCESS o SCHEMA_REPAIRED', async () => {
    await repository.recordEvent({ ...baseInput, status: 'PROVIDER_ERROR' });

    const upsertArgs = mockTx.aiUsageCounter.upsert.mock.calls[0][0];
    expect(upsertArgs.create.successCount).toBe(0);
    expect(upsertArgs.update.successCount).toBeUndefined();
  });

  it('incrementa successCount para SCHEMA_REPAIRED', async () => {
    await repository.recordEvent({ ...baseInput, status: 'SCHEMA_REPAIRED' });

    const upsertArgs = mockTx.aiUsageCounter.upsert.mock.calls[0][0];
    expect(upsertArgs.create.successCount).toBe(1);
  });

  it('getCounter delega en aiUsageCounter.findUnique con la clave compuesta', async () => {
    mockPrisma.aiUsageCounter.findUnique.mockResolvedValue({ invocationCount: 3 });
    const result = await repository.getCounter('tenant-1', 'ai.echo', '2026-08');

    expect(mockPrisma.aiUsageCounter.findUnique).toHaveBeenCalledWith({
      where: { tenantId_period_featureKey: { tenantId: 'tenant-1', period: '2026-08', featureKey: 'ai.echo' } },
      select: expect.any(Object),
    });
    expect(result).toEqual({ invocationCount: 3 });
  });

  it('setOutcome actualiza el evento por requestId', async () => {
    await repository.setOutcome('req-1', 'ACCEPTED');
    expect(mockPrisma.aiUsageEvent.update).toHaveBeenCalledWith({
      where: { requestId: 'req-1' },
      data: { outcome: 'ACCEPTED' },
    });
  });
});
