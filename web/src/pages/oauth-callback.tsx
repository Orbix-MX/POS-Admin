import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth-store'

/**
 * Aterrizaje del redirect de Google.
 *
 * El API nunca manda el JWT en la URL: manda un ticket de un solo uso que se
 * canjea aquí por la sesión real. En cuanto se canjea, se limpia la barra de
 * direcciones para que el ticket no quede en el historial ni se reenvíe en un
 * `Referer`, y el gate de `App` toma el control con la sesión ya cargada.
 */
export function OAuthCallback() {
  const loginWithOAuthTicket = useAuthStore((s) => s.loginWithOAuthTicket)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  // React 18 monta dos veces en StrictMode; el ticket es de un solo uso, así que
  // el segundo intento fallaría con "ticket inválido".
  const attempted = useRef(false)

  useEffect(() => {
    // El título se fija aquí y no en el gate: escribirlo durante el render de
    // `TenantAuthGate` es una mutación en render, que es lo que marca el linter.
    document.title = 'Iniciando sesión | Orbix ERP'
  }, [])

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    const params = new URLSearchParams(window.location.search)
    const ticket = params.get('ticket')
    const failure = params.get('error')

    // `navigate` (no el `window.history.replaceState` nativo) para que React
    // Router quede sincronizado con la URL limpia — usar la API nativa
    // directamente deja a `useLocation()` congelado en `/auth/callback`, y
    // cuando la sesión termina de armarse el layout ya no matchea ninguna
    // ruta y la app se queda en blanco (o en este mismo spinner).
    navigate('/', { replace: true })

    if (failure) {
      setError(failure)
      return
    }
    if (!ticket) {
      setError('El acceso con Google no devolvió una sesión válida')
      return
    }

    void loginWithOAuthTicket(ticket)
  }, [loginWithOAuthTicket, navigate])

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          className="text-sm font-medium text-primary underline underline-offset-4"
          onClick={() => window.location.assign('/')}
        >
          Volver a iniciar sesión
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}
