import { z } from 'zod';

/**
 * Contrato de salida del Product Assistant (Fase 3, §07/§08 del documento
 * de arquitectura). Vive junto al dominio de productos, no en `src/ai/` —
 * la plataforma de IA no conoce las reglas de negocio de un producto. Se
 * registra en `AiSchemaRegistry` desde `ProductsAiModule`.
 *
 * Sin ningún campo de tipo id (regla 03): `categoryName` es un nombre, no
 * un `categoryId` — el modelo no puede alucinar un UUID que no existe si el
 * schema no le permite emitir UUIDs. El reconciliador es quien resuelve
 * nombres a entidades reales del tenant.
 *
 * Campos de `Product` (prisma/schema.prisma) que el asistente NO propone,
 * a propósito: `stock` (siempre 0 en el alta — regla 08), `status`
 * (siempre DRAFT), `isEcommerce` (decisión de negocio del usuario),
 * `taxRate` (derivado de `taxCode`, no un dato independiente), `slug` y
 * `sku` finales (Orbix tiene la autoridad), `type` (siempre SIMPLE en v1),
 * `metaTitle`/`metaDescription` (solo importan si `isEcommerce`, que la IA
 * nunca activa — proponerlos sería trabajo desperdiciado la mayoría de
 * las veces).
 */
export const productDraftSchema = z.object({
  name: z.string().min(1).max(200),
  categoryName: z.string().min(1).max(100),
  price: z.number().nonnegative(),
  /** Precio "antes" — null si no se mencionó ningún precio de comparación. */
  comparePrice: z.number().nonnegative().nullable(),
  /** null cuando la entrada no mencionó costo — nunca se infiere (§07). */
  costPrice: z.number().nonnegative().nullable(),
  taxCode: z.enum(['IVA_16', 'IVA_11', 'IVA_8', 'EXCENTO']),
  description: z.string().max(500).nullable(),
  /** Sugerencia legible, no autoritativa — Orbix regenera si choca (§08). */
  skuSuggestion: z.string().max(50).nullable(),
  /** null si no hay señal — Orbix usa el default del tenant (§08). */
  trackInventory: z.boolean().nullable(),
  /** null si no hay señal — Orbix usa el default del tenant (§08). */
  lowStockAlert: z.number().int().nonnegative().nullable(),
  confidence: z.number().min(0).max(1),
});

export type ProductDraftOutput = z.infer<typeof productDraftSchema>;
