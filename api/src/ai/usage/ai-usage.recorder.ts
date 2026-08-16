import { Injectable } from '@nestjs/common';
import { AiUsageStatus } from '@prisma/client';
import { AiUsageRepository } from './ai-usage.repository';
import { AiDegradation, AiUsageInfo } from '../contracts/ai-invocation.types';

export interface RecordSuccessInput {
  requestId: string;
  tenantId: string;
  branchId?: string;
  userId?: string;
  featureKey: string;
  usage: AiUsageInfo;
  degradations: AiDegradation[];
  status: 'SUCCESS' | 'SCHEMA_REPAIRED';
}

export interface RecordFailureInput {
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
  status: Exclude<AiUsageStatus, 'SUCCESS' | 'SCHEMA_REPAIRED'>;
  errorCode?: string;
  errorMessage?: string;
  latencyMsTotal: number;
  /** false para AI_QUOTA_EXCEEDED / AI_RATE_LIMITED — ver AiUsageRepository. */
  countsTowardLimit: boolean;
}

/**
 * Fachada que usa el gateway — traduce resultados de la invocación a filas
 * de `ai_usage_events`. Escribe siempre, éxito o fallo (D-18). El volcado
 * por lote descrito en §03 del documento ("no debe bloquear la respuesta")
 * es una optimización de throughput diferida: en v1 escribe sincrónicamente.
 */
@Injectable()
export class AiUsageRecorder {
  constructor(private readonly repository: AiUsageRepository) {}

  async recordSuccess(input: RecordSuccessInput): Promise<void> {
    await this.repository.recordEvent({
      requestId: input.requestId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      userId: input.userId,
      featureKey: input.featureKey,
      promptVersion: input.usage.promptVersion,
      schemaVersion: input.usage.schemaVersion,
      providerId: input.usage.providerId,
      modelKey: input.usage.modelKey,
      attemptNumber: input.usage.attemptNumber,
      degradations: input.degradations,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      totalTokens: input.usage.totalTokens,
      estimatedCostMicros: input.usage.estimatedCostMicros,
      latencyMsTotal: input.usage.latencyMsTotal,
      latencyMsProvider: input.usage.latencyMsProvider,
      status: input.status,
      outcome: 'PENDING',
      countsTowardLimit: true,
    });
  }

  async recordFailure(input: RecordFailureInput): Promise<void> {
    await this.repository.recordEvent({
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
      degradations: [],
      estimatedCostMicros: 0n,
      latencyMsTotal: input.latencyMsTotal,
      status: input.status,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage?.slice(0, 500),
      outcome: 'PENDING',
      countsTowardLimit: input.countsTowardLimit,
    });
  }

  /** Reservado para el Product Assistant (Fase 3) — no se ejercita en la Fase 1. */
  async recordOutcome(requestId: string, outcome: 'ACCEPTED' | 'EDITED' | 'DISCARDED'): Promise<void> {
    await this.repository.setOutcome(requestId, outcome);
  }
}
