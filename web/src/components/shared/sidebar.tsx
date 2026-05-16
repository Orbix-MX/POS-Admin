import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingBag, ShoppingCart, Package,
  Users, Truck, FileText, Settings, Shield,
  ChevronDown, LogOut, Monitor, Landmark, Receipt, TrendingUp, Wrench,
} from 'lucide-react'
import { useERPStore } from '@/store/erp-store'
import { useAuthStore } from '@/store/auth-store'
import { AvatarInitials } from './avatar-initials'
import type { ModuleId } from '@/types/erp'

const NAV = [
  {
    group: "Negocio", key: "business", items: [
      { id: "dashboard" as ModuleId, label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { id: "ventas" as ModuleId, label: "Ventas", icon: ShoppingBag, path: "/ventas" },
      { id: "compras" as ModuleId, label: "Compras", icon: ShoppingCart, path: "/compras" },
      { id: "inventario" as ModuleId, label: "Inventario", icon: Package, path: "/inventario" },
      { id: "clientes" as ModuleId, label: "Clientes", icon: Users, path: "/clientes" },
      { id: "proveedores" as ModuleId, label: "Proveedores", icon: Truck, path: "/proveedores" },
      { id: "servicios" as ModuleId, label: "Servicios", icon: Wrench, path: "/servicios" },
      { id: "cotizaciones" as ModuleId, label: "Cotizaciones", icon: FileText, path: "/cotizaciones" },
    ]
  },
  {
    group: "Administración", key: "management", items: [
      // { id: "contabilidad" as ModuleId, label: "Contabilidad",       icon: DollarSign,  path: "/contabilidad" },
      { id: "cxc" as ModuleId, label: "Cuentas por Cobrar", icon: TrendingUp, path: "/cxc" },
      { id: "cxp" as ModuleId, label: "Cuentas por Pagar", icon: Receipt, path: "/cxp" },
      { id: "caja" as ModuleId, label: "Corte de Caja", icon: Landmark, path: "/caja" },
      { id: "reportes" as ModuleId, label: "Reportes", icon: FileText, path: "/reportes" },
      { id: "usuarios" as ModuleId, label: "Usuarios", icon: Users, path: "/usuarios" },
      { id: "roles" as ModuleId, label: "Roles y Permisos", icon: Shield, path: "/roles" },
      { id: "configuracion" as ModuleId, label: "Configuración", icon: Settings, path: "/configuracion" },
    ]
  }
]

export function Sidebar() {
  const { empresa } = useERPStore()
  const { user, logout } = useAuthStore()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ business: true, management: true })

  const displayName = user ? `${user.firstName} ${user.lastName}` : empresa.usuario
  const displayEmail = user?.email ?? empresa.email

  return (
    <div className="w-[210px] shrink-0 border-r border-border bg-card flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="px-4 h-[52px] flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] bg-primary rounded-lg flex items-center justify-center">
            <Monitor className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-foreground leading-tight">TiendaPro</div>
            <div className="text-[10px] text-muted-foreground">{empresa.version}</div>
          </div>
        </div>
        <button className="text-muted-foreground bg-transparent border-none cursor-pointer">
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3">
        {NAV.map(group => (
          <div key={group.key} className="mb-1">
            <button
              onClick={() => setExpanded(p => ({ ...p, [group.key]: !p[group.key] }))}
              className="w-full flex items-center justify-between px-4 py-1 bg-transparent border-none cursor-pointer text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5"
            >
              {group.group}
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded[group.key] ? '' : '-rotate-90'}`} />
            </button>
            {expanded[group.key] && group.items.map(item => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) => `w-full flex items-center gap-2.5 px-4 py-2 border-none cursor-pointer text-[13px] text-left relative transition-all
                    ${isActive ? 'bg-secondary font-semibold text-primary' : 'bg-transparent font-normal text-muted-foreground hover:bg-muted/50'}`}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div className="absolute left-0 top-[20%] bottom-[20%] w-[3px] bg-primary rounded-r" />
                      )}
                      <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </div>

      {/* User */}
      <div className="border-t border-border px-3.5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AvatarInitials name={displayName} size={30} />
          <div>
            <div className="text-xs font-semibold text-foreground">{displayName}</div>
            <div className="text-[10px] text-muted-foreground">{displayEmail}</div>
          </div>
        </div>
        <button onClick={logout} title="Cerrar sesión" className="text-muted-foreground bg-transparent border-none cursor-pointer hover:text-foreground transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
