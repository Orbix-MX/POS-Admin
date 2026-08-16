/**
 * `feature → { proveedor, modelo, prompt, parámetros }` — ADR-0026 (D-17).
 * Sin tabla `ai_routing_policy`: cambiar el modelo de una feature es cambiar
 * esta constante o exportar la variable de entorno de override, no una
 * migración ni un despliegue de código en `ProductAIService`.
 */
export interface AiFeatureBinding {
  providerId: string;
  modelKey: string;
  promptVersion: number;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
}

export const AI_FEATURE_BINDINGS: Readonly<Record<string, AiFeatureBinding>> = {
  'ai.echo': {
    providerId: 'mock',
    modelKey: 'mock-echo-v1',
    promptVersion: 1,
    temperature: 0,
    maxOutputTokens: 200,
    timeoutMs: 5_000,
  },
  // D-06 cerrada: Llama-3.2-3B-Instruct, servido desde Ollama en desarrollo
  // (AI_LOCAL_BASE_URL). Sin servidor de producción todavía — ver §Fase 2
  // del documento de arquitectura. Override de modelo con AI_PRODUCTS_DRAFT_MODEL.
  'products.draft': {
    providerId: 'local',
    modelKey: 'llama3.2:latest',
    promptVersion: 1,
    temperature: 0.2,
    maxOutputTokens: 700,
    timeoutMs: 45_000,
  },
};

/**
 * Nombre de la variable de entorno que sobrescribe el modelo de una feature,
 * p. ej. `products.draft` → `AI_PRODUCTS_DRAFT_MODEL` (ejemplo del §11 del
 * documento de arquitectura).
 */
function overrideEnvVarName(featureKey: string): string {
  return `AI_${featureKey.toUpperCase().replace(/[.-]/g, '_')}_MODEL`;
}

export function getFeatureBinding(featureKey: string): AiFeatureBinding {
  const base = AI_FEATURE_BINDINGS[featureKey];
  if (!base) {
    throw new Error(
      `AiFeatureBinding: no hay binding configurado para la feature "${featureKey}".`,
    );
  }

  const overrideModel = process.env[overrideEnvVarName(featureKey)];
  return overrideModel ? { ...base, modelKey: overrideModel } : base;
}
