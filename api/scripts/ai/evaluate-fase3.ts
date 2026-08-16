/**
 * Corre el conjunto de evaluación (30 casos, Fase 0/2) contra el código
 * REAL de Fase 3 — el mismo `productDraftSchema`, la misma plantilla de
 * prompt (`products.draft/v1.md` vía `PromptRegistry`/`PromptRenderer`) y
 * el mismo `ProductDraftReconciler` que corre en producción. No es el
 * arnés paralelo de la Fase 2 (`scripts/ai/eval/`) — ese medía si un
 * modelo podía en principio resolver la tarea; este mide si el código que
 * de verdad se despliega cumple el criterio de aceptación de la Fase 3:
 * ≥80% schema válido, ≥70% categoría correcta.
 *
 * El catálogo de categorías es sintético (el mismo del §Fase 2), no el de
 * un tenant real — así el número mide al reconciliador, no a qué tan
 * parecido es el catálogo de un tenant en particular al del enunciado.
 *
 * Uso: pnpm exec tsx scripts/ai/evaluate-fase3.ts
 */
import { PromptRegistry } from '../../src/ai/prompts/prompt-registry.service';
import { PromptRenderer } from '../../src/ai/prompts/prompt-renderer.service';
import { OpenAICompatibleProvider } from '../../src/ai/providers/openai-compatible/openai-compatible.provider';
import { InvocationContext } from '../../src/ai/contracts/ai-invocation.types';
import { productDraftSchema, ProductDraftOutput } from '../../src/modules/retail/products/ai/product-draft.schema';
import { ProductDraftReconciler } from '../../src/modules/retail/products/ai/product-draft.reconciler';
import { EVAL_DATASET } from './eval/dataset';
import { summarize } from './lib/stats';

// Necesitamos el jsonSchema derivado del mismo Zod real — sin pasar por
// AiSchemaRegistry (que exige NestJS DI); reimplementamos la misma línea
// que usa ese registro, deliberadamente, para no divergir en silencio.
import { zodToJsonSchema } from 'zod-to-json-schema';
const productDraftJsonSchema = zodToJsonSchema(productDraftSchema, { $refStrategy: 'none' }) as Record<string, unknown>;

const SYNTHETIC_CATEGORIES = [
  'Bebidas', 'Botanas', 'Lácteos', 'Abarrotes', 'Panadería',
  'Dulcería', 'Cigarros y encendedores', 'Cuidado personal', 'Limpieza', 'Preparados',
];

interface FakeCategoryRow {
  id: string;
  name: string;
}

function buildReconciler(): ProductDraftReconciler {
  const categoryRows: FakeCategoryRow[] = SYNTHETIC_CATEGORIES.map((name, i) => ({
    id: `cat-${i}`,
    name,
  }));

  const mockPrisma = {
    category: {
      findMany: () => Promise.resolve(categoryRows),
    },
    product: {
      // Catálogo vacío: mide la generación de SKU, no choques con productos reales.
      findMany: () => Promise.resolve([]),
    },
  };
  const mockTenantContext = { requireTenantId: () => 'eval-tenant' };

  return new ProductDraftReconciler(mockPrisma as any, mockTenantContext as any);
}

interface Fase3Score {
  id: string;
  latencyMs: number;
  schemaValid: boolean;
  parseError?: string;
  categoryCorrect: boolean;
  taxCodeCorrect: boolean;
  priceError: number | null;
  costHallucinated: boolean;
  costMissed: boolean;
}

