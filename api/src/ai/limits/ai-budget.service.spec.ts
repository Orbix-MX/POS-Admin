import { AiBudgetService } from './ai-budget.service';
import { PrismaService } from '../../database/prisma.service';

describe('AiBudgetService', () => {
  const mockPrisma = {
    aiUsageEvent: { aggregate: jest.fn() },
  };

  let service: AiBudgetService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AI_BUDGET_DAILY_USD = '1';
    process.env.AI_BUDGET_MONTHLY_USD = '10';
    mockPrisma.aiUsageEvent.aggregate.mockResolvedValue({ _sum: { estimatedCostMicros: 0n } });
    service = new AiBudgetService(mockPrisma as unknown as PrismaService);
  });

  afterEach(() => {
    delete process.env.AI_BUDGET_DAILY_USD;
    delete process.env.AI_BUDGET_MONTHLY_USD;
  });

  it('local/mock quedan exentos — nunca disparan el kill switch aunque no haya presupuesto', async () => {
    await service.onModuleInit();
    service.recordSpend(999_999_999_999n); // spend directo, simula que ya se agotó todo
    expect(() => service.assertWithinBudget('llama3.2:latest')).not.toThrow();
    expect(() => service.assertWithinBudget('mock-echo-v1')).not.toThrow();
  });

  it('un modelo con tarifa real pasa mientras el gasto esté bajo el tope', async () => {
    await service.onModuleInit();
    expect(() => service.assertWithinBudget('claude-haiku-4-5-20251001')).not.toThrow();
  });

  it('recordSpend acumula, y al llegar al tope diario lanza AI_BUDGET_EXCEEDED', async () => {
    await service.onModuleInit();
    service.recordSpend(1_000_000n); // $1 == tope diario de la prueba

    expect(() => service.assertWithinBudget('claude-haiku-4-5-20251001')).toThrow(
      expect.objectContaining({ code: 'AI_BUDGET_EXCEEDED' }),
    );
  });

  it('rehidrata el gasto acumulado del día/mes desde ai_usage_events en onModuleInit', async () => {
    mockPrisma.aiUsageEvent.aggregate.mockResolvedValue({ _sum: { estimatedCostMicros: 900_000n } });
    service = new AiBudgetService(mockPrisma as unknown as PrismaService);
    await service.onModuleInit();

    // Ya había 900_000µ ($0.90) acumulados; 200_000µ más ($0.20) cruza el tope de $1.
    service.recordSpend(200_000n);
    expect(() => service.assertWithinBudget('claude-haiku-4-5-20251001')).toThrow(
      expect.objectContaining({ code: 'AI_BUDGET_EXCEEDED' }),
    );
  });

  it('recordSpend de 0n (modelo exento) es un no-op inofensivo', async () => {
    await service.onModuleInit();
    service.recordSpend(0n);
    expect(() => service.assertWithinBudget('claude-haiku-4-5-20251001')).not.toThrow();
  });
});
