/**
 * One error type for the whole app.
 *
 * Axios failures come in three unrelated shapes (HTTP response, no response,
 * request setup) and NestJS itself returns `message` as either a string or a
 * string[]. Normalising once here means screens can render `error.message`
 * without defensive checks.
 */
import { AxiosError, type AxiosResponse } from 'axios';

export type ApiErrorKind =
  | 'network' // device offline or DNS/TLS failure
  | 'timeout'
  | 'unauthorized' // 401 after the refresh attempt failed
  | 'forbidden' // 403 — authenticated but lacking permission
  | 'notFound'
  | 'validation' // 400 / 422
  | 'conflict' // 409
  | 'rateLimited' // 429
  | 'server' // 5xx
  | 'unknown';

interface NestErrorBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** Field-level messages from `class-validator`, when the API sent an array. */
  readonly details: string[];

  constructor(kind: ApiErrorKind, message: string, status?: number, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.details = details;
  }

  /** True when retrying the exact same request could plausibly succeed. */
  get isRetryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'server';
  }
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rateLimited';
  if (status === 400 || status === 422) return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
}

function messageFromResponse(response: AxiosResponse<NestErrorBody>): {
  message: string;
  details: string[];
} {
  const body = response.data;
  if (Array.isArray(body?.message)) {
    return { message: body.message[0] ?? 'Request failed', details: body.message };
  }
  if (typeof body?.message === 'string' && body.message) {
    return { message: body.message, details: [] };
  }
  if (typeof body?.error === 'string' && body.error) {
    return { message: body.error, details: [] };
  }
  return { message: `Request failed with status ${response.status}`, details: [] };
}

/** Converts anything thrown by axios (or by us) into an `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    if (error.response) {
      const { message, details } = messageFromResponse(error.response as AxiosResponse<NestErrorBody>);
      return new ApiError(kindForStatus(error.response.status), message, error.response.status, details);
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError('timeout', 'The request took too long to complete.');
    }
    return new ApiError('network', 'Could not reach the Orbix server.');
  }

  if (error instanceof Error) {
    return new ApiError('unknown', error.message);
  }
  return new ApiError('unknown', 'Unexpected error');
}

/** Thrown by repositories whose backend endpoint does not exist yet. */
export class NotImplementedError extends Error {
  /** The endpoint the backend still has to expose, e.g. `POST /auth/google`. */
  readonly endpoint: string;

  constructor(endpoint: string, hint?: string) {
    super(hint ? `${endpoint} is not available yet — ${hint}` : `${endpoint} is not available yet`);
    this.name = 'NotImplementedError';
    this.endpoint = endpoint;
  }
}
