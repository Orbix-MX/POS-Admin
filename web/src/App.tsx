import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useERPStore } from '@/store/erp-store'
import { useAuthStore } from '@/store/auth-store'
import { usePlatformAuthStore } from '@/store/platform-auth-store'
import { type ReactNode, useEffect } from 'react'
import { Sidebar } from '@/components/shared/sidebar'
import { Topbar, MODULE_META } from '@/components/shared/topbar'
import { PlatformLayout } from '@/components/platform/platform-layout'
import { Login } from '@/pages/login'
import { SelectTenant } from '@/pages/select-tenant'
import { SelectBranch } from '@/pages/select-branch'
import { Dashboard } from '@/pages/dashboard'
import { Ventas } from '@/pages/ventas'
import { Compras } from '@/pages/compras'
import { Inventario } from '@/pages/inventario'
import { Clientes } from '@/pages/clientes'
import { Proveedores } from '@/pages/proveedores'
import { Contabilidad } from '@/pages/contabilidad'
import { Cxc } from '@/pages/cxc'
import { Cxp } from '@/pages/cxp'
import { Caja } from '@/pages/caja'
import { Reportes } from '@/pages/reportes'
import { Configuracion } from '@/pages/configuracion'
import { Usuarios } from '@/pages/usuarios'
import { Roles } from '@/pages/roles'
import { POS } from '@/pages/pos'
import { Servicios } from '@/pages/servicios'
import { Cotizaciones } from '@/pages/cotizaciones'
import { OrdenesTrabajo } from '@/pages/ordenes-trabajo'
import { Empleados } from '@/pages/empleados'
import { PlatformLogin } from '@/pages/platform/platform-login'
import { PlatformDashboard } from '@/pages/platform/platform-dashboard'
import { PlatformEmpresas } from '@/pages/platform/platform-empresas'
import { PlatformEmpresaDetalle } from '@/pages/platform/platform-empresa-detalle'
import { PlatformAuditoria } from '@/pages/platform/platform-auditoria'
import { Download } from 'lucide-react'
import type { ModuleId } from '@/types/erp'

const PATH_TO_MODULE: Record<string, ModuleId> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/ventas': 'ventas',
  '/compras': 'compras',
  '/inventario': 'inventario',
  '/clientes': 'clientes',
  '/proveedores': 'proveedores',
  '/contabilidad': 'contabilidad',
  '/cxc': 'cxc',
  '/cxp': 'cxp',
  '/caja': 'caja',
  '/reportes': 'reportes',
  '/configuracion': 'configuracion',
  '/usuarios': 'usuarios',
  '/roles': 'roles',
  '/servicios': 'servicios',
  '/cotizaciones': 'cotizaciones',
  '/ordenes-trabajo': 'ordenes-trabajo',
  '/empleados': 'empleados',
}

function ModuleRoute({ module, children }: { module: string; children: ReactNode }) {
  const { plan, enabledModules } = useAuthStore()
  if (plan && !enabledModules.includes(module)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function AppLayout() {
  const { posOpen, loadTenantBranding } = useERPStore()

  useEffect(() => { loadTenantBranding() }, [loadTenantBranding])
  const location = useLocation()
  const activeModule = PATH_TO_MODULE[location.pathname] || 'dashboard'
  const meta = MODULE_META[activeModule]

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {posOpen && <POS />}

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />

        <div className="px-7 pt-5 flex items-center justify-between shrink-0">
          <h1 className="text-[22px] font-extrabold text-foreground tracking-tight">
            {meta.label}
          </h1>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg bg-card text-xs cursor-pointer text-muted-foreground">
              <Download className="w-3.5 h-3.5" /> Importar/Exportar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ModuleRoute module="dashboard"><Dashboard /></ModuleRoute>} />
            <Route path="/ventas" element={<ModuleRoute module="ventas"><Ventas /></ModuleRoute>} />
            <Route path="/compras" element={<ModuleRoute module="compras"><Compras /></ModuleRoute>} />
            <Route path="/inventario" element={<ModuleRoute module="inventario"><Inventario /></ModuleRoute>} />
            <Route path="/clientes" element={<ModuleRoute module="clientes"><Clientes /></ModuleRoute>} />
            <Route path="/proveedores" element={<ModuleRoute module="proveedores"><Proveedores /></ModuleRoute>} />
            <Route path="/contabilidad" element={<ModuleRoute module="reportes"><Contabilidad /></ModuleRoute>} />
            <Route path="/cxc" element={<ModuleRoute module="cxc"><Cxc /></ModuleRoute>} />
            <Route path="/cxp" element={<ModuleRoute module="cxp"><Cxp /></ModuleRoute>} />
            <Route path="/caja" element={<ModuleRoute module="caja"><Caja /></ModuleRoute>} />
            <Route path="/reportes" element={<ModuleRoute module="reportes"><Reportes /></ModuleRoute>} />
            <Route path="/configuracion" element={<ModuleRoute module="configuracion"><Configuracion /></ModuleRoute>} />
            <Route path="/usuarios" element={<ModuleRoute module="usuarios"><Usuarios /></ModuleRoute>} />
            <Route path="/roles" element={<ModuleRoute module="roles"><Roles /></ModuleRoute>} />
            <Route path="/pos" element={<ModuleRoute module="pos"><POS /></ModuleRoute>} />
            <Route path="/servicios" element={<ModuleRoute module="servicios"><Servicios /></ModuleRoute>} />
            <Route path="/cotizaciones" element={<ModuleRoute module="cotizaciones"><Cotizaciones /></ModuleRoute>} />
            <Route path="/ordenes-trabajo" element={<ModuleRoute module="ordenes-trabajo"><OrdenesTrabajo /></ModuleRoute>} />
            <Route path="/empleados" element={<ModuleRoute module="empleados"><Empleados /></ModuleRoute>} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function TenantAuthGate() {
  const { isAuthenticated, availableTenants, capabilitiesLoaded, needsBranchSelection, availableBranches, init } = useAuthStore()

  useEffect(() => { init() }, [init])

  if (!isAuthenticated && !availableTenants) return <Login />
  if (!isAuthenticated && availableTenants) return <SelectTenant />
  if (!capabilitiesLoaded || availableBranches === null) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (needsBranchSelection) return <SelectBranch />

  return <AppLayout />
}

function PlatformGate() {
  const { isAuthenticated, init } = usePlatformAuthStore()

  useEffect(() => { init() }, [init])

  if (!isAuthenticated) return <PlatformLogin />

  return (
    <PlatformLayout>
      <Routes>
        <Route path="/platform" element={<Navigate to="/platform/dashboard" replace />} />
        <Route path="/platform/dashboard" element={<PlatformDashboard />} />
        <Route path="/platform/empresas" element={<PlatformEmpresas />} />
        <Route path="/platform/empresas/:id" element={<PlatformEmpresaDetalle />} />
        <Route path="/platform/auditoria" element={<PlatformAuditoria />} />
        <Route path="*" element={<Navigate to="/platform/dashboard" replace />} />
      </Routes>
    </PlatformLayout>
  )
}

function AppRouter() {
  const location = useLocation()
  const isPlatform = location.pathname.startsWith('/platform')

  if (isPlatform) return <PlatformGate />
  return <TenantAuthGate />
}

function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}

export default App
