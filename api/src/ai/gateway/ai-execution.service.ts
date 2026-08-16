import { Injectable } from '@nestjs/common';
import { InvocationContext } from '../contracts/ai-invocation.types';
import { AiException } from '../contracts/ai-error';
import { AIProvider, ChatRequest, ChatResult } from '../providers/ai-provider.port';

/** Marca interna: distingue "se agotó el tiempo de este intento" de cualquier otro error del proveedor. */
class ProviderCallTimeout extends Error {}

/**
 * Un intento contra un proveedor concreto: timeout, reintento por error
 * transitorio (máximo 2, D-18) y medición. No elige el proveedor — eso ya
 * lo resolvió el gateway — y no repara schemas: eso es
 * `StructuredOutputService` orquestado por `AiGatewayService`.
 *
 * Sin fallback (ADR-0027): agotados los reintentos, el único destino es
 * `AI_PROVIDER_UNAVAILABLE`. `AI_TIMEOUT` está reservado para cuando el
 * `deadline` completo de la invocación ya se agotó antes de intentar de
 * nuevo — una condición distinta de "esta llamada tardó más de lo normal".
 */
@Injectable()
export class AiExecutionService {
  private static readonly MAX_ATTEMPTS = 3;

  async execute(
    provider: AIProvider,
    req: ChatRequest,
    ctx: InvocationContext,
  ): Promise<ChatResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= AiExecutionService.MAX_ATTEMPTS; attempt++) {
      const remainingMs = ctx.deadline - Date.now();
      if (remainingMs <= 0) {
        throw new AiException(
          'AI_TIMEOUT',
          'Se agotó el tiempo disponible para la invocación.',
        );
      }

      try {
        return await this.withTimeout(provider.chat(req, ctx), remainingMs);
      } catch (err) {
        lastError = err;
        if (attempt === AiExecutionService.MAX_ATTEMPTS) break;
        await this.backoff(attempt);
      }
    }

    void lastError;
    throw new AiException(
      'AI_PROVIDER_UNAVAILABLE',
      'El asistente no está disponible en este momento.',
    );
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new ProviderCallTimeout()), ms);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    });
  }

  private backoff(attempt: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 200 * attempt));
  }
}
