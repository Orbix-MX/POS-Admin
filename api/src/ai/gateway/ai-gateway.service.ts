import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { AuditContextService } from '../../common/context/audit-context.service';
import { AiRequestValidator } from './ai-request.validator';
import { AiExecutionService } from './ai-execution.service';
import { AiQuotaService } from '../limits/ai-quota.service';
import { AiRateLimitService } from '../limits/ai-rate-limit.service';
import { AiBudgetService } from '../limits/ai-budget.service';
import { PromptRegistry } from '../prompts/prompt-registry.service';
import { PromptRenderer } from '../prompts/prompt-renderer.service';
import { AiSchemaRegistry } from '../schemas/ai-schema.registry';
import { StructuredOutputService } from '../schemas/structured-output.service';
import { AiProviderRegistry } from '../providers/ai-provider.registry';
import { ChatMessage, ChatRequest, ChatResult } from '../providers/ai-provider.port';
import { AiUsageRecorder } from '../usage/ai-usage.recorder';
import { AiCostCalculator } from '../usage/ai-cost.calculator';
import { AiMetrics } from '../observability/ai-metrics';
import { getFeatureBinding } from '../config/ai-feature.binding';
import { AiException } from '../contracts/ai-error';
import { AiDegradation, AiInvocation, AiResult, AiUsageInfo, InvocationContext } from '../contracts/ai-invocation.types';
import { AICapability } from '../contracts/ai-capability.enum';

/**
 * Única superficie pública de la plataforma de IA (§03). Secuencia
 * colaboradores; no contiene decisiones propias. Cada paso numerado en los
 * comentarios corresponde al Diagrama 2 del documento de arquitectura.
 *
 * La resolución de binding y schema se adelanta antes de la verificación de
 * límites (a diferencia del orden estrictamente dibujado en el diagrama):
 * ambas son consultas en memoria sin costo, y adelantarlas permite que un
 * rechazo por cuota o por ráfaga también registre `providerId`/`modelKey`
 * en su evento de consumo — el modelo de datos los exige `NOT NULL` porque
 * todo evento nombra qué modelo lo habría atendido, incluso si nunca llegó
 * a él.
 */
