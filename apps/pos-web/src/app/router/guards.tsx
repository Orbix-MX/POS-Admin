import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '~/stores/session-store'
import { useCashStore, isSellable } from '~/stores/cash-store'
import { LoadingState } from '~/components/shared/StateBlock'

/** Sin token válido no hay POS. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const tenantSuspended = useAuthStore((s) => s.tenantSuspended)
  const location = useLocation()

  if (tenantSuspended) return <Navigate to="/suspendido" replace />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

/**
 * Toda operación del POS ocurre en una sucursal: es la que el backend lee del
 * JWT para aislar inventario y caja.
 */
export function RequireBranch({ children }: { children: ReactNode }) {
  const currentBranch = useAuthStore((s) => s.currentBranch)
  const availableBranches = useAuthStore((s) => s.availableBranches)

  if (availableBranches === null) return <LoadingState label="Cargando sucursales…" minHeight="100vh" />
  if (!currentBranch) return <Navigate to="/seleccionar" replace />
  return <>{children}</>
}

/** Sin caja abierta no se puede cobrar; el backend rechaza la venta igualmente. */
export function RequireOpenCash({ children }: { children: ReactNode }) {
  const branchId = useAuthStore((s) => s.currentBranch?.id)
  const { session, checked, loading, refresh } = useCashStore()

  useEffect(() => {
    if (!checked && !loading) void refresh(branchId)
  }, [checked, loading, refresh, branchId])

  if (!checked) return <LoadingState label="Verificando la caja…" minHeight="100vh" />
  if (!isSellable(session)) return <Navigate to="/caja/apertura" replace />
  return <>{children}</>
}
