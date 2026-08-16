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
};

export function getModelCatalogEntry(modelKey: string): AiModelCatalogEntry | undefined {
  return AI_MODEL_CATALOG[modelKey];
}
