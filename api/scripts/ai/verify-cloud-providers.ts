/**
 * Verificación manual de los adaptadores de proveedores cloud de Fase 4 —
 * llama una vez a Anthropic y una vez a Gemini con una entrada real y
 * `structuredOutput`, imprime la respuesta cruda. Necesita credenciales
 * reales exportadas antes de correr; no se ejecuta como parte de ningún
 * pipeline automatizado.
 *
 * Uso:
 *   ANTHROPIC_API_KEY=sk-ant-... pnpm exec tsx scripts/ai/verify-cloud-providers.ts anthropic
 *   GEMINI_API_KEY=... pnpm exec tsx scripts/ai/verify-cloud-providers.ts gemini
 *   (sin argumento, corre ambos que tengan su variable de entorno presente)
 */
import { AnthropicProvider } from '../../src/ai/providers/anthropic/anthropic.provider';
import { OpenAICompatibleProvider } from '../../src/ai/providers/openai-compatible/openai-compatible.provider';
import { InvocationContext } from '../../src/ai/contracts/ai-invocation.types';
import { AIProvider } from '../../src/ai/providers/ai-provider.port';

const SAMPLE_SCHEMA = {
  type: 'object',
  properties: {
    echo: { type: 'string' },
  },
  required: ['echo'],
  additionalProperties: false,
};

async function verify(name: string, provider: AIProvider, modelKey: string): Promise<void> {
  console.log(`\n=== ${name} (${provider.id}, modelo ${modelKey}) ===`);

  const health = await provider.health();
  console.log(`health(): ${JSON.stringify(health)}`);
  if (!health.up) {
    console.error(`${name} no respondió a health() — se omite la invocación de chat.`);
    return;
  }

  const ctx: InvocationContext = {
    requestId: `verify-${provider.id}`,
    tenantId: 'verify-tenant',
    deadline: Date.now() + 30_000,
  };

  const result = await provider.chat(
    {
      modelKey,
      messages: [
        { role: 'system', content: 'Repite exactamente lo que el usuario diga, en el campo "echo".' },
        { role: 'user', content: 'coca de 600' },
      ],
      temperature: 0,
      maxOutputTokens: 200,
      structuredOutput: { name: 'verify.echo.v1', schema: SAMPLE_SCHEMA, strict: true },
    },
    ctx,
  );

  console.log(`content: ${result.content}`);
  console.log(`tokens: in=${result.inputTokens} out=${result.outputTokens} latencyMsProvider=${result.latencyMsProvider}`);
}

async function main(): Promise<void> {
  const target = process.argv[2];

  if ((!target || target === 'anthropic') && process.env.ANTHROPIC_API_KEY) {
    await verify(
      'Anthropic',
      new AnthropicProvider({ id: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY }),
      'claude-haiku-4-5-20251001',
    );
  } else if (!target || target === 'anthropic') {
    console.log('\nANTHROPIC_API_KEY no está definida — se omite Anthropic.');
  }

  if ((!target || target === 'gemini') && process.env.GEMINI_API_KEY) {
    await verify(
      'Gemini',
      new OpenAICompatibleProvider({
        id: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: process.env.GEMINI_API_KEY,
      }),
      'gemini-2.5-flash',
    );
  } else if (!target || target === 'gemini') {
    console.log('\nGEMINI_API_KEY no está definida — se omite Gemini.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
