import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useERPStore } from '@/store/erp-store'
import { useAuthStore } from '@/store/auth-store'
import { Sidebar } from '@/components/shared/sidebar'
import { Topbar, MODULE_META } from '@/components/shared/topbar'
import { Login } from '@/pages/login'
import { SelectTenant } from '@/pages/select-tenant'
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
import { Download } from 'lucide-react'
import { useLocation } from 'react-router-dom'
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
}

function AppLayout() {
  const { posOpen } = useERPStore()
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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ventas" element={<Ventas />} />
            <Route path="/compras" element={<Compras />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/contabilidad" element={<Contabilidad />} />
            <Route path="/cxc" element={<Cxc />} />
            <Route path="/cxp" element={<Cxp />} />
            <Route path="/caja" element={<Caja />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/servicios" element={<Servicios />} />
            <Route path="/cotizaciones" element={<Cotizaciones />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function AuthGate() {
  const { isAuthenticated, availableTenants } = useAuthStore()

  if (!isAuthenticated && !availableTenants) return <Login />
  if (!isAuthenticated && availableTenants) return <SelectTenant />

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

function App() {
  return <AuthGate />
}

export default App
