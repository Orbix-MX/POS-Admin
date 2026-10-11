/**
 * Normalización de errores de axios.
 *
 * El caso que motiva estas pruebas: `resolveCashAuthorizer` lanza
 * `ForbiddenException({ code, message, permission })`, y Nest serializa ese
 * objeto tal cual. Antes solo se leía `message`, así que el `code` se perdía y
 * "pide el PIN de un supervisor" era indistinguible de un 403 cualquiera.
 */
import { AxiosError, type AxiosResponse } from 'axios';

import { ApiError, toApiError } from './api-error';

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const error = new AxiosError('Request failed');
  error.response = { status, data } as AxiosResponse;
  return error;
}

describe('toApiError', () => {
  it('conserva el código de dominio que manda el servidor', () => {
    const error = toApiError(
      axiosErrorWith(403, {
        code: 'AUTHORIZATION_REQUIRED',
        message: 'Esta operación requiere la autorización de un supervisor.',
        permission: 'pos.cash:close',
      }),
    );

    expect(error.code).toBe('AUTHORIZATION_REQUIRED');
    expect(error.kind).toBe('forbidden');
    expect(error.message).toBe('Esta operación requiere la autorización de un supervisor.');
  });

  it('distingue PIN inválido de autorización requerida', () => {
    const invalid = toApiError(
      axiosErrorWith(403, {
        code: 'AUTHORIZATION_INVALID',
        message: 'PIN incorrecto o sin permiso para autorizar esta operación.',
      }),
    );

    expect(invalid.code).toBe('AUTHORIZATION_INVALID');
  });

  it('deja el código en undefined cuando el servidor no lo manda', () => {
    const error = toApiError(
      axiosErrorWith(403, { statusCode: 403, message: 'Forbidden resource', error: 'Forbidden' }),
    );

    expect(error.code).toBeUndefined();
    expect(error.kind).toBe('forbidden');
  });

  it('reconoce el 403 del RequireModuleGuard por su mensaje', () => {
    const error = toApiError(
      axiosErrorWith(403, { message: "Module 'reportes' not enabled for this tenant" }),
    );

    expect(error.kind).toBe('forbidden');
    expect(error.message).toMatch(/not enabled/);
  });

  it('saca el primer mensaje de un arreglo de class-validator y guarda el resto', () => {
    const error = toApiError(
      axiosErrorWith(400, {
        message: ['amount must not be less than 0.01', 'reason should not be empty'],
        statusCode: 400,
      }),
    );

    expect(error.kind).toBe('validation');
    expect(error.message).toBe('amount must not be less than 0.01');
    expect(error.details).toHaveLength(2);
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'notFound'],
    [409, 'conflict'],
    [429, 'rateLimited'],
    [422, 'validation'],
    [500, 'server'],
  ] as const)('mapea %i a %s', (status, kind) => {
    expect(toApiError(axiosErrorWith(status, {})).kind).toBe(kind);
  });

  it('solo reintenta lo que puede cambiar de resultado', () => {
    expect(new ApiError('network', '').isRetryable).toBe(true);
    expect(new ApiError('timeout', '').isRetryable).toBe(true);
    expect(new ApiError('server', '').isRetryable).toBe(true);
    // Un 403 o un 422 darán exactamente lo mismo al segundo intento.
    expect(new ApiError('forbidden', '').isRetryable).toBe(false);
    expect(new ApiError('validation', '').isRetryable).toBe(false);
  });

  it('devuelve el mismo ApiError si ya lo era', () => {
    const original = new ApiError('network', 'sin red');
    expect(toApiError(original)).toBe(original);
  });
});
