import axios from 'axios'
import { getAccessToken, clearAccessToken } from '@/services/core/auth-service'
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
  error => {
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
      const isAuthFlow = url.includes('/auth/login') || url.includes('/auth/select-tenant')
      if (isAuthFlow) {
        return Promise.reject(error)
      }
      clearAccessToken()
      window.location.reload()
    }
    if (error.response?.status === 403 && error.response?.data?.code === 'TENANT_SUSPENDED') {
      const url: string = error.config?.url ?? ''
      const isAuthFlow = url.includes('/auth/login') || url.includes('/auth/select-tenant')
      if (!isAuthFlow) {
        clearAccessToken()
        window.dispatchEvent(new CustomEvent('tenant:suspended'))
      }
    }
    return Promise.reject(error)
  }
)
