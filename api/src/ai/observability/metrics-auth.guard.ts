import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Longitudes distintas ya delatan algo por timing, pero timingSafeEqual
  // exige buffers del mismo tamaño — igualamos el de A para no tirar.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * M-03: `/metrics` es `@Public()` porque un scraper de Prometheus no trae un
 * JWT de Orbix — pero eso lo dejaba abierto a cualquiera en Internet, con
 * volumen de uso por feature, distribución de planes y tasas de error.
 *
 * Fail-closed a propósito: sin `METRICS_SCRAPE_TOKEN` configurado, el
 * endpoint responde 503 en vez de servir sin auth — mismo espíritu que
 * `googleOAuth.enabled` (una integración opcional que exige credenciales
 * explícitas para prender, nunca abierta por omisión).
 */
@Injectable()
export class MetricsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = process.env.METRICS_SCRAPE_TOKEN;
    if (!token) {
      throw new ServiceUnavailableException(
        'El scrape de métricas no está configurado (falta METRICS_SCRAPE_TOKEN).',
      );
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization ?? '';
    const presented = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!presented || !safeEqual(presented, token)) {
      throw new UnauthorizedException('Token de scrape inválido');
    }

    return true;
  }
}
