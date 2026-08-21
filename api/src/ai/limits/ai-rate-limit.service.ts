import { Injectable } from '@nestjs/common';
import { AiException } from '../contracts/ai-error';

/**
 * Capas 1 y 2 de límites (§13): ráfaga por usuario y concurrencia en vuelo
 * por tenant. Ambas en memoria — perderlas al reiniciar el proceso es
 * aceptable (D-09: Redis no entra hasta que haya más de una instancia de
 * API). El límite de concurrencia por tenant protege los 2–3 slots del
 * servidor de inferencia local (§10): sin él, un tenant satura la
 * inferencia de todos los demás.
 */
@Injectable()
export class AiRateLimitService {
  private static readonly BURST_LIMIT = 10;
  private static readonly BURST_WINDOW_MS = 60_000;
  private static readonly MAX_CONCURRENCY_PER_TENANT = 3;

  private readonly userWindows = new Map<string, number[]>();
  private readonly tenantInFlight = new Map<string, number>();

  /** Ventana deslizante de 60 s. Lanza `AI_RATE_LIMITED` sobre el límite. */
  assertBurstOk(key: string): void {
    const now = Date.now();
    const timestamps = (this.userWindows.get(key) ?? []).filter(
      (t) => now - t < AiRateLimitService.BURST_WINDOW_MS,
    );

    if (timestamps.length >= AiRateLimitService.BURST_LIMIT) {
      throw new AiException(
        'AI_RATE_LIMITED',
        'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
      );
    }

    timestamps.push(now);
    this.userWindows.set(key, timestamps);
  }

  /** Reserva un slot de concurrencia del tenant. Liberar siempre con `releaseTenantSlot`. */
  acquireTenantSlot(tenantId: string): void {
    const current = this.tenantInFlight.get(tenantId) ?? 0;
    if (current >= AiRateLimitService.MAX_CONCURRENCY_PER_TENANT) {
      throw new AiException(
        'AI_RATE_LIMITED',
        'Hay demasiadas solicitudes de IA en curso para este negocio. Inténtalo de nuevo en unos segundos.',
      );
    }
    this.tenantInFlight.set(tenantId, current + 1);
  }

  releaseTenantSlot(tenantId: string): void {
    const current = this.tenantInFlight.get(tenantId) ?? 0;
    this.tenantInFlight.set(tenantId, Math.max(0, current - 1));
  }
}
