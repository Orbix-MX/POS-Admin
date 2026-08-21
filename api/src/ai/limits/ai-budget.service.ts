import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiException } from '../contracts/ai-error';
import { getModelCatalogEntry } from '../config/ai-model.catalog';
import { currentDay, currentPeriod } from '../usage/period.util';

/** USD/MTok/etc. — valores de partida conservadores, no un compromiso comercial (mismo espíritu que AiQuotaService). */
const DEFAULT_DAILY_USD = 5;
const DEFAULT_MONTHLY_USD = 100;

function usdToMicros(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

/**
 * Kill switch de gasto de toda la plataforma frente a proveedores de pago —
 * Fase 4. Distinto de `AiQuotaService` (límite por tenant): este límite es
 * global, y solo actúa sobre modelos con tarifa real en el catálogo
 * (`costPerMTokMicros* !== null`) — así `local`/`mock` quedan exentos sin
 * mantener una segunda lista de "qué proveedores cuestan dinero".
 *
 * Rehidrata el gasto acumulado del día/mes en curso desde `ai_usage_events`
 * una sola vez en `onModuleInit`: un contador solo en memoria perdería el
 * gasto acumulado si el proceso se reinicia, y el kill switch fallaría
 * abierto justo cuando más importa. Después de esa lectura inicial,
 * incrementa en memoria — coherente con D-09 (sin Redis todavía).
 */
@Injectable()
export class AiBudgetService implements OnModuleInit {
  private readonly logger = new Logger(AiBudgetService.name);

  private readonly dailyCapMicros: bigint;
  private readonly monthlyCapMicros: bigint;

  private dailyKey: string;
  private monthlyKey: string;
  private dailySpentMicros = 0n;
  private monthlySpentMicros = 0n;

  constructor(private readonly prisma: PrismaService) {
    const dailyUsd = Number(process.env.AI_BUDGET_DAILY_USD ?? DEFAULT_DAILY_USD);
    const monthlyUsd = Number(process.env.AI_BUDGET_MONTHLY_USD ?? DEFAULT_MONTHLY_USD);
    this.dailyCapMicros = usdToMicros(dailyUsd);
    this.monthlyCapMicros = usdToMicros(monthlyUsd);

    const now = new Date();
    this.dailyKey = currentDay(now);
    this.monthlyKey = currentPeriod(now);
  }

  async onModuleInit(): Promise<void> {
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [dayAgg, monthAgg] = await Promise.all([
      this.prisma.aiUsageEvent.aggregate({
        _sum: { estimatedCostMicros: true },
        where: { createdAt: { gte: dayStart } },
      }),
      this.prisma.aiUsageEvent.aggregate({
        _sum: { estimatedCostMicros: true },
        where: { createdAt: { gte: monthStart } },
      }),
    ]);

    this.dailySpentMicros = dayAgg._sum.estimatedCostMicros ?? 0n;
    this.monthlySpentMicros = monthAgg._sum.estimatedCostMicros ?? 0n;
    this.logger.log(
      `Presupuesto rehidratado — día: ${this.dailySpentMicros}µ / ${this.dailyCapMicros}µ, mes: ${this.monthlySpentMicros}µ / ${this.monthlyCapMicros}µ`,
    );
  }

  /** Verificación previa, de solo lectura. Exenta a modelos sin tarifa real (local/mock). */
  assertWithinBudget(modelKey: string): void {
    const model = getModelCatalogEntry(modelKey);
    if (!model || (model.costPerMTokMicrosIn === null && model.costPerMTokMicrosOut === null)) return;

    this.rollWindowsIfNeeded();

    if (this.dailySpentMicros >= this.dailyCapMicros) {
      throw new AiException('AI_BUDGET_EXCEEDED', 'Se alcanzó el límite diario de gasto en proveedores de IA de pago.');
    }
    if (this.monthlySpentMicros >= this.monthlyCapMicros) {
      throw new AiException('AI_BUDGET_EXCEEDED', 'Se alcanzó el límite mensual de gasto en proveedores de IA de pago.');
    }
  }

  /** Post-invocación. `costMicros` de un modelo exento (0n) es un no-op inofensivo. */
  recordSpend(costMicros: bigint): void {
    if (costMicros <= 0n) return;
    this.rollWindowsIfNeeded();
    this.dailySpentMicros += costMicros;
    this.monthlySpentMicros += costMicros;
  }

  private rollWindowsIfNeeded(): void {
    const now = new Date();
    const day = currentDay(now);
    const month = currentPeriod(now);

    if (day !== this.dailyKey) {
      this.dailyKey = day;
      this.dailySpentMicros = 0n;
    }
    if (month !== this.monthlyKey) {
      this.monthlyKey = month;
      this.monthlySpentMicros = 0n;
    }
  }
}
