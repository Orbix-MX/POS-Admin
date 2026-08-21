import { useEffect, useState, type ReactNode } from 'react'
import { useAuthStore } from '~/stores/session-store'
import { useCashStore } from '~/stores/cash-store'
import { LoadingState } from '~/components/shared/StateBlock'
import { NetworkStatusProvider } from './NetworkStatusProvider'

/**
 * Arranque de la aplicación.
 *
 * `useAuthStore.init()` es el mismo del Admin Web: valida el token guardado,
 * carga capabilities/permisos y restaura la sucursal. Hasta que termina no se
 * pinta ninguna ruta, para no mostrar el login a alguien con sesión vigente.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const init = useAuthStore((s) => s.init)
  const capabilitiesLoaded = useAuthStore((s) => s.capabilitiesLoaded)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setTenantSuspended = useAuthStore((s) => s.setTenantSuspended)
  const resetCash = useCashStore((s) => s.reset)
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    void init().finally(() => setBooted(true))
  }, [init])

  // El interceptor del api-client emite este evento cuando el backend responde
  // 403 TENANT_SUSPENDED. Se reutiliza tal cual, sin duplicar el manejo.
  useEffect(() => {
    const onSuspended = () => setTenantSuspended(true)
    window.addEventListener('tenant:suspended', onSuspended)
    return () => window.removeEventListener('tenant:suspended', onSuspended)
  }, [setTenantSuspended])

  // Al cerrar sesión, la caja del turno deja de tener sentido.
  useEffect(() => {
    if (!isAuthenticated) resetCash()
  }, [isAuthenticated, resetCash])

  if (!booted || !capabilitiesLoaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--neutral-0)' }}>
        <LoadingState label="Abriendo Orbix POS…" minHeight={200} />
      </div>
    )
  }

  return <NetworkStatusProvider>{children}</NetworkStatusProvider>
}
