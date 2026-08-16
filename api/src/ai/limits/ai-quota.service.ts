import { Injectable } from '@nestjs/common';
import { TenantPlan } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiException } from '../contracts/ai-error';
import { AiUsageRepository } from '../usage/ai-usage.repository';
import { AiMetrics } from '../observability/ai-metrics';

/**
 * Límite mensual de invocaciones por plan (§11 — capa 3 de límites). Los
 * cinco planes usan el proveedor local (D-07/ADR-0026 reformulada): esta
 * tabla modula únicamente cuánto puede usarse, no quién lo atiende.
 * `null` = sin tope automático, mismo significado que `PlanLimitsService`
 * usa para `maxUsers`/`maxBranches` en el resto de Orbix.
 *
 * Valores de partida, no un compromiso comercial — ver el checklist de la
 * Fase 0 del documento de arquitectura.
 */
const AI_MONTHLY_INVOCATION_LIMITS: Readonly<Record<TenantPlan, number | null>> = {
  FREE: 50,
  STARTER: 300,
  PRO: 1500,
  PLUS: 5000,
  ENTERPRISE: null,
};

@Injectable()
export class AiQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageRepository: AiUsageRepository,
    private readonly metrics: AiMetrics,
  ) {}

  /**
   * Verificación previa, de solo lectura — nunca incrementa el contador
   * (eso ocurre en `AiUsageRepository.recordEvent`, en la misma transacción
   * que el evento, después de que la invocación realmente llegó al
   * proveedor). Lanza `AI_QUOTA_EXCEEDED` si no hay capacidad.
   */
  async assertCanInvoke(tenantId: string, featureKey: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plan: true },
    });

    const limit = AI_MONTHLY_INVOCATION_LIMITS[tenant.plan];
    if (limit === null) return;

    const counter = await this.usageRepository.getCounter(tenantId, featureKey);
    if ((counter?.invocationCount ?? 0) >= limit) {
      this.metrics.recordQuotaRejection(tenant.plan);
      throw new AiException(
        'AI_QUOTA_EXCEEDED',
        `Se alcanzó el límite mensual de ${limit} invocaciones para "${featureKey}".`,
      );
    }
  }
}
