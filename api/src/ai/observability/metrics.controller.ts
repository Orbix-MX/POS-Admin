import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { MetricsAuthGuard } from './metrics-auth.guard';
import { AiMetrics } from './ai-metrics';

/**
 * Endpoint de scrape de Prometheus. `@Public()` porque un scraper externo no
 * trae un JWT de Orbix (estas métricas no llevan dato de tenant individual,
 * son agregados por feature/estado/plan — ver §14), pero eso no significa
 * "sin auth": `MetricsAuthGuard` exige un bearer token propio (M-03). Antes
 * cualquiera en Internet veía volumen de uso por feature, distribución de
 * planes y tasas de error.
 */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: AiMetrics) {}

  @Public()
  @UseGuards(MetricsAuthGuard)
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return this.metrics.snapshot();
  }
}
