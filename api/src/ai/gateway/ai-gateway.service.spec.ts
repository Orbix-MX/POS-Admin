import { Test, TestingModule } from '@nestjs/testing';
import { AiGatewayService } from './ai-gateway.service';
import { AiRequestValidator } from './ai-request.validator';
import { AiExecutionService } from './ai-execution.service';
import { PromptRegistry } from '../prompts/prompt-registry.service';
import { PromptRenderer } from '../prompts/prompt-renderer.service';
import { AiSchemaRegistry } from '../schemas/ai-schema.registry';
import { echoOutputSchema } from '../schemas/ai-echo.schema';
import { StructuredOutputService } from '../schemas/structured-output.service';
import { AiProviderRegistry } from '../providers/ai-provider.registry';
import { MockProvider } from '../providers/mock/mock.provider';
import { AIProvider, ChatResult, ProviderHealth } from '../providers/ai-provider.port';
import { AiUsageRepository } from '../usage/ai-usage.repository';
import { AiUsageRecorder } from '../usage/ai-usage.recorder';
import { AiCostCalculator } from '../usage/ai-cost.calculator';
import { AiQuotaService } from '../limits/ai-quota.service';
import { AiRateLimitService } from '../limits/ai-rate-limit.service';
import { AiMetrics } from '../observability/ai-metrics';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { AuditContextService } from '../../common/context/audit-context.service';
import { PrismaService } from '../../database/prisma.service';
import { AICapability } from '../contracts/ai-capability.enum';

/**
 * Integración del pipeline completo del gateway contra `MockProvider` —
 * criterios de aceptación de la Fase 1 (§Roadmap). Prisma se mockea siguiendo
 * el mismo patrón que el resto del repo (ver products.service.spec.ts): sin
 * base de datos real.
 */
