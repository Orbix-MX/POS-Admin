import { AICapability } from './ai-capability.enum';

/**
 * Degradación que ocurrió durante una invocación exitosa. Se reporta siempre
 * — regla 08 del documento de arquitectura: ninguna degradación es silenciosa.
 */
export type AiDegradation = 'schema_repaired' | 'partial_output';

/**
 * Contexto de una invocación en curso. `deadline` es un instante absoluto
 * (epoch ms), no un timeout relativo, para que el presupuesto de tiempo se
 * reparta correctamente entre el reintento de red y el de reparación de
 * schema — ver AiExecutionService.
 */
export interface InvocationContext {
  requestId: string;
  tenantId: string;
  userId?: string;
  branchId?: string;
  deadline: number;
  signal?: AbortSignal;
}

/** Lo que un consumidor (ProductAIService, la feature de humo ai.echo) le pide al gateway. */
export interface AiInvocation<TInput = unknown> {
  featureKey: string;
  input: TInput;
  /** Capacidades adicionales requeridas más allá de las declaradas por la feature. */
  requires?: AICapability[];
}

export interface AiUsageInfo {
  providerId: string;
  modelKey: string;
  promptVersion: number;
  schemaVersion: number;
  attemptNumber: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  /** Micro-USD. Nunca float — ver D-08. */
  estimatedCostMicros: bigint;
  latencyMsTotal: number;
  latencyMsProvider?: number;
}

/** Lo que el gateway devuelve tras una invocación exitosa (incluida la degradada). */
export interface AiResult<TOutput = unknown> {
  requestId: string;
  featureKey: string;
  data: TOutput;
  degradations: AiDegradation[];
  /** Presente solo cuando el draft es parcial — campos que no pasaron el schema. */
  fieldsFailed?: string[];
  usage: AiUsageInfo;
}
