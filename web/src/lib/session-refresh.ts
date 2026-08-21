import axios from 'axios'
import {
  getRefreshToken,
  setRefreshToken,
  setAccessToken,
  clearRefreshToken,
} from '@/services/core/auth-service'

interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

/**
 * Cliente propio, sin los interceptores de `api`: si la renovación viajara por
 * ahí, un 401 del propio /auth/refresh dispararía otra renovación.
 */
const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Renovación en vuelo. El API rota el refresh token en cada uso y trata la
 * reutilización de uno ya rotado como robo — revoca la familia entera y tira la
 * sesión. Con varias peticiones expirando a la vez eso pasaría siempre, así que
 * todas comparten una sola llamada.
 */
let inFlight: Promise<string> | null = null

export function refreshSession(): Promise<string> {
  if (inFlight) return inFlight

  inFlight = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) throw new Error('No hay refresh token')

    try {
      const { data } = await refreshClient.post<RefreshResponse>('/auth/refresh', { refreshToken })
      setAccessToken(data.accessToken)
      setRefreshToken(data.refreshToken)
      return data.accessToken
    } catch (e) {
      // Rechazado: expirado, revocado o robado. Sea cual sea, ya no sirve.
      clearRefreshToken()
      throw e
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}
