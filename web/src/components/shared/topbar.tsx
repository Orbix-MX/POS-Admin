import { Search, Sun, Moon, Bell, Plus, Monitor } from 'lucide-react'
import { useERPStore } from '@/store/erp-store'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ModuleId } from '@/types/erp'


const MODULE_META: Record<ModuleId, { label: string; breadcrumb: string[] }> = {
  dashboard: { label: "Dashboard", breadcrumb: ["Dashboard"] },
  ventas: { label: "Ventas", breadcrumb: ["Negocio", "Ventas"] },
  compras: { label: "Compras", breadcrumb: ["Negocio", "Compras"] },
  inventario: { label: "Inventario", breadcrumb: ["Negocio", "Inventario"] },
  clientes: { label: "Clientes", breadcrumb: ["Negocio", "Clientes"] },
  proveedores: { label: "Proveedores", breadcrumb: ["Negocio", "Proveedores"] },
  servicios: { label: "Servicios", breadcrumb: ["Negocio", "Servicios"] },
  cotizaciones: { label: "Cotizaciones", breadcrumb: ["Negocio", "Cotizaciones"] },
  'ordenes-trabajo': { label: "Órdenes de Trabajo", breadcrumb: ["Negocio", "Órdenes de Trabajo"] },
  'empleados': { label: "Capital Humano", breadcrumb: ["Negocio", "Capital Humano"] },
  contabilidad: { label: "Contabilidad", breadcrumb: ["Administración", "Contabilidad"] },
  cxc: { label: "Cuentas por Cobrar", breadcrumb: ["Administración", "Cuentas por Cobrar"] },
  cxp: { label: "Cuentas por Pagar", breadcrumb: ["Administración", "Cuentas por Pagar"] },
  caja: { label: "Corte de Caja", breadcrumb: ["Administración", "Corte de Caja"] },
  reportes: { label: "Reportes", breadcrumb: ["Administración", "Reportes"] },
  configuracion: { label: "Configuración", breadcrumb: ["Administración", "Configuración"] },
  usuarios: { label: "Usuarios", breadcrumb: ["Administración", "Usuarios"] },
  roles: { label: "Roles y Permisos", breadcrumb: ["Administración", "Roles y Permisos"] },
}

const ACTION_LABELS: Partial<Record<ModuleId, string>> = {
  ventas: "Nueva Venta",
  compras: "Nueva Orden",
  inventario: "Nuevo Producto",
  clientes: "Nuevo Cliente",
  proveedores: "Nuevo Proveedor",
  contabilidad: "Nuevo Asiento",
}

const PATH_TO_MODULE: Record<string, ModuleId> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/ventas': 'ventas',
  '/compras': 'compras',
  '/inventario': 'inventario',
  '/clientes': 'clientes',
  '/proveedores': 'proveedores',
  '/servicios': 'servicios',
  '/cotizaciones': 'cotizaciones',
  '/ordenes-trabajo': 'ordenes-trabajo',
  '/empleados': 'empleados',
  '/contabilidad': 'contabilidad',
  '/cxc': 'cxc',
  '/cxp': 'cxp',
  '/caja': 'caja',
  '/reportes': 'reportes',
  '/configuracion': 'configuracion',
  '/usuarios': 'usuarios',
  '/roles': 'roles',
}

export { MODULE_META }

export function Topbar() {
  const location = useLocation()
  const { darkMode, toggleDarkMode } = useERPStore()
  const activeModule = PATH_TO_MODULE[location.pathname] || 'dashboard'
  const meta = MODULE_META[activeModule]
  const actionLabel = ACTION_LABELS[activeModule]
  const router = useNavigate()
  return (
    <div className="h-[52px] flex items-center justify-between px-6 border-b border-border bg-card shrink-0">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        {meta.breadcrumb.map((b, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="opacity-50">›</span>}
            <span className={i === meta.breadcrumb.length - 1 ? 'text-foreground font-semibold' : ''}>
              {b}
            </span>
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5">
        {/* POS Button */}
        <button
          onClick={() => router('/pos')}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer shadow-md"
        >
          <Monitor className="w-3.5 h-3.5" />
          Abrir POS
        </button>

        <div className="w-px h-5 bg-border" />

        {/* Search */}
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 w-[200px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            placeholder="Buscar…"
            className="border-none bg-transparent outline-none text-[13px] text-foreground w-full"
          />
        </div>

        {/* Action button */}
        {actionLabel && (
          <button className="flex items-center gap-1.5 bg-primary text-primary-foreground border-none rounded-lg px-3.5 py-1.5 text-[13px] font-semibold cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            {actionLabel}
          </button>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-8 h-8 border border-border rounded-lg flex items-center justify-center bg-card cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
        >
          {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button className="w-8 h-8 border border-border rounded-lg flex items-center justify-center bg-card cursor-pointer text-muted-foreground">
            <Bell className="w-4 h-4" />
          </button>
          <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-card" />
        </div>
      </div>
    </div>
  )
}
