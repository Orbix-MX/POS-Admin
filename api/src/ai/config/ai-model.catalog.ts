import { AICapability } from '../contracts/ai-capability.enum';

/**
 * `feature → modelo` sin tabla de routing — ADR-0026. Constante en código,
 * no migración: con un solo proveedor no hay nada que resolver en tiempo de
 * ejecución más allá de "qué modelo sirve esta feature", y eso lo decide
 * quien despliega, no un usuario.
 */
export interface AiModelCatalogEntry {
  providerId: string;
  modelKey: string;
  capabilities: AICapability[];
  contextWindow: number;
  /**
   * Micro-USD por millón de tokens. `null` cuando el proveedor no representa
   * infraestructura real que facturar — es el caso de `mock`, usado en la
   * Fase 1 antes de que exista el servidor de inferencia local. El costo
   * sombra del modelo local (§13 del documento de arquitectura) se
   * configura aquí en la Fase 2, cuando se conozca el costo del host.
   */
  costPerMTokMicrosIn: number | null;
  costPerMTokMicrosOut: number | null;
}

export const AI_MODEL_CATALOG: Readonly<Record<string, AiModelCatalogEntry>> = {
  'mock-echo-v1': {
    providerId: 'mock',
    modelKey: 'mock-echo-v1',
    capabilities: [AICapability.CHAT, AICapability.STRUCTURED_NATIVE],
    contextWindow: 8192,
    costPerMTokMicrosIn: null,
    costPerMTokMicrosOut: null,
  },
  /**
   * D-06 cerrada (16 ago 2026): llama3.2:3B, no Qwen3-4B. Motivo — ver el
   * informe de benchmark de Fase 2: 30/30 JSON válido, 0/30 costos
   * inventados; Qwen3-4B vía Ollama quedó bloqueado por su modo "thinking"
   * (consume el presupuesto de salida completo razonando, sin llegar a
   * emitir el JSON, y `think:false` no lo suprimió en esta versión).
   * `costPerMTokMicrosIn/Out: null` porque todavía no hay servidor de
   * inferencia propio — se sirve desde Ollama en la máquina de desarrollo,
   * no desde un VPS. Ningún binding de feature apunta aquí todavía: llega
   * con `products.draft` en la Fase 3.
   */
  'llama3.2:latest': {
    providerId: 'local',
    modelKey: 'llama3.2:latest',
    capabilities: [AICapability.CHAT, AICapability.STRUCTURED_NATIVE],
    contextWindow: 8192,
    costPerMTokMicrosIn: null,
    costPerMTokMicrosOut: null,
  },
  /**
   * Fase 4: primer proveedor de pago. Tarifas confirmadas contra
   * platform.claude.com/docs/en/about-claude/pricing el 16 ago 2026 —
   * Claude Haiku 4.5, $1/MTok entrada, $5/MTok salida (sin caché). Ningún
   * binding de feature apunta aquí todavía: el registro habilita al
   * proveedor y al kill switch de gasto, no re-enruta `products.draft`.
   */
  'claude-haiku-4-5-20251001': {
    providerId: 'anthropic',
    modelKey: 'claude-haiku-4-5-20251001',
    capabilities: [AICapability.CHAT, AICapability.STRUCTURED_NATIVE],
    contextWindow: 200_000,
    costPerMTokMicrosIn: 1_000_000,
    costPerMTokMicrosOut: 5_000_000,
  },
  /**
   * Fase 4. Tarifas confirmadas contra ai.google.dev/gemini-api/docs/pricing
   * el 16 ago 2026 — Gemini 2.5 Flash, $0.30/MTok entrada, $2.50/MTok
   * salida, nivel estándar de pago. Se registra vía `OpenAICompatibleProvider`
   * (capa de compatibilidad OpenAI de Google) — sin adaptador propio.
   */
  'gemini-2.5-flash': {
    providerId: 'gemini',
    modelKey: 'gemini-2.5-flash',
    capabilities: [AICapability.CHAT, AICapability.STRUCTURED_NATIVE],
    contextWindow: 1_000_000,
    costPerMTokMicrosIn: 300_000,
    costPerMTokMicrosOut: 2_500_000,
  },
};

export function getModelCatalogEntry(modelKey: string): AiModelCatalogEntry | undefined {
  return AI_MODEL_CATALOG[modelKey];
}
