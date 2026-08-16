import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Códigos de error tipados de la plataforma de IA — §12 del documento de
 * arquitectura. Sin fallback en la v1 (ADR-0027): toda invocación termina en
 * éxito o en uno de estos seis códigos, nunca en un 500 genérico.
 */
export type AiErrorCode =
  | 'AI_FEATURE_DISABLED'
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_RATE_LIMITED'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_TIMEOUT'
  | 'AI_OUTPUT_INVALID';

const AI_ERROR_HTTP_STATUS: Record<AiErrorCode, HttpStatus> = {
  AI_FEATURE_DISABLED: HttpStatus.FORBIDDEN,
  AI_QUOTA_EXCEEDED: HttpStatus.TOO_MANY_REQUESTS,
  AI_RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  AI_PROVIDER_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  AI_TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  AI_OUTPUT_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
};

/**
 * Toda excepción que sale del AI Gateway es una AiException. El código es lo
 * que el cliente usa para distinguir "sin conexión" de "límite alcanzado" de
 * "asistente no disponible" — nunca un mensaje libre.
 */
export class AiException extends HttpException {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
  ) {
    super({ code, message }, AI_ERROR_HTTP_STATUS[code]);
  }
}
