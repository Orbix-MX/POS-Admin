import { Injectable } from '@nestjs/common';
import { ZodTypeAny } from 'zod';

export interface StructuredOutputResult<T> {
  ok: boolean;
  data?: T;
  /** Rutas de campo que no pasaron el schema, o `['*']` si el texto no era JSON. */
  fieldsFailed: string[];
  errorMessage?: string;
}

/**
 * Del texto crudo del modelo al objeto validado. No conoce el dominio del
 * schema (regla de la tabla de responsabilidades del gateway, §03): solo
 * sabe parsear JSON y reportar, por Zod, qué falló y dónde. La reparación
 * (un segundo intento con el error inyectado en el prompt) la orquesta
 * `AiGatewayService` — este servicio es puro y no vuelve a llamar al
 * proveedor por su cuenta.
 */
@Injectable()
export class StructuredOutputService {
  parse<T>(content: string, schema: ZodTypeAny): StructuredOutputResult<T> {
    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      return { ok: false, fieldsFailed: ['*'], errorMessage: 'La salida no es JSON válido.' };
    }

    const result = schema.safeParse(json);
    if (result.success) {
      return { ok: true, data: result.data as T, fieldsFailed: [] };
    }

    const fieldsFailed = [...new Set(result.error.issues.map((issue) => issue.path.join('.') || '*'))];
    const errorMessage = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('; ');

    return { ok: false, fieldsFailed, errorMessage };
  }
}
