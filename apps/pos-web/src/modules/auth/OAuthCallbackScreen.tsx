import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '~/stores/session-store'
import { Button } from '~/components/ui/Button'
import { BrandLockup } from '~/components/shared/Brand'
import { Spinner } from '~/components/shared/StateBlock'

/**
 * Aterrizaje del redirect de Google.
 *
 * El API devuelve un ticket de un solo uso —nunca el JWT— y aquí se canjea por
 * la sesión. Al terminar, el flujo sigue igual que un login con contraseña:
 * `/seleccionar` resuelve empresa y sucursal.
 */
export function OAuthCallbackScreen() {
  const { loginWithOAuthTicket, isAuthenticated, availableTenants } = useAuthStore()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  // El ticket se consume una sola vez; en StrictMode el efecto corre dos veces.
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    const failure = params.get('error')
    const ticket = params.get('ticket')

    // La URL se limpia antes de canjear: el ticket es de un solo uso, y dejarlo
    // ahí lo mete en el historial y hace que cualquier recarga reintente un
    // canje ya gastado.
    window.history.replaceState({}, '', '/auth/callback')

    if (failure) {
      setError(failure)
      return
    }
    if (!ticket) {
      setError('El acceso con Google no devolvió una sesión válida')
      return
    }

    void loginWithOAuthTicket(ticket)
  }, [params, loginWithOAuthTicket])

  if (isAuthenticated || availableTenants) return <Navigate to="/seleccionar" replace />

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--neutral-0)', padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
        <BrandLockup />
        {error ? (
          <>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', maxWidth: 320 }}>{error}</div>
            <Button onClick={() => window.location.assign('/login')}>Volver a iniciar sesión</Button>
          </>
        ) : (
          <>
            <Spinner />
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Completando el acceso…</div>
          </>
        )}
      </div>
    </div>
  )
}
