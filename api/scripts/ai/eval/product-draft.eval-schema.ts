import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Schema de evaluación del Product Assistant — Fase 2, no Fase 3. Existe
 * solo para que el conjunto de evaluación (§16, §20 del documento de
 * arquitectura) tenga un contrato contra el cual medir a los modelos
 * candidatos ANTES de construir `ProductAIService`. Cuando llegue la
 * Fase 3, `product-draft.schema.ts` real vive en
 * `modules/retail/products/ai/` y puede — pero no tiene por qué — ser
 * idéntico a este; este archivo no forma parte de la plataforma de IA en
 * tiempo de ejecución (no está en `src/ai/`, no lo importa `AiSchemaRegistry`).
 */
export const productDraftEvalSchema = z.object({
  name: z.string().min(1).max(200),
  categoryName: z.string().min(1).max(100),
  unitName: z.string().min(1).max(50),
  costPrice: z.number().nonnegative().nullable(),
  price: z.number().nonnegative(),
  taxCode: z.enum(['IVA_16', 'IVA_11', 'IVA_8', 'EXCENTO']),
  description: z.string().max(500).nullable(),
});

export type ProductDraftEval = z.infer<typeof productDraftEvalSchema>;

export const productDraftEvalJsonSchema = zodToJsonSchema(productDraftEvalSchema, {
  $refStrategy: 'none',
}) as Record<string, unknown>;