describe('AiGatewayService (integración con MockProvider)', () => {
  let gateway: AiGatewayService;
  let mockProvider: MockProvider;
  let tenantContext: { requireTenantId: jest.Mock; getBranchId: jest.Mock };
  let auditContext: { getUserId: jest.Mock };

  const mockTx = {
    aiUsageEvent: { create: jest.fn() },
    aiUsageCounter: { upsert: jest.fn() },
  };
  const mockPrisma = {
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(mockTx)),
    aiUsageEvent: { update: jest.fn() },
    aiUsageCounter: { findUnique: jest.fn() },
    tenant: { findUniqueOrThrow: jest.fn() },
  };

  const commonProviders = [
    AiGatewayService,
    AiRequestValidator,
    AiExecutionService,
    PromptRegistry,
    PromptRenderer,
    {
      provide: AiSchemaRegistry,
      useFactory: () => {
        const registry = new AiSchemaRegistry();
        registry.register({ key: 'ai.echo.v1', version: 1, schema: echoOutputSchema });
        return registry;
      },
    },
    StructuredOutputService,
    AiUsageRepository,
    AiUsageRecorder,
    AiCostCalculator,
    AiQuotaService,
    AiRateLimitService,
    AiMetrics,
    { provide: PrismaService, useValue: mockPrisma },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.aiUsageCounter.findUnique.mockResolvedValue(null);
    mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ plan: 'PRO' });

    tenantContext = {
      requireTenantId: jest.fn().mockReturnValue('tenant-1'),
      getBranchId: jest.fn().mockReturnValue(undefined),
    };
    auditContext = { getUserId: jest.fn().mockReturnValue('user-1') };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ...commonProviders,
        MockProvider,
        {
          provide: AiProviderRegistry,
          useFactory: (mock: MockProvider) => {
            const registry = new AiProviderRegistry();
            registry.register(mock);
            return registry;
          },
          inject: [MockProvider],
        },
        { provide: TenantContextService, useValue: tenantContext },
        { provide: AuditContextService, useValue: auditContext },
      ],
    }).compile();

    gateway = moduleRef.get(AiGatewayService);
    mockProvider = moduleRef.get(MockProvider);
    mockProvider.setLatencyMs(1);
  });

  it('resuelve ai.echo de punta a punta: responde, registra el evento y actualiza el contador', async () => {
    const result = await gateway.generate({ featureKey: 'ai.echo', input: {} }, { message: 'coca de 600' });

    expect(result.data).toEqual({ echo: 'coca de 600' });
    expect(result.degradations).toEqual([]);
    expect(result.usage.providerId).toBe('mock');

    expect(mockTx.aiUsageEvent.create).toHaveBeenCalledTimes(1);
    expect(mockTx.aiUsageEvent.create.mock.calls[0][0].data).toMatchObject({
      tenantId: 'tenant-1',
      featureKey: 'ai.echo',
      status: 'SUCCESS',
    });
    expect(mockTx.aiUsageCounter.upsert).toHaveBeenCalledTimes(1);
  });

  it('cuando el schema falla una vez, repara con un segundo intento y marca SCHEMA_REPAIRED', async () => {
    mockProvider.queueResponse('esto no es json');

    const result = await gateway.generate({ featureKey: 'ai.echo', input: {} }, { message: 'reparable' });

    expect(result.data).toEqual({ echo: 'reparable' });
    expect(result.degradations).toEqual(['schema_repaired']);
    expect(result.usage.attemptNumber).toBe(2);
    expect(mockTx.aiUsageEvent.create.mock.calls[0][0].data.status).toBe('SCHEMA_REPAIRED');
  });

  it('agotado el reintento de reparación, lanza AI_OUTPUT_INVALID y registra el fallo', async () => {
    mockProvider.queueResponse('no json 1');
    mockProvider.queueResponse('no json 2');

    await expect(
      gateway.generate({ featureKey: 'ai.echo', input: {} }, { message: 'x' }),
    ).rejects.toMatchObject({ code: 'AI_OUTPUT_INVALID' });

    expect(mockTx.aiUsageEvent.create.mock.calls[0][0].data.status).toBe('OUTPUT_INVALID');
  });

  it('sin fallback: si el proveedor falla, termina en AI_PROVIDER_UNAVAILABLE y el evento se registra igual (D-18)', async () => {
    mockProvider.queueError(new Error('caído'));
    mockProvider.queueError(new Error('caído'));
    mockProvider.queueError(new Error('caído'));
    const chatSpy = jest.spyOn(mockProvider, 'chat');

    await expect(
      gateway.generate({ featureKey: 'ai.echo', input: {} }, { message: 'x' }),
    ).rejects.toMatchObject({ code: 'AI_PROVIDER_UNAVAILABLE' });

    expect(chatSpy).toHaveBeenCalled();
    expect(mockTx.aiUsageEvent.create).toHaveBeenCalledTimes(1);
    expect(mockTx.aiUsageEvent.create.mock.calls[0][0].data.status).toBe('PROVIDER_ERROR');
  }, 10000);

  it('el límite mensual agotado rechaza ANTES de invocar al proveedor', async () => {
    mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ plan: 'FREE' });
    mockPrisma.aiUsageCounter.findUnique.mockResolvedValue({ invocationCount: 50 });
    const chatSpy = jest.spyOn(mockProvider, 'chat');

    await expect(
      gateway.generate({ featureKey: 'ai.echo', input: {} }, { message: 'x' }),
    ).rejects.toMatchObject({ code: 'AI_QUOTA_EXCEEDED' });

    expect(chatSpy).not.toHaveBeenCalled();
    expect(mockTx.aiUsageEvent.create).toHaveBeenCalledTimes(1);
    // El rechazo se registra para observabilidad, pero no incrementa el propio límite.
    expect(mockTx.aiUsageCounter.upsert).not.toHaveBeenCalled();
  });

  it('una feature no registrada rechaza con AI_FEATURE_DISABLED sin registrar evento', async () => {
    await expect(
      gateway.generate({ featureKey: 'no.existe', input: {} }, {}),
    ).rejects.toMatchObject({ code: 'AI_FEATURE_DISABLED' });

    expect(mockTx.aiUsageEvent.create).not.toHaveBeenCalled();
  });

  it('dos tenants no comparten el contador de consumo (aislamiento)', async () => {
    await gateway.generate({ featureKey: 'ai.echo', input: {} }, { message: 'de tenant 1' });

    tenantContext.requireTenantId.mockReturnValue('tenant-2');
    await gateway.generate({ featureKey: 'ai.echo', input: {} }, { message: 'de tenant 2' });

    const tenantIdsInEvents = mockTx.aiUsageEvent.create.mock.calls.map((c) => c[0].data.tenantId);
    const tenantIdsInCounters = mockTx.aiUsageCounter.upsert.mock.calls.map(
      (c) => c[0].where.tenantId_period_featureKey.tenantId,
    );

    expect(tenantIdsInEvents).toEqual(['tenant-1', 'tenant-2']);
    expect(tenantIdsInCounters).toEqual(['tenant-1', 'tenant-2']);
  });

  it('el mismo AiGatewayService funciona sin cambios con cualquier implementador registrado bajo el id que espera el binding', async () => {
    class OtherProvider implements AIProvider {
      readonly id = 'mock'; // mismo id que usa el binding de ai.echo — la sustitución ocurre en el registro, no en el gateway.
      readonly capabilities = new Set([AICapability.CHAT, AICapability.STRUCTURED_NATIVE]);
      supports(required: AICapability[]): boolean {
        return required.every((cap) => this.capabilities.has(cap));
      }
      chat(): Promise<ChatResult> {
        return Promise.resolve({ content: '{"echo":"desde otro proveedor"}', latencyMsProvider: 1 });
      }
      health(): Promise<ProviderHealth> {
        return Promise.resolve({ up: true, checkedAt: new Date() });
      }
    }

    const registry = new AiProviderRegistry();
    registry.register(new OtherProvider());

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ...commonProviders,
        { provide: AiProviderRegistry, useValue: registry },
        { provide: TenantContextService, useValue: tenantContext },
        { provide: AuditContextService, useValue: auditContext },
      ],
    }).compile();

    const swappedGateway = moduleRef.get(AiGatewayService);
    const result = await swappedGateway.generate({ featureKey: 'ai.echo', input: {} }, { message: 'x' });

    expect(result.data).toEqual({ echo: 'desde otro proveedor' });
    expect(result.usage.providerId).toBe('mock');
  });
});
