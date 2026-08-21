import { Logger } from '@nestjs/common';
import { AICapability } from '../../contracts/ai-capability.enum';
import { InvocationContext } from '../../contracts/ai-invocation.types';
import { AIProvider, ChatRequest, ChatResult, ProviderHealth } from '../ai-provider.port';
import { fromAnthropicResponse, toAnthropicBody } from './anthropic.mapper';

export interface AnthropicProviderConfig {
  id: string;
  apiKey: string;
  baseUrl?: string;
}

const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Adaptador para la Messages API de Anthropic (Fase 4) — no reutiliza
 * `OpenAICompatibleProvider` porque el protocolo no es compatible: los
 * mensajes `system` van en un campo aparte y la salida estructurada se
 * logra forzando el uso de una única herramienta (`tool_choice`), no con
 * `response_format`. Ver `anthropic.mapper.ts`.
 */
export class AnthropicProvider implements AIProvider {
  private readonly logger = new Logger(AnthropicProvider.name);

  readonly id: string;
  readonly capabilities = new Set<AICapability>([AICapability.CHAT, AICapability.STRUCTURED_NATIVE]);

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: AnthropicProviderConfig) {
    this.id = config.id;
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '');
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
      response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(toAnthropicBody(req)),
        signal,
      });
    } catch (err) {
      // Mismo tratamiento que OpenAICompatibleProvider: timeout y errores de
      // red se relanzan como Error genérico para que AiExecutionService los
      // trate igual (transitorios, con reintento acotado — ADR-0027).
      throw new Error(
        `AnthropicProvider(${this.id}): fallo de red o timeout contra ${this.baseUrl} — ${this.describeError(err)}`,
      );
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(
        `AnthropicProvider(${this.id}): ${response.status} ${response.statusText} — ${bodyText.slice(0, 300)}`,
      );
    }

    const json = (await response.json()) as Parameters<typeof fromAnthropicResponse>[0];
    return fromAnthropicResponse(json, Date.now() - startedAt, Boolean(req.structuredOutput));
  }

  /** `GET /v1/models` no consume tokens — no hay un `/health` dedicado en la Messages API. */
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
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    };
  }

  private describeError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
