/**
 * Pruebas de la lógica pura de la sesión de operador: decodificación de `exp`,
 * detección de expiración y alcance de URL del token. No hay runner unitario en
 * web (solo Playwright e2e); este spec usa la API de Vitest (estándar del
 * ecosistema Vite). Para ejecutarlo: `pnpm add -D vitest` y `vitest run`.
 */
import { describe, it, expect } from 'vitest'
import {
  decodeJwtExp,
  isOperatorTokenExpired,
  isOperatorScopedUrl,
} from './operator-session-service'

/** Construye un JWT de prueba (header.payload.signature) con base64url real. */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`
}

const HOUR = 3600

describe('decodeJwtExp', () => {
  it('extrae el claim exp', () => {
    const exp = Math.floor(Date.now() / 1000) + HOUR
    expect(decodeJwtExp(fakeJwt({ sub: 'e1', exp }))).toBe(exp)
  })

  it('devuelve null si no hay exp', () => {
    expect(decodeJwtExp(fakeJwt({ sub: 'e1' }))).toBeNull()
  })

  it('devuelve null ante un token malformado', () => {
    expect(decodeJwtExp('no-es-un-jwt')).toBeNull()
    expect(decodeJwtExp('')).toBeNull()
  })
})

describe('isOperatorTokenExpired', () => {
  it('false cuando el token sigue vigente', () => {
    const exp = Math.floor(Date.now() / 1000) + HOUR
    expect(isOperatorTokenExpired(fakeJwt({ exp }))).toBe(false)
  })

  it('true cuando el token venció', () => {
    const exp = Math.floor(Date.now() / 1000) - HOUR
    expect(isOperatorTokenExpired(fakeJwt({ exp }))).toBe(true)
  })

  it('true (fail-safe) cuando no se puede decodificar exp', () => {
    expect(isOperatorTokenExpired(fakeJwt({ sub: 'e1' }))).toBe(true)
    expect(isOperatorTokenExpired('basura')).toBe(true)
  })
})

describe('isOperatorScopedUrl', () => {
  it('adjunta en rutas de captura de comanda', () => {
    expect(isOperatorScopedUrl('/branches/b1/dining-orders')).toBe(true)
    expect(isOperatorScopedUrl('/branches/b1/dining-orders/o1/items')).toBe(true)
    expect(isOperatorScopedUrl('/branches/b1/dining-orders/o1/fire')).toBe(true)
    expect(isOperatorScopedUrl('/branches/b1/dining-orders/o1/status')).toBe(true)
  })

  it('EXCLUYE el cobro: /checkout usa el token de usuario (FK Order.createdById → User)', () => {
    expect(isOperatorScopedUrl('/branches/b1/dining-orders/o1/checkout')).toBe(false)
  })

  it('no adjunta en rutas administrativas ni de auth', () => {
    expect(isOperatorScopedUrl('/products')).toBe(false)
    expect(isOperatorScopedUrl('/auth/me')).toBe(false)
    expect(isOperatorScopedUrl('/branches/b1/tables')).toBe(false)
    expect(isOperatorScopedUrl('/staff/operator-login')).toBe(false)
  })
})
