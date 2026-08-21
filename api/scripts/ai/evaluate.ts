/**
 * Corre el conjunto de evaluación (§16, §20 del documento de arquitectura)
 * contra uno o más modelos candidatos y produce la tabla comparativa que la
 * Fase 2 exige antes de fijar el modelo por defecto — D-06 no es una
 * decisión cerrada hasta que este informe exista.
 *
 * Uso:
 *   pnpm exec tsx scripts/ai/evaluate.ts --models llama3.2:latest,qwen3:4b
 *   pnpm exec tsx scripts/ai/evaluate.ts --models qwen3:4b --base-url http://localhost:11434
 *
 * El schema de evaluación (`product-draft.eval-schema.ts`) es de esta
 * evaluación, no de la plataforma en ejecución — ver el comentario en ese
 * archivo. Nada de este script corre en producción.
 */
import { OpenAICompatibleProvider } from '../../src/ai/providers/openai-compatible/openai-compatible.provider';
import { InvocationContext } from '../../src/ai/contracts/ai-invocation.types';
import { EVAL_DATASET } from './eval/dataset';
import { buildEvalMessages } from './eval/prompt';
import { productDraftEvalJsonSchema } from './eval/product-draft.eval-schema';
import { CaseScore, ModelReport, scoreOne, summarizeModel } from './eval/scorer';

function parseArgs(argv: string[]) {
  const get = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  return {
    baseUrl: get('--base-url', process.env.AI_LOCAL_BASE_URL ?? 'http://localhost:11434'),
    models: get('--models', 'llama3.2:latest').split(',').map((m) => m.trim()),
    // Los modelos "thinking" (Qwen3 vía Ollama separa el razonamiento en
    // message.reasoning) consumen el presupuesto de salida en pensar antes
    // de responder — con 300 se quedan sin tokens para el JSON final. 300
    // alcanza para un modelo no-razonador; se sube por CLI para comparar.
    maxOutputTokens: parseInt(get('--max-tokens', '300'), 10),
    // Para comparar rápido en desarrollo sin correr el conjunto completo —
    // el criterio de aceptación de la Fase 2 exige el conjunto completo,
    // este flag es para iterar antes de esa corrida final.
    limit: argv.includes('--limit') ? parseInt(get('--limit', '30'), 10) : undefined,
  };
}

async function evaluateModel(
  provider: OpenAICompatibleProvider,
  model: string,
  maxOutputTokens: number,
  cases: typeof EVAL_DATASET,
): Promise<ModelReport> {
  const scores: CaseScore[] = [];

  for (const evalCase of cases) {
    const ctx: InvocationContext = {
      requestId: `eval-${model}-${evalCase.id}`,
      tenantId: 'evaluation',
      deadline: Date.now() + 120_000,
    };

    const startedAt = Date.now();
    try {
      const result = await provider.chat(
        {
          modelKey: model,
          messages: buildEvalMessages(evalCase),
          temperature: 0.1,
          maxOutputTokens,
          structuredOutput: { name: 'products.draft.eval', schema: productDraftEvalJsonSchema, strict: true },
        },
        ctx,
      );
      scores.push(scoreOne(evalCase, result.content, Date.now() - startedAt));
    } catch (err) {
      scores.push({
        id: evalCase.id,
        latencyMs: Date.now() - startedAt,
        schemaValid: false,
        parseError: `Fallo de invocación: ${err instanceof Error ? err.message : String(err)}`,
        categoryCorrect: false,
        unitCorrect: false,
        taxCodeCorrect: false,
        priceError: null,
        costHallucinated: false,
        costMissed: false,
        costError: null,
      });
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  return summarizeModel(model, scores);
}

function printReport(reports: ModelReport[]): void {
  const totalCases = reports[0]?.totalCases ?? EVAL_DATASET.length;
  console.log('\n=== Comparativa de modelos — conjunto de evaluación (%d casos) ===\n'.replace('%d', String(totalCases)));
  console.log('| Modelo | Schema válido | Categoría OK | Unidad OK | Impuesto OK | Error precio (media) | Costo inventado | Costo perdido | Latencia media |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of reports) {
    console.log(
      `| ${r.model} | ${r.schemaValidPct.toFixed(0)}% | ${r.categoryCorrectPct.toFixed(0)}% | ${r.unitCorrectPct.toFixed(0)}% | ` +
        `${r.taxCodeCorrectPct.toFixed(0)}% | $${r.meanPriceError.toFixed(2)} | ${r.costHallucinatedCount}/${r.totalCases} | ` +
        `${r.costMissedCount}/${r.totalCases} | ${Math.round(r.meanLatencyMs)}ms |`,
    );
  }

  for (const r of reports) {
    if (r.failures.length === 0) continue;
    console.log(`\n--- Fallas de ${r.model} (${r.failures.length}/${r.totalCases}) ---`);
    for (const f of r.failures) {
      const evalCase = EVAL_DATASET.find((c) => c.id === f.id);
      const reasons = [
        !f.schemaValid && `schema inválido: ${f.parseError}`,
        f.schemaValid && !f.categoryCorrect && 'categoría incorrecta',
        f.schemaValid && !f.unitCorrect && 'unidad incorrecta',
        f.schemaValid && !f.taxCodeCorrect && 'impuesto incorrecto',
        f.costHallucinated && 'costo inventado (no estaba en la entrada)',
      ].filter(Boolean);
      console.log(`  ${f.id}: ${reasons.join(', ')}`);
      if (evalCase) console.log(`    entrada: "${evalCase.input}"`);
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const provider = new OpenAICompatibleProvider({ id: 'eval', baseUrl: args.baseUrl });

  const health = await provider.health();
  if (!health.up) {
    console.error(`El servidor no responde en ${args.baseUrl} (${health.detail ?? 'sin detalle'}). Abortando.`);
    process.exit(1);
  }

  const cases = args.limit ? EVAL_DATASET.slice(0, args.limit) : EVAL_DATASET;

  const reports: ModelReport[] = [];
  for (const model of args.models) {
    console.log(`\nEvaluando ${model} contra ${cases.length} casos...`);
    reports.push(await evaluateModel(provider, model, args.maxOutputTokens, cases));
  }

  printReport(reports);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
