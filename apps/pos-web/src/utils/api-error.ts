import axios from 'axios'

/**
 * Traducción de errores del API a mensajes operables por un cajero.
 *
 * Regla: el mensaje del backend gana siempre que exista — ya viene redactado en
 * español y conoce la regla de negocio. Aquí solo se cubren los casos en los que
 * no hay cuerpo de respuesta (red, timeout) o el estado por sí solo dice más que
 * el texto genérico de axios.
 */

export type ApiErrorKind =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'server'
  | 'network'
  | 'timeout'
  | 'unknown'

export interface ApiErrorInfo {
  kind: ApiErrorKind
  status: number | null
  /** Código de negocio del backend, p. ej. `TENANT_SUSPENDED`. */
  code: string | null
  message: string
}

const FALLBACK: Record<ApiErrorKind, string> = {
  validation: 'Revisa los datos: el servidor los rechazó.',
  authentication: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  authorization: 'No tienes permiso para esta operación.',
  not_found: 'No se encontró el recurso solicitado.',
  conflict: 'La operación choca con el estado actual. Actualiza y vuelve a intentar.',
  server: 'El servidor tuvo un problema. Intenta de nuevo en un momento.',
  network: 'Sin conexión con el servidor. Revisa la red e intenta de nuevo.',
  timeout: 'El servidor tardó demasiado en responder. Intenta de nuevo.',
  unknown: 'Ocurrió un error inesperado.',
}

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 400 || status === 422) return 'validation'
  if (status === 401) return 'authentication'
  if (status === 403) return 'authorization'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status >= 500) return 'server'
  return 'unknown'
}

/**
 * Algunos mensajes del backend siguen en inglés. Un cajero no debería verlos,
 * así que se traducen los que aparecen en el flujo del POS. Cualquier otro se
 * muestra tal cual: el texto del servidor conoce la regla de negocio mejor que
 * un genérico, y es preferible a ocultarlo.
 */
const TRANSLATED: Record<string, string> = {
  'invalid credentials': 'Credenciales incorrectas',
  'unauthorized': 'No tienes permiso para esta operación',
  'forbidden resource': 'No tienes permiso para esta operación',
  'insufficient stock': 'Existencia insuficiente para completar la venta',
  'user not found': 'No existe un usuario con ese correo',
  'internal server error': 'El servidor tuvo un problema. Intenta de nuevo en un momento.',
}

/** Traduce un mensaje ya extraído (p. ej. el que expone `useAuthStore.error`). */
export function translateMessage(message: string | null | undefined): string | null {
  if (!message) return null
  return TRANSLATED[message.trim().toLowerCase()] ?? message
}

export function parseApiError(error: unknown): ApiErrorInfo {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return { kind: 'timeout', status: null, code: error.code, message: FALLBACK.timeout }
    }
    if (!error.response) {
      return { kind: 'network', status: null, code: error.code ?? null, message: FALLBACK.network }
    }

    const status = error.response.status
    const kind = kindFromStatus(status)
    const data = error.response.data as { message?: string | string[]; code?: string } | undefined
    const raw = data?.message
    const message = Array.isArray(raw) ? raw.join('. ') : raw

    return {
      kind,
      status,
      code: data?.code ?? null,
      message: message?.trim() ? (translateMessage(message) as string) : FALLBACK[kind],
    }
  }

  if (error instanceof Error && error.message) {
    return { kind: 'unknown', status: null, code: null, message: error.message }
  }

  return { kind: 'unknown', status: null, code: null, message: FALLBACK.unknown }
}

/** Atajo cuando solo interesa el texto que se muestra al usuario. */
export const errorMessage = (error: unknown): string => parseApiError(error).message
