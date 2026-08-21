import { AICapability } from './ai-capability.enum';

/**
 * Política de datos personales de una feature. Se aplica declarativamente:
 * en v1, con un único proveedor local, ninguna feature envía datos a un
 * tercero, así que no existe un servicio de enforcement — ver §14 del
 * documento de arquitectura. Vuelve con enforcement real en la Fase 4.
 */
export type AiPiiLevel = 'NONE' | 'REDACT' | 'LOCAL_ONLY';

/**
 * Qué necesita una feature de IA, declarado en código — nunca en una tabla.
 * No decide quién la atiende (eso es `config/ai-feature.binding.ts`): decide
 * qué schema valida su salida, qué capacidades requiere del proveedor y qué
 * tan sensible es su dato.
 */
export interface AiFeatureDef {
  key: string;
  /** Clave que resuelve `AiSchemaRegistry` — ver schemas/ai-schema.registry.ts. */
  schemaKey: string;
  requires: AICapability[];
  piiLevel: AiPiiLevel;
}

export const AI_FEATURES: Readonly<Record<string, AiFeatureDef>> = {
  'ai.echo': {
    key: 'ai.echo',
    schemaKey: 'ai.echo.v1',
    // STRUCTURED_NATIVE, no STRUCTURED_GRAMMAR: Orbix envía `response_format`
    // (JSON Schema estándar) y deja que el proveedor lo traduzca a su propio
    // mecanismo — llama.cpp y Ollama lo hacen internamente a GBNF. Orbix no
    // construye gramática a mano en v1 (ver providers/openai-compatible/).
    requires: [AICapability.CHAT, AICapability.STRUCTURED_NATIVE],
    piiLevel: 'NONE',
  },
  /**
   * Product Assistant — Fase 3. Sin datos personales: nombre, categoría,
   * precio y costo de un producto de catálogo, nunca información de un
   * cliente. El schema (`products.draft.v1`) lo registra
   * `ProductsAiModule` — ver modules/retail/products/ai/.
   */
  'products.draft': {
    key: 'products.draft',
    schemaKey: 'products.draft.v1',
    requires: [AICapability.CHAT, AICapability.STRUCTURED_NATIVE],
    piiLevel: 'NONE',
  },
};

export function getFeatureDef(featureKey: string): AiFeatureDef | undefined {
  return AI_FEATURES[featureKey];
}
