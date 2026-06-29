import { api } from '@/lib/api-client'

/**
 * Sesión de OPERADOR (mesero) en web. A diferencia de `pin-verify` (que solo
 * resolvía el Employee sin token), aquí el PIN canjea un JWT `typ:'operator'`
 * idéntico al de la app móvil vía `POST /staff/operator-login`. Con él, el
 * backend conoce al mesero real (`sub = employee.id`) en cada request de comanda
 * — identidad autenticada equivalente a Mobile.
 *
 * El token vive en localStorage (clave propia) y `api-client` lo adjunta SOLO en
 * las rutas de captura de comanda (`/dining-orders`, excepto `/checkout`). El
 * cobro sigue usando el token de USUARIO: `Order.createdById` referencia a `User`
 * y un `employee.id` rompería la FK. Así el cajero (User) queda como creador del
 * Order, y el mesero (Employee) como `DiningOrder.waiterId` fijado al abrir.
 */

const OPERATOR_TOKEN_KEY = 'operator_access_token'

export interface OperatorEmployee {
  id: string
  firstName: string
  lastName: string
  employeeNumber: string
}

export interface OperatorRole {
  id: string
  name: string
}

/**
 * Modo de visibilidad de comandas entre meseros (configurado por sucursal).
 * Decisión funcional (Opción A): Mesas/Kitchen/Caja SIEMPRE globales; el modo
 * solo gobernará el listado de comandas del operador.
 *
 * INFRAESTRUCTURA: hoy todos los modos se comportan como SHARED. El cliente
 * recibe y almacena el valor, pero NO altera ninguna pantalla todavía.
 */
export type RestaurantVisibilityMode = 'SHARED' | 'OWN_ONLY' | 'OWN_WITH_SUPERVISOR'

export interface OperatorLoginResponse {
  accessToken: string
  employee: OperatorEmployee
  role: OperatorRole | null
  permissions: string[]
  branchId: string | null
  availableBranches: { id: string; name: string }[]
  restaurantVisibilityMode: RestaurantVisibilityMode
}

/** Identidad del operador activo (sin el token, que vive aparte en localStorage). */
export interface CurrentOperator {
  employee: OperatorEmployee
  role: OperatorRole | null
  permissions: string[]
  branchId: string | null
  // Modo de visibilidad de la sucursal operada. Persistido en la sesión para
  // consumo futuro; no se aplica filtro alguno en esta fase.
  restaurantVisibilityMode: RestaurantVisibilityMode
}

// ─── Almacenamiento del token ────────────────────────────────────────────────

export function getOperatorToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(OPERATOR_TOKEN_KEY)
}

export function setOperatorToken(token: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(OPERATOR_TOKEN_KEY, token)
}

export function clearOperatorToken(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(OPERATOR_TOKEN_KEY)
}

// ─── Expiración (JWT exp) ──────────────────────────────────────────────────────

/** Decodifica el claim `exp` (segundos epoch) del JWT. null si no es decodificable. */
export function decodeJwtExp(token: string): number | null {
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    const payload = JSON.parse(json) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

/**
 * True si el token venció o no es decodificable. Un token sin `exp` legible se
 * trata como vencido (fail-safe: nunca se adjunta una credencial dudosa).
 */
export function isOperatorTokenExpired(token: string): boolean {
  const exp = decodeJwtExp(token)
  if (exp == null) return true
  return exp * 1000 <= Date.now()
}

// ─── Alcance del token en api-client ───────────────────────────────────────────

/**
 * Rutas donde se adjunta el token de operador (captura/identidad de comanda).
 * Excluye `/checkout`: el cobro genera el `Order` financiero cuyo `createdById`
 * es una FK a `User`; debe correr con el token de usuario (cajero).
 */
export function isOperatorScopedUrl(url: string): boolean {
  return url.includes('/dining-orders') && !url.endsWith('/checkout')
}

// ─── Login ──────────────────────────────────────────────────────────────────

export async function operatorLogin(pin: string, branchId: string): Promise<OperatorLoginResponse> {
  const { data } = await api.post<OperatorLoginResponse>('/staff/operator-login', { pin, branchId })
  return data
}

export function operatorFullName(employee: OperatorEmployee): string {
  return `${employee.firstName} ${employee.lastName}`.trim()
}

/**
 * Sesión de operador expirada (401 en ruta de comanda). Lo dispara `api-client`;
 * las vistas de comanda/caja lo escuchan para re-pedir el PIN sin recargar la app
 * ni tocar la sesión administrativa.
 */
export const OPERATOR_EXPIRED_EVENT = 'operator:expired'
