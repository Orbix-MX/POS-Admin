import { Module } from '@nestjs/common';
import { AiGatewayService } from './gateway/ai-gateway.service';
import { AiRequestValidator } from './gateway/ai-request.validator';
import { AiExecutionService } from './gateway/ai-execution.service';
import { AiProviderRegistry } from './providers/ai-provider.registry';
import { MockProvider } from './providers/mock/mock.provider';
import { OpenAICompatibleProvider } from './providers/openai-compatible/openai-compatible.provider';
import { PromptRegistry } from './prompts/prompt-registry.service';
import { PromptRenderer } from './prompts/prompt-renderer.service';
import { AiSchemaRegistry } from './schemas/ai-schema.registry';
import { echoOutputSchema } from './schemas/ai-echo.schema';
import { StructuredOutputService } from './schemas/structured-output.service';
import { AiUsageRepository } from './usage/ai-usage.repository';
import { AiUsageRecorder } from './usage/ai-usage.recorder';
import { AiCostCalculator } from './usage/ai-cost.calculator';
import { AiQuotaService } from './limits/ai-quota.service';
import { AiRateLimitService } from './limits/ai-rate-limit.service';
import { AiMetrics } from './observability/ai-metrics';
import { MetricsController } from './observability/metrics.controller';
import { AiProviderHealthMonitor } from './observability/ai-provider-health.monitor';

/**
 * Plataforma de IA — infraestructura transversal, no un vertical de
 * negocio (§02). Exporta `AiGatewayService` (invocar IA),
 * `AiSchemaRegistry` (declarar el schema de una feature) y
 * `AiUsageRecorder` (registrar el desenlace de un draft cuando se confirma
 * — ver `ProductsService.create`) — nunca los proveedores, la
 * configuración de routing ni las plantillas de prompt. Esa frontera la
 * refuerza la regla ESLint `no-restricted-imports` en `eslint.config.mjs`.
 *
 * `AiProviderRegistry` se puebla explícitamente aquí, no por auto-discovery:
 * qué proveedores existen es una decisión de arranque (ADR-0025).
 * `OpenAICompatibleProvider` (Fase 2) se registra bajo el id `'local'` solo
 * si `AI_LOCAL_BASE_URL` está configurado — en desarrollo, Ollama; en
 * producción, `llama-server`.
 */
@Module({
  controllers: [MetricsController],
  providers: [
    AiGatewayService,
    AiRequestValidator,
    AiExecutionService,
    MockProvider,
    {
      provide: AiProviderRegistry,
      useFactory: (mock: MockProvider) => {
        const registry = new AiProviderRegistry();
        registry.register(mock);

        const localBaseUrl = process.env.AI_LOCAL_BASE_URL;
        if (localBaseUrl) {
          registry.register(
            new OpenAICompatibleProvider({
              id: 'local',
              baseUrl: localBaseUrl,
              apiKey: process.env.AI_LOCAL_API_KEY,
            }),
          );
        }

        return registry;
      },
      inject: [MockProvider],
    },
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
    AiProviderHealthMonitor,
  ],
  exports: [AiGatewayService, AiSchemaRegistry, AiUsageRecorder],
})
export class AiModule {}
