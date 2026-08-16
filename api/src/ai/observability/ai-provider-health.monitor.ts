import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AiProviderRegistry } from '../providers/ai-provider.registry';
import { AiMetrics } from './ai-metrics';

const POLL_INTERVAL_MS = 15_000;

/**
 * Sondea `health()` de cada proveedor registrado cada 15 s y alimenta
 * `ai_provider_up` (§12 del documento de arquitectura). Diferido en la
 * Fase 1 a propósito: `MockProvider` siempre está arriba, un poller no
 * aportaba nada. Entra aquí, en la Fase 2, junto al primer proveedor que
 * realmente puede caerse — sin `@nestjs/schedule`, un `setInterval` en el
 * ciclo de vida del módulo alcanza para esto.
 */
@Injectable()
export class AiProviderHealthMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiProviderHealthMonitor.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly registry: AiProviderRegistry,
    private readonly metrics: AiMetrics,
  ) {}

  onModuleInit(): void {
    void this.pollOnce();
    this.timer = setInterval(() => void this.pollOnce(), POLL_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async pollOnce(): Promise<void> {
    for (const provider of this.registry.list()) {
      try {
        const health = await provider.health();
        this.metrics.recordProviderHealth(provider.id, health.up);
      } catch (err) {
        this.metrics.recordProviderHealth(provider.id, false);
        this.logger.warn(
          `health(${provider.id}) lanzó en vez de devolver { up: false }: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
