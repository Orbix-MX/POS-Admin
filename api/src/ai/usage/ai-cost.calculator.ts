import { Injectable } from '@nestjs/common';
import { getModelCatalogEntry } from '../config/ai-model.catalog';

/**
 * Micro-USD (D-08). `mock` no representa infraestructura real — su entrada
 * en el catálogo tiene `costPerMTokMicros* = null` y este método devuelve
 * 0n, honestamente, en vez de simular un costo que no existe. El costo
 * sombra del modelo local (§13: costo del host ÷ tokens servidos) se
 * configura como la tarifa de ese modelo en el catálogo a partir de la
 * Fase 2, cuando se conozca el costo real del VPS de inferencia.
 */
@Injectable()
export class AiCostCalculator {
  estimate(modelKey: string, inputTokens = 0, outputTokens = 0): bigint {
    const model = getModelCatalogEntry(modelKey);
    if (!model) return 0n;

    const inCost =
      model.costPerMTokMicrosIn != null
        ? (BigInt(inputTokens) * BigInt(model.costPerMTokMicrosIn)) / 1_000_000n
        : 0n;
    const outCost =
      model.costPerMTokMicrosOut != null
        ? (BigInt(outputTokens) * BigInt(model.costPerMTokMicrosOut)) / 1_000_000n
        : 0n;

    return inCost + outCost;
  }
}