async function main(): Promise<void> {
  // AI_EVAL_BASE_URL/AI_EVAL_API_KEY permiten apuntar a cualquier runtime
  // OpenAI-compatible (Gemini incluido) sin tocar el default de local — Fase 4.
  const baseUrl = process.env.AI_EVAL_BASE_URL ?? process.env.AI_LOCAL_BASE_URL ?? 'http://localhost:11434';
  const apiKey = process.env.AI_EVAL_API_KEY;
  const model = process.argv[2] ?? 'llama3.2:latest';

  const provider = new OpenAICompatibleProvider({ id: 'eval-fase3', baseUrl, apiKey });
  const health = await provider.health();
  if (!health.up) {
    console.error(`El servidor no responde en ${baseUrl}. Abortando.`);
    process.exit(1);
  }

  const promptRegistry = new PromptRegistry();
  const promptRenderer = new PromptRenderer();
  const template = promptRegistry.resolve('products.draft', 1);
  const reconciler = buildReconciler();

  const scores: Fase3Score[] = [];

  console.log(`\nEvaluando código REAL de Fase 3 (${model}) contra ${EVAL_DATASET.length} casos...`);

  for (const evalCase of EVAL_DATASET) {
    const messages = promptRenderer.render(template, {
      message: evalCase.input,
      currency: 'MXN',
      categories: SYNTHETIC_CATEGORIES.join(', '),
      taxCodes: 'IVA_16, IVA_11, IVA_8, EXCENTO',
    });

    const ctx: InvocationContext = {
      requestId: `eval-fase3-${evalCase.id}`,
      tenantId: 'eval-tenant',
      deadline: Date.now() + 60_000,
    };

    const startedAt = Date.now();
    try {
      const result = await provider.chat(
        {
          modelKey: model,
          messages,
          temperature: 0.2,
          maxOutputTokens: 700,
          structuredOutput: { name: 'products.draft.v1', schema: productDraftJsonSchema, strict: true },
        },
        ctx,
      );
      const latencyMs = Date.now() - startedAt;

      let parsed: ProductDraftOutput;
      try {
        parsed = JSON.parse(result.content);
      } catch {
        scores.push({ id: evalCase.id, latencyMs, schemaValid: false, parseError: 'JSON inválido', categoryCorrect: false, taxCodeCorrect: false, priceError: null, costHallucinated: false, costMissed: false });
        process.stdout.write('.');
        continue;
      }

      const validated = productDraftSchema.safeParse(parsed);
      if (!validated.success) {
        scores.push({ id: evalCase.id, latencyMs, schemaValid: false, parseError: validated.error.issues.map((i) => i.message).join('; '), categoryCorrect: false, taxCodeCorrect: false, priceError: null, costHallucinated: false, costMissed: false });
        process.stdout.write('.');
        continue;
      }

      const reconciled = await reconciler.reconcile(validated.data);
      const expected = evalCase.expected;

      scores.push({
        id: evalCase.id,
        latencyMs,
        schemaValid: true,
        categoryCorrect: reconciled.category.id !== null && reconciled.category.name.trim().toLowerCase() === expected.categoryName.trim().toLowerCase(),
        taxCodeCorrect: reconciled.taxCode === expected.taxCode,
        priceError: Math.abs(reconciled.price - expected.price),
        costHallucinated: expected.costPrice === null && reconciled.costPrice !== null,
        costMissed: expected.costPrice !== null && reconciled.costPrice === null,
      });
    } catch (err) {
      scores.push({
        id: evalCase.id,
        latencyMs: Date.now() - startedAt,
        schemaValid: false,
        parseError: `Fallo de invocación: ${err instanceof Error ? err.message : String(err)}`,
        categoryCorrect: false,
        taxCodeCorrect: false,
        priceError: null,
        costHallucinated: false,
        costMissed: false,
      });
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  const total = scores.length;
  const valid = scores.filter((s) => s.schemaValid);
  const pct = (n: number) => ((n / total) * 100).toFixed(0);
  const latencyStats = summarize(scores.map((s) => s.latencyMs));
  const priceErrors = valid.map((s) => s.priceError).filter((v): v is number => v != null);
  const meanPriceError = priceErrors.length > 0 ? priceErrors.reduce((a, b) => a + b, 0) / priceErrors.length : 0;

  console.log(`\n=== Fase 3 — código real, ${model}, ${total} casos ===\n`);
  console.log(`Schema válido:        ${valid.length}/${total} (${pct(valid.length)}%)  ${Number(pct(valid.length)) >= 80 ? '✓ cumple ≥80%' : '✗ NO cumple ≥80%'}`);
  console.log(`Categoría correcta:    ${valid.filter((s) => s.categoryCorrect).length}/${total} (${pct(valid.filter((s) => s.categoryCorrect).length)}%)  ${Number(pct(valid.filter((s) => s.categoryCorrect).length)) >= 70 ? '✓ cumple ≥70%' : '✗ NO cumple ≥70%'}`);
  console.log(`Impuesto correcto:     ${valid.filter((s) => s.taxCodeCorrect).length}/${total} (${pct(valid.filter((s) => s.taxCodeCorrect).length)}%)`);
  console.log(`Costo inventado:       ${scores.filter((s) => s.costHallucinated).length}/${total}`);
  console.log(`Costo perdido:         ${scores.filter((s) => s.costMissed).length}/${total}`);
  console.log(`Error medio de precio: $${meanPriceError.toFixed(2)}`);
  console.log(`Latencia:              p50=${latencyStats.p50}ms  p95=${latencyStats.p95}ms  media=${Math.round(latencyStats.mean)}ms`);

  const failures = scores.filter((s) => !s.schemaValid || !s.categoryCorrect || !s.taxCodeCorrect);
  if (failures.length > 0) {
    console.log(`\n--- Casos con problema (${failures.length}/${total}) ---`);
    for (const f of failures) {
      const evalCase = EVAL_DATASET.find((c) => c.id === f.id)!;
      const reasons = [
        !f.schemaValid && `schema inválido — ${f.parseError}`,
        f.schemaValid && !f.categoryCorrect && 'categoría incorrecta',
        f.schemaValid && !f.taxCodeCorrect && 'impuesto incorrecto',
      ].filter(Boolean);
      console.log(`  ${f.id}: ${reasons.join(', ')}`);
      console.log(`    "${evalCase.input}"`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
