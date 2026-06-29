import { Search, Sun, Moon, Bell, Plus, Monitor, MapPin, ChevronDown } from 'lucide-react'
import { useERPStore } from '@/store/erp-store'
import { useAuthStore } from '@/store/auth-store'
import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
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
  pos: { label: "POS", breadcrumb: ["POS"] },
  branches: { label: "Sucursales", breadcrumb: ["Administración", "Sucursales"] },
  comanda: { label: "Comandas", breadcrumb: ["Negocio", "Comandas"] },
  'caja-restaurante': { label: "Caja Restaurante", breadcrumb: ["Negocio", "Caja Restaurante"] },
  insumos: { label: "Insumos", breadcrumb: ["Negocio", "Insumos"] },
  kitchen: { label: "Cocina", breadcrumb: ["Negocio", "Cocina"] },
  'dining-areas': { label: "Áreas del restaurante", breadcrumb: ["Negocio", "Áreas del restaurante"] },
  'restaurant-tables': { label: "Mesas", breadcrumb: ["Negocio", "Mesas"] },
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
  '/pos': 'pos',
  '/comanda': 'comanda',
  '/caja-restaurante': 'caja-restaurante',
  '/insumos': 'insumos',
  '/kitchen': 'kitchen',
  '/dining-areas': 'dining-areas',
  '/restaurant-tables': 'restaurant-tables',
}

export { MODULE_META }

function BranchSelector() {
  const { currentBranch, availableBranches, confirmBranch } = useAuthStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!currentBranch) return null

  const canSwitch = (availableBranches?.length ?? 0) > 1

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => canSwitch && setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card text-[12px] font-semibold text-foreground transition-colors ${canSwitch ? 'hover:bg-muted cursor-pointer' : 'cursor-default'}`}
      >
        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="max-w-[120px] truncate">{currentBranch.name}</span>
        {canSwitch && <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>

      {open && canSwitch && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cambiar sucursal</span>
          </div>
          {availableBranches?.map(branch => (
            <button
              key={branch.id}
              onClick={() => { confirmBranch(branch.id); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13px] hover:bg-muted transition-colors ${branch.id === currentBranch.id ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{branch.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Topbar() {
  const location = useLocation()
  const { darkMode, toggleDarkMode } = useERPStore()
  const { enabledModules } = useAuthStore()
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
        {/* Branch Selector */}
        <BranchSelector />

        <div className="w-px h-5 bg-border" />

        {/* POS Button */}
        {enabledModules.includes('pos') && (
          <button
            onClick={() => router('/pos')}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer shadow-md"
          >
            <Monitor className="w-3.5 h-3.5" />
            Abrir POS
          </button>
        )}

        <div className="w-px h-5 bg-border" />

        {/* Search */}
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 w-[200px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            placeholder="Buscar…"
            className="border-none bg-transparent outline-none text-[13px] text-foreground w-full"
          />
        </div>

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
