import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AiMetrics } from './ai-metrics';

/**
 * Endpoint de scrape de Prometheus. Público a propósito: un scraper externo
 * no trae un JWT de Orbix, y estas métricas no llevan dato de tenant
 * individual (son agregados por feature/estado/plan) — ver §14, "todo dato
 * de IA lleva tenantId" se refiere a `ai_usage_events`, no a este agregado.
 */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: AiMetrics) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return this.metrics.snapshot();
  }
}
