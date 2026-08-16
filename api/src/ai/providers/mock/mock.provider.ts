import { Injectable } from '@nestjs/common';
import { AICapability } from '../../contracts/ai-capability.enum';
import { InvocationContext } from '../../contracts/ai-invocation.types';
import { AIProvider, ChatRequest, ChatResult, ProviderHealth } from '../ai-provider.port';

/**
 * Segundo implementador del puerto `AIProvider` — existe para que la
 * abstracción esté probada por dos implementadores reales desde la Fase 1
 * (ADR-0025), no solo diseñada. Sirve dos propósitos:
 *
 * 1. Zero-config: sin configurar nada, responde a cualquier prompt con el
 *    patrón `<entrada>...</entrada>` de las plantillas (ver §06) devolviendo
 *    `{"echo": "<contenido>"}` — suficiente para que la feature de humo
 *    `ai.echo` funcione sin un modelo real.
 * 2. Configurable en tests: `queueResponse`, `queueError` y `setLatencyMs`
 *    permiten ejercitar las rutas de reintento, reparación de schema y
 *    error tipado del gateway sin infraestructura de inferencia.
 */
@Injectable()
export class MockProvider implements AIProvider {
  readonly id = 'mock';
  readonly capabilities = new Set<AICapability>([
    AICapability.CHAT,
    AICapability.STRUCTURED_NATIVE,
  ]);

  private responseQueue: string[] = [];
  private errorQueue: Error[] = [];
  private latencyMs = 5;
  private healthy = true;

  supports(required: AICapability[]): boolean {
    return required.every((cap) => this.capabilities.has(cap));
  }

  async chat(req: ChatRequest, _ctx: InvocationContext): Promise<ChatResult> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }

    const nextError = this.errorQueue.shift();
    if (nextError) {
      throw nextError;
    }

    const content = this.responseQueue.shift() ?? this.defaultEcho(req);

    return {
      content,
      inputTokens: this.approximateTokens(req.messages.map((m) => m.content).join(' ')),
      outputTokens: this.approximateTokens(content),
      totalTokens: undefined,
      latencyMsProvider: this.latencyMs,
    };
  }

  health(): Promise<ProviderHealth> {
    return Promise.resolve({ up: this.healthy, checkedAt: new Date() });
  }

  /** Encola una respuesta cruda (el `content` que devolvería el modelo). Se consume una vez. */
  queueResponse(content: string): void {
    this.responseQueue.push(content);
  }

  /** Encola un error a lanzar en la próxima llamada a `chat`. Se consume una vez. */
  queueError(error: Error): void {
    this.errorQueue.push(error);
  }

  setLatencyMs(ms: number): void {
    this.latencyMs = ms;
  }

  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }

  reset(): void {
    this.responseQueue = [];
    this.errorQueue = [];
    this.latencyMs = 5;
    this.healthy = true;
  }

  private defaultEcho(req: ChatRequest): string {
    // Busca en todos los mensajes, no solo el último `user`: en un reintento
    // de reparación (ver AiGatewayService.buildRepairMessages) el mensaje
    // `user` más reciente es la instrucción de corrección, no la entrada
    // original — el patrón <entrada> sigue estando más arriba en el
    // historial.
    const combined = req.messages.map((m) => m.content).join('\n');
    const matches = [...combined.matchAll(/<entrada>([\s\S]*?)<\/entrada>/g)];
    const echoed = (matches[matches.length - 1]?.[1] ?? '').trim();
    return JSON.stringify({ echo: echoed });
  }

  private approximateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }
}
