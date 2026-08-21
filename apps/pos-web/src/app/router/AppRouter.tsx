import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequireBranch, RequireOpenCash } from './guards'
import { LoadingState } from '~/components/shared/StateBlock'
import { LoginScreen } from '~/modules/auth/LoginScreen'
import { OAuthCallbackScreen } from '~/modules/auth/OAuthCallbackScreen'
import { SelectContextScreen } from '~/modules/session/SelectContextScreen'
import { OpenCashScreen } from '~/modules/cash/OpenCashScreen'
import { CashScreen } from '~/modules/cash/CashScreen'
import { TenantSuspendedScreen } from '~/modules/auth/TenantSuspendedScreen'

/**
 * El POS y el ticket se cargan en diferido: son las pantallas más pesadas y no
 * hacen falta hasta que hay sesión, sucursal y caja abierta.
 */
const PosScreen = lazy(() => import('~/modules/pos/PosScreen').then((m) => ({ default: m.PosScreen })))
const TicketScreen = lazy(() => import('~/modules/ticket/TicketScreen').then((m) => ({ default: m.TicketScreen })))
const ComingSoonScreen = lazy(() =>
  import('~/modules/shell/ComingSoonScreen').then((m) => ({ default: m.ComingSoonScreen })),
)

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingState label="Cargando…" minHeight="100vh" />}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/auth/callback" element={<OAuthCallbackScreen />} />
        <Route path="/suspendido" element={<TenantSuspendedScreen />} />

        <Route
          path="/seleccionar"
          element={
            <RequireAuth>
              <SelectContextScreen />
            </RequireAuth>
          }
        />

        <Route
          path="/caja/apertura"
          element={
            <RequireAuth>
              <RequireBranch>
                <OpenCashScreen />
              </RequireBranch>
            </RequireAuth>
          }
        />

        <Route
          path="/pos"
          element={
            <RequireAuth>
              <RequireBranch>
                <RequireOpenCash>
                  <PosScreen />
                </RequireOpenCash>
              </RequireBranch>
            </RequireAuth>
          }
        />

        <Route
          path="/ticket/:orderId"
          element={
            <RequireAuth>
              <RequireBranch>
                <TicketScreen />
              </RequireBranch>
            </RequireAuth>
          }
        />

        {/* Caja del turno: retiro, arqueo y corte desde la propia terminal. No
            exige caja vendible —una sesión EN_ARQUEO se opera justo desde aquí—. */}
        <Route
          path="/caja"
          element={
            <RequireAuth>
              <RequireBranch>
                <CashScreen />
              </RequireBranch>
            </RequireAuth>
          }
        />

        {/* Secciones del menú lateral aún sin pantalla diseñada. */}
        {['inicio', 'tickets', 'productos', 'clientes', 'reportes'].map((section) => (
          <Route
            key={section}
            path={`/${section}`}
            element={
              <RequireAuth>
                <RequireBranch>
                  <ComingSoonScreen section={section} />
                </RequireBranch>
              </RequireAuth>
            }
          />
        ))}

        <Route path="/" element={<Navigate to="/pos" replace />} />
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </Suspense>
  )
}
