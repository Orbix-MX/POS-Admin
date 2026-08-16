/**
 * Benchmark de latencia y throughput de un modelo local — Fase 2 del
 * documento de arquitectura Orbix AI Platform (§10, §20). Mide lo que la
 * Fase 3 necesita saber antes de construir el Product Assistant: p50/p95 por
 * nivel de concurrencia y tokens/s de salida.
 *
 * Uso:
 *   pnpm exec tsx scripts/ai/benchmark.ts --base-url http://localhost:11434 --model llama3.2:latest
 *   pnpm exec tsx scripts/ai/benchmark.ts --model qwen3:4b --concurrency 1,2,4 --requests 6
 *
 * IMPORTANTE: corrido contra Ollama en una máquina de desarrollo, no contra
 * el VPS de referencia del documento (8 vCPU dedicados). Los números de
 * este script son válidos para comparar modelos ENTRE SÍ en este hardware;
 * no son la cifra de dimensionamiento de producción — esa se mide en el VPS
 * real antes de decidir concurrencia/slots (§10, riesgo "latencia local
 * inaceptable en CPU").
 */
import { OpenAICompatibleProvider } from '../../src/ai/providers/openai-compatible/openai-compatible.provider';
import { InvocationContext } from '../../src/ai/contracts/ai-invocation.types';
import { summarize } from './lib/stats';

interface Args {
  baseUrl: string;
  model: string;
  concurrencyLevels: number[];
  requestsPerLevel: number;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };

  return {
    baseUrl: get('--base-url', process.env.AI_LOCAL_BASE_URL ?? 'http://localhost:11434'),
    model: get('--model', 'llama3.2:latest'),
    concurrencyLevels: get('--concurrency', '1,2,4')
      .split(',')
      .map((n) => parseInt(n.trim(), 10))
      .filter((n) => n > 0),
    requestsPerLevel: parseInt(get('--requests', '6'), 10),
  };
}

// Prompt representativo del tamaño esperado de products.draft (§06): un
// bloque de sistema + contexto de tenant + entrada del usuario — no un
// "hola" trivial, que subestima la latencia real de prefill.
const BENCHMARK_MESSAGES = [
  {
    role: 'system' as const,
    content:
      'Eres el asistente de alta de productos de Orbix, un ERP para negocios ' +
      'mexicanos de retail. A partir de una descripción en lenguaje natural, ' +
      'propones un borrador de producto. Nunca inventes datos que no estén en ' +
      'la entrada: si un campo no se menciona, indícalo como null. Nunca ' +
      'asignes un identificador. Responde solo con el objeto JSON solicitado.',
  },
  {
    role: 'user' as const,
    content:
      'Categorías existentes: Bebidas, Botanas, Lácteos, Abarrotes, Panadería, ' +
      'Dulcería, Cigarros y encendedores, Cuidado personal, Limpieza.\n' +
      'Unidades disponibles: Pieza, Kilogramo, Gramo, Litro, Mililitro, Paquete, Caja.\n' +
      'Códigos de impuesto válidos: IVA_16, IVA_11, IVA_8, EXCENTO.\n\n' +
      '<entrada>Quiero agregar Coca-Cola de 600 ml, me cuesta 15 pesos y la vendo en 22.</entrada>\n\n' +
      'Responde con un objeto JSON: {"name": string, "categoryName": string, ' +
      '"unitName": string, "costPrice": number|null, "price": number, ' +
      '"taxCode": string, "description": string|null}.',
  },
];

const PRODUCT_DRAFT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    categoryName: { type: 'string' },
    unitName: { type: 'string' },
    costPrice: { type: ['number', 'null'] },
    price: { type: 'number' },
    taxCode: { type: 'string', enum: ['IVA_16', 'IVA_11', 'IVA_8', 'EXCENTO'] },
    description: { type: ['string', 'null'] },
  },
  required: ['name', 'categoryName', 'unitName', 'costPrice', 'price', 'taxCode', 'description'],
  additionalProperties: false,
};

async function runOne(provider: OpenAICompatibleProvider, args: Args): Promise<{ latencyMs: number; outputTokens: number }> {
  const ctx: InvocationContext = {
    requestId: `bench-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    tenantId: 'benchmark',
    deadline: Date.now() + 120_000,
  };

  const startedAt = Date.now();
  const result = await provider.chat(
    {
      modelKey: args.model,
      messages: BENCHMARK_MESSAGES,
      temperature: 0.2,
      maxOutputTokens: 300,
      structuredOutput: { name: 'products.draft.bench', schema: PRODUCT_DRAFT_JSON_SCHEMA, strict: true },
    },
    ctx,
  );

  return { latencyMs: Date.now() - startedAt, outputTokens: result.outputTokens ?? 0 };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const provider = new OpenAICompatibleProvider({ id: 'benchmark', baseUrl: args.baseUrl });

  console.log(`\nBenchmark — modelo: ${args.model} — baseUrl: ${args.baseUrl}`);
  console.log(`Peticiones por nivel de concurrencia: ${args.requestsPerLevel}\n`);

  const health = await provider.health();
  if (!health.up) {
    console.error(`El servidor no responde en ${args.baseUrl} (${health.detail ?? 'sin detalle'}). Abortando.`);
    process.exit(1);
  }

  const rows: Array<{ concurrency: number; p50: number; p95: number; meanMs: number; tokPerSec: number; errors: number }> = [];

  for (const concurrency of args.concurrencyLevels) {
    const latencies: number[] = [];
    const tokensPerRequest: number[] = [];
    let errors = 0;

    let launched = 0;
    while (launched < args.requestsPerLevel) {
      const batchSize = Math.min(concurrency, args.requestsPerLevel - launched);
      const batch = Array.from({ length: batchSize }, () => runOne(provider, args));
      const settled = await Promise.allSettled(batch);

      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          latencies.push(outcome.value.latencyMs);
          tokensPerRequest.push(outcome.value.outputTokens);
        } else {
          errors++;
          console.error(`  [c=${concurrency}] error: ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`);
        }
      }
      launched += batchSize;
    }

    const stats = summarize(latencies);
    const totalTokens = tokensPerRequest.reduce((a, b) => a + b, 0);
    const totalSeconds = latencies.reduce((a, b) => a + b, 0) / 1000;
    const tokPerSec = totalSeconds > 0 ? totalTokens / totalSeconds : 0;

    rows.push({ concurrency, p50: stats.p50, p95: stats.p95, meanMs: stats.mean, tokPerSec, errors });
    console.log(
      `concurrency=${concurrency}  p50=${stats.p50}ms  p95=${stats.p95}ms  mean=${Math.round(stats.mean)}ms  ` +
        `~${tokPerSec.toFixed(1)} tok/s  errores=${errors}/${args.requestsPerLevel}`,
    );
  }

  console.log('\n| Concurrencia | p50 (ms) | p95 (ms) | media (ms) | tok/s aprox | errores |');
  console.log('|---|---|---|---|---|---|');
  for (const row of rows) {
    console.log(`| ${row.concurrency} | ${row.p50} | ${row.p95} | ${Math.round(row.meanMs)} | ${row.tokPerSec.toFixed(1)} | ${row.errors} |`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
