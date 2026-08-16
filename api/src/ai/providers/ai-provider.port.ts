import { AICapability } from '../contracts/ai-capability.enum';
import { InvocationContext } from '../contracts/ai-invocation.types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * JSON Schema (derivado del Zod de la feature) que restringe la salida del
 * modelo. Se envía como `response_format` estándar OpenAI — tanto
 * llama.cpp (`llama-server`) como Ollama lo aceptan en su endpoint
 * `/v1/chat/completions` y lo traducen internamente a su propio mecanismo
 * de decodificación restringida (GBNF en llama.cpp). Orbix no construye
 * gramática a mano: verificado contra Ollama en desarrollo, el mismo campo
 * funciona sin cambios contra llama.cpp — es la razón de que
 * `OpenAICompatibleProvider` sea un solo adaptador para ambos runtimes.
 */
export interface StructuredOutputSpec {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

export interface ChatRequest {
  modelKey: string;
  messages: ChatMessage[];
  temperature: number;
  maxOutputTokens: number;
  /** Ausente si la feature no requiere STRUCTURED_GRAMMAR / STRUCTURED_NATIVE. */
  structuredOutput?: StructuredOutputSpec;
}

export interface ChatResult {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMsProvider: number;
}

export interface ProviderHealth {
  up: boolean;
  checkedAt: Date;
  detail?: string;
}

/**
 * El puerto de la plataforma de IA — ADR-0025. Todo lo que el gateway y los
 * módulos de negocio saben de "un modelo" pasa por esta interfaz. En v1 tiene
 * dos implementadores: OpenAICompatibleProvider (Fase 2) y MockProvider
 * (esta fase, usado también en tests).
 *
 * `chatStream` y `embed` quedan reservados para cuando exista una feature que
 * los necesite (streaming: diferido por D-13; embeddings: fuera de alcance
 * de la v1, ver §04/§10) — no se declaran aquí todavía para no comprometer
 * una firma que ningún implementador puede cumplir hoy.
 */
export interface AIProvider {
  readonly id: string;
  readonly capabilities: ReadonlySet<AICapability>;

  supports(required: AICapability[]): boolean;

  chat(req: ChatRequest, ctx: InvocationContext): Promise<ChatResult>;

  health(): Promise<ProviderHealth>;
}
