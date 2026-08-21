import axios from 'axios'
import { getAccessToken, clearAccessToken, clearRefreshToken, getRefreshToken } from '@/services/core/auth-service'
import { refreshSession } from '@/lib/session-refresh'
import {
  getOperatorToken,
  clearOperatorToken,
  isOperatorTokenExpired,
  isOperatorScopedUrl,
  OPERATOR_EXPIRED_EVENT,
} from '@/services/restaurant/operator-session-service'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  },
})

api.interceptors.request.use((config) => {
  // En rutas de captura de comanda, si hay sesión de operador vigente, autentica
  // como el mesero (JWT typ:'operator'). El resto — incluido el cobro
  // (/checkout) y toda la app administrativa — usa el token de usuario.
  const url = config.url ?? ''
  const operatorToken = getOperatorToken()
  if (operatorToken && !isOperatorTokenExpired(operatorToken) && isOperatorScopedUrl(url)) {
    config.headers.Authorization = `Bearer ${operatorToken}`
    return config
  }
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // 401 en ruta de operador → expira SOLO la sesión de operador (re-PIN),
      // sin tocar la sesión administrativa ni recargar la app.
      const url: string = error.config?.url ?? ''
      if (isOperatorScopedUrl(url) && getOperatorToken()) {
        clearOperatorToken()
        window.dispatchEvent(new CustomEvent(OPERATOR_EXPIRED_EVENT))
        return Promise.reject(error)
      }
      // 401 en el propio flujo de acceso = credenciales incorrectas, no sesión
      // expirada: recargar aquí borraría el formulario antes de que la pantalla
      // pueda mostrar el mensaje. Se deja pasar el error al llamador.
      // Mismo criterio que el `isAuthFlow` de TENANT_SUSPENDED, más abajo.
      //
      // `oauth/exchange` y `refresh` entran por la misma razón y una más:
      // recargar con el ticket todavía en la URL relanza el canje, que vuelve a
      // fallar, que recarga otra vez — un bucle infinito.
      const isAuthFlow =
        url.includes('/auth/login') ||
        url.includes('/auth/select-tenant') ||
        url.includes('/auth/oauth/exchange') ||
        url.includes('/auth/refresh')
      if (isAuthFlow) {
        return Promise.reject(error)
      }

      // Access token vencido: se renueva con el refresh token y se reintenta la
      // petición una sola vez. `_retry` corta el ciclo si el token nuevo también
      // da 401 (p. ej. el permiso se revocó de verdad).
      const config = error.config ?? {}
      if (!config._retry && getRefreshToken()) {
        config._retry = true
        try {
          const accessToken = await refreshSession()
          config.headers = { ...config.headers, Authorization: `Bearer ${accessToken}` }
          return api.request(config)
        } catch {
          // Cae al cierre de sesión de abajo.
        }
      }

      clearAccessToken()
      clearRefreshToken()
      window.location.reload()
    }
    if (error.response?.status === 403 && error.response?.data?.code === 'TENANT_SUSPENDED') {
      const url: string = error.config?.url ?? ''
      const isAuthFlow = url.includes('/auth/login') || url.includes('/auth/select-tenant')
      if (!isAuthFlow) {
        clearAccessToken()
        clearRefreshToken()
        window.dispatchEvent(new CustomEvent('tenant:suspended'))
      }
    }
    return Promise.reject(error)
  }
)
