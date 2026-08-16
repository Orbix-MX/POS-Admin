import { Logger } from '@nestjs/common';
import { AICapability } from '../../contracts/ai-capability.enum';
import { InvocationContext } from '../../contracts/ai-invocation.types';
import { AIProvider, ChatRequest, ChatResult, ProviderHealth } from '../ai-provider.port';
import { fromOpenAiChatResponse, toOpenAiChatBody } from './openai-compatible.mapper';

export interface OpenAICompatibleProviderConfig {
  /** id con el que se registra en `AiProviderRegistry` — lo que el binding de la feature referencia. */
  id: string;
  baseUrl: string;
  apiKey?: string;
}

/**
 * Un solo adaptador para llama.cpp (`llama-server`), Ollama y, si hiciera
 * falta, cualquier otro runtime que hable el protocolo
 * `/v1/chat/completions` de OpenAI (D-05). El runtime es la `baseUrl` de la
 * config — cambiar de Ollama en desarrollo a `llama-server` en producción
 * es una variable de entorno, no una clase distinta.
 *
 * No es un `@Injectable()` de Nest: cada instancia se construye
 * explícitamente en `AiModule` a partir de configuración de entorno,
 * porque puede haber más de un endpoint de este mismo protocolo (Fase 4).
 */
export class OpenAICompatibleProvider implements AIProvider {
  private readonly logger = new Logger(OpenAICompatibleProvider.name);

  readonly id: string;
  readonly capabilities = new Set<AICapability>([AICapability.CHAT, AICapability.STRUCTURED_NATIVE]);

  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: OpenAICompatibleProviderConfig) {
    this.id = config.id;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
  }

  supports(required: AICapability[]): boolean {
    return required.every((cap) => this.capabilities.has(cap));
  }

  async chat(req: ChatRequest, ctx: InvocationContext): Promise<ChatResult> {
    const remainingMs = Math.max(1, ctx.deadline - Date.now());
    const timeoutSignal = AbortSignal.timeout(remainingMs);
    const signal = ctx.signal ? AbortSignal.any([ctx.signal, timeoutSignal]) : timeoutSignal;

    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(toOpenAiChatBody(req)),
        signal,
      });
    } catch (err) {
      // Timeout (AbortError) y errores de red caen aquí — AiExecutionService
      // los trata igual: transitorios, con reintento acotado (ADR-0027).
      throw new Error(
        `OpenAICompatibleProvider(${this.id}): fallo de red o timeout contra ${this.baseUrl} — ${this.describeError(err)}`,
      );
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(
        `OpenAICompatibleProvider(${this.id}): ${response.status} ${response.statusText} — ${bodyText.slice(0, 300)}`,
      );
    }

    const json = (await response.json()) as Parameters<typeof fromOpenAiChatResponse>[0];
    return fromOpenAiChatResponse(json, Date.now() - startedAt);
  }

  /**
   * `/v1/models` es el único endpoint que llama.cpp, Ollama y OpenAI
   * exponen de forma idéntica — no hay un `/health` común a los tres.
   */
  async health(): Promise<ProviderHealth> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: this.headers(),
        signal: AbortSignal.timeout(3000),
      });
      return { up: response.ok, checkedAt: new Date(), detail: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (err) {
      this.logger.warn(`health(${this.id}) contra ${this.baseUrl} falló: ${this.describeError(err)}`);
      return { up: false, checkedAt: new Date(), detail: this.describeError(err) };
    }
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  private describeError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