@Injectable()
export class AiGatewayService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly auditContext: AuditContextService,
    private readonly validator: AiRequestValidator,
    private readonly quota: AiQuotaService,
    private readonly rateLimit: AiRateLimitService,
    private readonly budget: AiBudgetService,
    private readonly promptRegistry: PromptRegistry,
    private readonly promptRenderer: PromptRenderer,
    private readonly schemaRegistry: AiSchemaRegistry,
    private readonly structuredOutput: StructuredOutputService,
    private readonly execution: AiExecutionService,
    private readonly providerRegistry: AiProviderRegistry,
    private readonly usageRecorder: AiUsageRecorder,
    private readonly costCalculator: AiCostCalculator,
    private readonly metrics: AiMetrics,
  ) {}

  async generate<TOutput = unknown>(
    invocation: AiInvocation,
    variables: Record<string, string>,
  ): Promise<AiResult<TOutput>> {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();
    const branchId = this.tenantContext.getBranchId();

    // 1 · Validator
    const featureDef = this.validator.validate(invocation);

    // 3 · Feature binding + 5 · Schema — resueltos temprano (ver nota de clase).
    const binding = getFeatureBinding(featureDef.key);
    const schemaDef = this.schemaRegistry.resolve(featureDef.schemaKey);
    const provider = this.providerRegistry.resolve(binding.providerId);
    const requiredCapabilities = [...new Set([...featureDef.requires, ...(invocation.requires ?? [])])];

    if (!provider.supports(requiredCapabilities)) {
      // Un binding que apunta a un proveedor que no cumple las capacidades
      // de la feature es un error de configuración, no una condición que
      // el usuario pueda causar o resolver.
      throw new Error(
        `AiGatewayService: el proveedor "${provider.id}" no soporta las capacidades requeridas por "${featureDef.key}".`,
      );
    }

    let tenantSlotAcquired = false;

    try {
      // 2 · Limits
      this.rateLimit.assertBurstOk(userId ?? tenantId);
      this.rateLimit.acquireTenantSlot(tenantId);
      tenantSlotAcquired = true;
      await this.quota.assertCanInvoke(tenantId, featureDef.key);
      this.budget.assertWithinBudget(binding.modelKey);
    } catch (err) {
      if (tenantSlotAcquired) this.rateLimit.releaseTenantSlot(tenantId);
      await this.recordRejection(err, {
        requestId,
        tenantId,
        branchId,
        userId,
        featureKey: featureDef.key,
        promptVersion: binding.promptVersion,
        schemaVersion: schemaDef.version,
        providerId: provider.id,
        modelKey: binding.modelKey,
        startedAt,
      });
      throw err;
    }

    try {
      // 4 · Prompt
      const template = this.promptRegistry.resolve(featureDef.key, binding.promptVersion);
      const messages = this.promptRenderer.render(template, variables);

      const ctx: InvocationContext = {
        requestId,
        tenantId,
        userId,
        branchId,
        deadline: startedAt + binding.timeoutMs,
      };

      const requiresStructuredOutput = requiredCapabilities.some(
        (cap) => cap === AICapability.STRUCTURED_GRAMMAR || cap === AICapability.STRUCTURED_NATIVE,
      );

      const chatReq: ChatRequest = {
        modelKey: binding.modelKey,
        messages,
        temperature: binding.temperature,
        maxOutputTokens: binding.maxOutputTokens,
        structuredOutput: requiresStructuredOutput
          ? { name: schemaDef.key, schema: schemaDef.jsonSchema, strict: true }
          : undefined,
      };

      return await this.executeAndValidate<TOutput>({
        provider,
        chatReq,
        ctx,
        featureKey: featureDef.key,
        binding,
        schemaDef,
        requestId,
        tenantId,
        branchId,
        userId,
        startedAt,
      });
    } finally {
      this.rateLimit.releaseTenantSlot(tenantId);
    }
  }

  private async executeAndValidate<TOutput>(args: {
    provider: ReturnType<AiProviderRegistry['resolve']>;
    chatReq: ChatRequest;
    ctx: InvocationContext;
    featureKey: string;
    binding: ReturnType<typeof getFeatureBinding>;
    schemaDef: ReturnType<AiSchemaRegistry['resolve']>;
    requestId: string;
    tenantId: string;
    branchId?: string;
    userId?: string;
    startedAt: number;
  }): Promise<AiResult<TOutput>> {
    const { provider, chatReq, ctx, featureKey, binding, schemaDef, requestId, tenantId, branchId, userId, startedAt } = args;

    let attemptNumber = 1;
    let chatResult: ChatResult;
    let attemptedCostMicros = 0n;

    try {
      chatResult = await this.execution.execute(provider, chatReq, ctx);
    } catch (err) {
      await this.recordExecutionFailure(err, {
        requestId, tenantId, branchId, userId, featureKey,
        promptVersion: binding.promptVersion, schemaVersion: schemaDef.version,
        providerId: provider.id, modelKey: binding.modelKey, attemptNumber, startedAt,
      });
      throw err;
    }

    attemptedCostMicros += this.costCalculator.estimate(binding.modelKey, chatResult.inputTokens ?? 0, chatResult.outputTokens ?? 0);

    let parsed = this.structuredOutput.parse<TOutput>(chatResult.content, schemaDef.schema);
    let degradations: AiDegradation[] = [];

    if (!parsed.ok) {
      // Reparación acotada a un solo reintento (§05).
      attemptNumber = 2;
      const repairMessages = this.buildRepairMessages(chatReq.messages, chatResult.content, parsed.errorMessage ?? '');

      try {
        chatResult = await this.execution.execute(provider, { ...chatReq, messages: repairMessages }, ctx);
      } catch (err) {
        await this.recordExecutionFailure(err, {
          requestId, tenantId, branchId, userId, featureKey,
          promptVersion: binding.promptVersion, schemaVersion: schemaDef.version,
          providerId: provider.id, modelKey: binding.modelKey, attemptNumber, startedAt,
        });
        throw err;
      }

      attemptedCostMicros += this.costCalculator.estimate(binding.modelKey, chatResult.inputTokens ?? 0, chatResult.outputTokens ?? 0);
      parsed = this.structuredOutput.parse<TOutput>(chatResult.content, schemaDef.schema);

      if (!parsed.ok) {
        this.metrics.recordOutputInvalid(featureKey);
        const latencyMsTotal = Date.now() - startedAt;
        // Ambos intentos llegaron al proveedor y consumieron tokens
        // facturables — se registra el costo real, no 0n (hueco corregido
        // en Fase 4: con un proveedor de pago, un kill switch que no cuenta
        // el gasto de los intentos fallidos no es un kill switch real).
        await this.usageRecorder.recordFailure({
          requestId, tenantId, branchId, userId, featureKey,
          promptVersion: binding.promptVersion, schemaVersion: schemaDef.version,
          providerId: provider.id, modelKey: binding.modelKey, attemptNumber,
          status: 'OUTPUT_INVALID', errorCode: 'AI_OUTPUT_INVALID', errorMessage: parsed.errorMessage,
          latencyMsTotal, countsTowardLimit: true, estimatedCostMicros: attemptedCostMicros,
        });
        this.budget.recordSpend(attemptedCostMicros);
        this.metrics.recordRequest(featureKey, 'OUTPUT_INVALID');
        this.metrics.recordDuration(featureKey, latencyMsTotal);
        throw new AiException('AI_OUTPUT_INVALID', 'No se pudo interpretar la respuesta del asistente.');
      }

      degradations = ['schema_repaired'];
    }

    const latencyMsTotal = Date.now() - startedAt;
    const usage: AiUsageInfo = {
      providerId: provider.id,
      modelKey: binding.modelKey,
      promptVersion: binding.promptVersion,
      schemaVersion: schemaDef.version,
      attemptNumber,
      inputTokens: chatResult.inputTokens,
      outputTokens: chatResult.outputTokens,
      totalTokens: chatResult.totalTokens ?? this.sumTokens(chatResult),
      estimatedCostMicros: attemptedCostMicros,
      latencyMsTotal,
      latencyMsProvider: chatResult.latencyMsProvider,
    };

    const status = degradations.includes('schema_repaired') ? 'SCHEMA_REPAIRED' : 'SUCCESS';

    await this.usageRecorder.recordSuccess({
      requestId, tenantId, branchId, userId, featureKey, usage, degradations, status,
    });
    this.budget.recordSpend(attemptedCostMicros);

    this.metrics.recordRequest(featureKey, status);
    this.metrics.recordDuration(featureKey, latencyMsTotal);
    this.metrics.recordTokens(usage.inputTokens ?? 0, usage.outputTokens ?? 0);
    if (status === 'SCHEMA_REPAIRED') this.metrics.recordSchemaRepair(featureKey);

    return {
      requestId,
      featureKey,
      data: parsed.data as TOutput,
      degradations,
      usage,
    };
  }

  private async recordRejection(
    err: unknown,
    ctx: {
      requestId: string; tenantId: string; branchId?: string; userId?: string;
      featureKey: string; promptVersion: number; schemaVersion: number;
      providerId: string; modelKey: string; startedAt: number;
    },
  ): Promise<void> {
    if (!(err instanceof AiException)) return; // programación, no runtime — nada que registrar como evento de negocio.

    const status =
      err.code === 'AI_QUOTA_EXCEEDED'
        ? 'QUOTA_EXCEEDED'
        : err.code === 'AI_BUDGET_EXCEEDED'
          ? 'BUDGET_EXCEEDED'
          : 'RATE_LIMITED';
    const latencyMsTotal = Date.now() - ctx.startedAt;

    await this.usageRecorder.recordFailure({
      requestId: ctx.requestId, tenantId: ctx.tenantId, branchId: ctx.branchId, userId: ctx.userId,
      featureKey: ctx.featureKey, promptVersion: ctx.promptVersion, schemaVersion: ctx.schemaVersion,
      providerId: ctx.providerId, modelKey: ctx.modelKey, attemptNumber: 1,
      status, errorCode: err.code, errorMessage: err.message,
      latencyMsTotal, countsTowardLimit: false,
    });

    this.metrics.recordRequest(ctx.featureKey, status);
    this.metrics.recordDuration(ctx.featureKey, latencyMsTotal);
  }

  private async recordExecutionFailure(
    err: unknown,
    ctx: {
      requestId: string; tenantId: string; branchId?: string; userId?: string;
      featureKey: string; promptVersion: number; schemaVersion: number;
      providerId: string; modelKey: string; attemptNumber: number; startedAt: number;
    },
  ): Promise<void> {
    const status = err instanceof AiException && err.code === 'AI_TIMEOUT' ? 'TIMEOUT' : 'PROVIDER_ERROR';
    const errorCode = err instanceof AiException ? err.code : 'AI_PROVIDER_UNAVAILABLE';
    const errorMessage = err instanceof Error ? err.message : String(err);
    const latencyMsTotal = Date.now() - ctx.startedAt;

    await this.usageRecorder.recordFailure({
      requestId: ctx.requestId, tenantId: ctx.tenantId, branchId: ctx.branchId, userId: ctx.userId,
      featureKey: ctx.featureKey, promptVersion: ctx.promptVersion, schemaVersion: ctx.schemaVersion,
      providerId: ctx.providerId, modelKey: ctx.modelKey, attemptNumber: ctx.attemptNumber,
      status, errorCode, errorMessage,
      latencyMsTotal, countsTowardLimit: true,
    });

    this.metrics.recordRequest(ctx.featureKey, status);
    this.metrics.recordDuration(ctx.featureKey, latencyMsTotal);
  }

  private buildRepairMessages(original: ChatMessage[], previousContent: string, errorMessage: string): ChatMessage[] {
    return [
      ...original,
      { role: 'assistant', content: previousContent },
      {
        role: 'user',
        content: `Tu respuesta anterior no fue válida: ${errorMessage}\n\nResponde de nuevo, solo con el objeto JSON del schema.`,
      },
    ];
  }

  private sumTokens(chatResult: ChatResult): number | undefined {
    if (chatResult.inputTokens == null && chatResult.outputTokens == null) return undefined;
    return (chatResult.inputTokens ?? 0) + (chatResult.outputTokens ?? 0);
  }
}
