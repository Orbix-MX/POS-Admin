/**
 * Desktop App Shell — Electron + React
 *
 * Reutiliza TODOS los componentes del web via alias @ → ../../web/src
 * Solo agrega: HashRouter, ElectronContext, OfflineBanner, cache inicial
 *
 * Páginas activas en desktop:
 *   POS, Caja, Ventas, Clientes, Inventario, Cotizaciones, Servicios
 * Excluidas por ahora:
 *   Platform, Compras, Reportes complejos, Configuración avanzada
 */
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

// ── Reutiliza todo desde el web (alias @ → ../../web/src) ─────────────────────
import { useAuthStore } from '@/store/auth-store'
import { useERPStore } from '@/store/erp-store'
import { Sidebar } from '@/components/shared/sidebar'
import { Topbar, MODULE_META } from '@/components/shared/topbar'
import { Login } from '@/pages/login'
import { SelectTenant } from '@/pages/select-tenant'
import { SelectBranch } from '@/pages/select-branch'
import { POS } from '@/pages/pos'
import { Caja } from '@/pages/caja'
import { Ventas } from '@/pages/ventas'
import { Clientes } from '@/pages/clientes'
import { Inventario } from '@/pages/inventario'
import { Cotizaciones } from '@/pages/cotizaciones'
import { Servicios } from '@/pages/servicios'
import { OrdenesTrabajo } from '@/pages/ordenes-trabajo'
import { getAccessToken } from '@/services/core/auth-service'
import type { ModuleId } from '@/types/erp'

// ── Desktop-specific ──────────────────────────────────────────────────────────
import { ElectronProvider, useElectron } from '~/context/electron-context'
import { OfflineBanner } from '~/components/offline-banner'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'
const APP_NAME = 'Orbix POS'

const PATH_TO_MODULE: Record<string, ModuleId> = {
  '/': 'pos',
  '/pos': 'pos',
  '/caja': 'caja',
  '/ventas': 'ventas',
  '/clientes': 'clientes',
  '/inventario': 'inventario',
  '/cotizaciones': 'cotizaciones',
  '/servicios': 'servicios',
  '/ordenes-trabajo': 'ordenes-trabajo',
}

// ── Module guard ──────────────────────────────────────────────────────────────

function ModuleRoute({ module, children }: { module: string; children: ReactNode }) {
  const { plan, enabledModules } = useAuthStore()
  if (plan && !enabledModules.includes(module)) {
    return <Navigate to="/pos" replace />
  }
  return <>{children}</>
}

// ── Cache inicial al cargar ───────────────────────────────────────────────────

function CacheInitializer() {
  const { isElectron, isOnline, cacheProducts, cacheCustomers } = useElectron()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isElectron || !isAuthenticated || !isOnline) return

    async function warmCache() {
      try {
        const [productsRes, customersRes] = await Promise.allSettled([
          fetch(`${API_BASE}/pos/products`, {
            headers: { Authorization: `Bearer ${getAccessToken()}` },
          }).then((r) => r.ok ? r.json() : []),
          fetch(`${API_BASE}/pos/customers`, {
            headers: { Authorization: `Bearer ${getAccessToken()}` },
          }).then((r) => r.ok ? r.json() : []),
        ])

        if (productsRes.status === 'fulfilled' && Array.isArray(productsRes.value)) {
          await cacheProducts(productsRes.value)
        }
        if (customersRes.status === 'fulfilled' && Array.isArray(customersRes.value)) {
          await cacheCustomers(customersRes.value)
        }
      } catch {
        // Silencioso — cache es best-effort
      }
    }

    warmCache()
  }, [isElectron, isAuthenticated, isOnline, cacheProducts, cacheCustomers])

  return null
}

// ── Desktop Layout ────────────────────────────────────────────────────────────

function DesktopLayout() {
  const { posOpen, loadTenantBranding } = useERPStore()
  const location = useLocation()
  const activeModule = PATH_TO_MODULE[location.pathname] ?? 'pos'
  const meta = MODULE_META[activeModule]

  useEffect(() => { loadTenantBranding() }, [loadTenantBranding])
  useEffect(() => {
    document.title = meta?.label ? `${meta.label} | ${APP_NAME}` : APP_NAME
  }, [meta])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <OfflineBanner />

      <div className="flex flex-1 overflow-hidden">
        {posOpen && <POS />}

        <Sidebar />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />

          <div className="px-7 pt-5 flex items-center shrink-0">
            <h1 className="text-[22px] font-extrabold text-foreground tracking-tight">
              {meta?.label ?? ''}
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/pos" replace />} />
              <Route path="/pos" element={<ModuleRoute module="pos"><POS /></ModuleRoute>} />
              <Route path="/caja" element={<ModuleRoute module="caja"><Caja /></ModuleRoute>} />
              <Route path="/ventas" element={<ModuleRoute module="ventas"><Ventas /></ModuleRoute>} />
              <Route path="/clientes" element={<ModuleRoute module="clientes"><Clientes /></ModuleRoute>} />
              <Route path="/inventario" element={<ModuleRoute module="inventario"><Inventario /></ModuleRoute>} />
              <Route path="/cotizaciones" element={<ModuleRoute module="cotizaciones"><Cotizaciones /></ModuleRoute>} />
              <Route path="/servicios" element={<ModuleRoute module="servicios"><Servicios /></ModuleRoute>} />
              <Route path="/ordenes-trabajo" element={<ModuleRoute module="ordenes-trabajo"><OrdenesTrabajo /></ModuleRoute>} />
              <Route path="*" element={<Navigate to="/pos" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Auth Gate ─────────────────────────────────────────────────────────────────

function AuthGate() {
  const { isAuthenticated, availableTenants, capabilitiesLoaded, needsBranchSelection, availableBranches, init } =
    useAuthStore()

  useEffect(() => { init() }, [init])

  if (!isAuthenticated && !availableTenants) return <Login />
  if (!isAuthenticated && availableTenants) return <SelectTenant />
  if (!capabilitiesLoaded || availableBranches === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (needsBranchSelection) return <SelectBranch />

  return (
    <>
      <CacheInitializer />
      <DesktopLayout />
    </>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function DesktopApp() {
  return (
    <ElectronProvider apiBase={API_BASE} getToken={getAccessToken}>
      <HashRouter>
        <AuthGate />
      </HashRouter>
    </ElectronProvider>
  )
}
