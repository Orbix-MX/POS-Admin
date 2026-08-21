import { Injectable } from '@nestjs/common';
import { AiUsageOutcome, AiUsageStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { currentPeriod } from './period.util';

export interface RecordEventInput {
  requestId: string;
  tenantId: string;
  branchId?: string;
  userId?: string;
  featureKey: string;
  promptVersion: number;
  schemaVersion: number;
  providerId: string;
  modelKey: string;
  attemptNumber: number;
  degradations: string[];
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostMicros: bigint;
  latencyMsTotal: number;
  latencyMsProvider?: number;
  status: AiUsageStatus;
  errorCode?: string;
  errorMessage?: string;
  outcome: AiUsageOutcome;
  /**
   * false para invocaciones rechazadas por cuota o ráfaga: nunca llegaron al
   * proveedor, así que no incrementan `ai_usage_counters` — evitan que un
   * tenant ya sobre el límite lo empuje más hondo cada vez que reintenta.
   * El evento igual se registra, para que `ai_quota_rejections_total` sea
   * visible.
   */
  countsTowardLimit: boolean;
}

const SUCCESSFUL_STATUSES: ReadonlySet<AiUsageStatus> = new Set(['SUCCESS', 'SCHEMA_REPAIRED']);

/**
 * Capa de Prisma de la plataforma de IA. El evento (append-only) y el
 * contador agregado se escriben en la misma transacción — D-08 / §13: el
 * contador existe únicamente para que la verificación de límite sea O(1),
 * y no puede desincronizarse del registro que lo respalda.
 */
@Injectable()
export class AiUsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(input: RecordEventInput): Promise<void> {
    const period = currentPeriod();

    await this.prisma.$transaction(async (tx) => {
      await tx.aiUsageEvent.create({
        data: {
          requestId: input.requestId,
          tenantId: input.tenantId,
          branchId: input.branchId,
          userId: input.userId,
          featureKey: input.featureKey,
          promptVersion: input.promptVersion,
          schemaVersion: input.schemaVersion,
          providerId: input.providerId,
          modelKey: input.modelKey,
          attemptNumber: input.attemptNumber,
          degradations: input.degradations,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          totalTokens: input.totalTokens,
          estimatedCostMicros: input.estimatedCostMicros,
          latencyMsTotal: input.latencyMsTotal,
          latencyMsProvider: input.latencyMsProvider,
          status: input.status,
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
          outcome: input.outcome,
        },
      });

      if (!input.countsTowardLimit) return;

      const successIncrement = SUCCESSFUL_STATUSES.has(input.status) ? 1 : 0;

      await tx.aiUsageCounter.upsert({
        where: {
          tenantId_period_featureKey: {
            tenantId: input.tenantId,
            period,
            featureKey: input.featureKey,
          },
        },
        create: {
          tenantId: input.tenantId,
          period,
          featureKey: input.featureKey,
          invocationCount: 1,
          successCount: successIncrement,
          totalTokens: input.totalTokens ?? 0,
          estimatedCostMicros: input.estimatedCostMicros,
        },
        update: {
          invocationCount: { increment: 1 },
          successCount: successIncrement > 0 ? { increment: successIncrement } : undefined,
          totalTokens: { increment: input.totalTokens ?? 0 },
          estimatedCostMicros: { increment: input.estimatedCostMicros },
        },
      });
    });
  }

  async getCounter(tenantId: string, featureKey: string, period: string = currentPeriod()) {
    return this.prisma.aiUsageCounter.findUnique({
      where: { tenantId_period_featureKey: { tenantId, period, featureKey } },
      select: {
        invocationCount: true,
        successCount: true,
        totalTokens: true,
        estimatedCostMicros: true,
      },
    });
  }

  async setOutcome(requestId: string, outcome: AiUsageOutcome): Promise<void> {
    await this.prisma.aiUsageEvent.update({ where: { requestId }, data: { outcome } });
  }
}
