import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

/**
 * Métricas mínimas de §16: Prometheus + Grafana (D-12), sin OpenTelemetry ni
 * Langfuse en v1 — con un proveedor y un salto de red, trazas distribuidas
 * no dan información que estas métricas y `ai_usage_events` no den ya.
 *
 * `ai_provider_up` queda definida pero sin un poblador programado en la
 * Fase 1: `MockProvider.health()` siempre está arriba, y un poller
 * periódico real solo tiene sentido con un proveedor de red — llega en la
 * Fase 2 junto a `OpenAICompatibleProvider`.
 */
@Injectable()
export class AiMetrics {
  readonly registry = new Registry();

  private readonly requestsTotal = new Counter({
    name: 'ai_requests_total',
    help: 'Invocaciones a la plataforma de IA, por feature y estado.',
    labelNames: ['feature', 'status'] as const,
    registers: [this.registry],
  });

  private readonly requestDuration = new Histogram({
    name: 'ai_request_duration_seconds',
    help: 'Duración total de una invocación, por feature.',
    labelNames: ['feature'] as const,
    buckets: [1, 2, 5, 10, 20, 45, 60],
    registers: [this.registry],
  });

  private readonly tokensTotal = new Counter({
    name: 'ai_tokens_total',
    help: 'Tokens consumidos, por dirección.',
    labelNames: ['direction'] as const,
    registers: [this.registry],
  });

  private readonly schemaRepairTotal = new Counter({
    name: 'ai_schema_repair_total',
    help: 'Invocaciones que requirieron un reintento de reparación de schema.',
    labelNames: ['feature'] as const,
    registers: [this.registry],
  });

  private readonly outputInvalidTotal = new Counter({
    name: 'ai_output_invalid_total',
    help: 'Invocaciones cuya salida no pudo validarse tras la reparación.',
    labelNames: ['feature'] as const,
    registers: [this.registry],
  });

  private readonly providerUp = new Gauge({
    name: 'ai_provider_up',
    help: '1 si el proveedor respondió al último health check, 0 si no.',
    labelNames: ['provider'] as const,
    registers: [this.registry],
  });

  private readonly quotaRejectionsTotal = new Counter({
    name: 'ai_quota_rejections_total',
    help: 'Invocaciones rechazadas por límite mensual, por plan.',
    labelNames: ['plan'] as const,
    registers: [this.registry],
  });

  recordRequest(feature: string, status: string): void {
    this.requestsTotal.labels(feature, status).inc();
  }

  recordDuration(feature: string, durationMs: number): void {
    this.requestDuration.labels(feature).observe(durationMs / 1000);
  }

  recordTokens(inputTokens: number, outputTokens: number): void {
    if (inputTokens > 0) this.tokensTotal.labels('input').inc(inputTokens);
    if (outputTokens > 0) this.tokensTotal.labels('output').inc(outputTokens);
  }

  recordSchemaRepair(feature: string): void {
    this.schemaRepairTotal.labels(feature).inc();
  }

  recordOutputInvalid(feature: string): void {
    this.outputInvalidTotal.labels(feature).inc();
  }

  recordProviderHealth(provider: string, up: boolean): void {
    this.providerUp.labels(provider).set(up ? 1 : 0);
  }

  recordQuotaRejection(plan: string): void {
    this.quotaRejectionsTotal.labels(plan).inc();
  }

  async snapshot(): Promise<string> {
    return this.registry.metrics();
  }
}
