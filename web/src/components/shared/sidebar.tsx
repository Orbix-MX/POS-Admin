import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, ShoppingBag, ShoppingCart, Package,
  Users, Truck, FileText, Settings, Shield,
  ChevronDown, LogOut, Monitor, Landmark, Receipt, TrendingUp, Wrench, UserCheck,
} from 'lucide-react'

type NavItem = {
  module: string
  label: string
  icon: LucideIcon
  path: string
  permission?: string
}

type NavGroup = {
  group: string
  key: string
  items: NavItem[]
}
import { useERPStore } from '@/store/erp-store'
import { useAuthStore } from '@/store/auth-store'
import { AvatarInitials } from './avatar-initials'

const ALL_NAV: NavGroup[] = [
  {
    group: 'Negocio', key: 'business', items: [
      { module: 'dashboard', label: 'Dashboard',    icon: LayoutDashboard, path: '/dashboard' },
      { module: 'ventas',    label: 'Ventas',       icon: ShoppingBag,     path: '/ventas'    },
      { module: 'compras',   label: 'Compras',      icon: ShoppingCart,    path: '/compras'   },
      { module: 'inventario',label: 'Inventario',   icon: Package,         path: '/inventario'},
      { module: 'clientes',  label: 'Clientes',     icon: Users,           path: '/clientes'  },
      { module: 'proveedores',label: 'Proveedores', icon: Truck,           path: '/proveedores'},
      { module: 'servicios', label: 'Servicios',    icon: Wrench,          path: '/servicios' },
      { module: 'cotizaciones',label: 'Cotizaciones',icon: FileText,       path: '/cotizaciones'},
      { module: 'ordenes-trabajo', label: 'Órdenes de Trabajo', icon: Wrench, path: '/ordenes-trabajo' },
      { module: 'empleados', label: 'Capital Humano', icon: UserCheck, path: '/empleados' },
    ],
  },
  {
    group: 'Administración', key: 'management', items: [
      { module: 'cxc',          label: 'Cuentas por Cobrar', icon: TrendingUp, path: '/cxc',          permission: 'receivables:view' },
      { module: 'cxp',          label: 'Cuentas por Pagar',  icon: Receipt,    path: '/cxp',          permission: 'payables:view'    },
      { module: 'caja',         label: 'Corte de Caja',      icon: Landmark,   path: '/caja',         permission: 'cash:view'        },
      { module: 'reportes',     label: 'Reportes',           icon: FileText,   path: '/reportes',     permission: 'reports:view'     },
      { module: 'usuarios',     label: 'Usuarios',           icon: Users,      path: '/usuarios',     permission: 'users:view'       },
      { module: 'roles',        label: 'Roles y Permisos',   icon: Shield,     path: '/roles',        permission: 'roles:view'       },
      { module: 'configuracion',label: 'Configuración',      icon: Settings,   path: '/configuracion',permission: 'settings:view'    },
    ],
  },
]

export function Sidebar() {
  const { empresa } = useERPStore()
  const { user, logout, enabledModules, permissions } = useAuthStore()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ business: true, management: true })

  const displayName = user ? `${user.firstName} ${user.lastName}` : empresa.usuario
  const displayEmail = user?.email ?? empresa.email

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const visibleGroups = ALL_NAV.map(group => ({
    ...group,
    items: group.items.filter(item =>
      enabledModules.includes(item.module) &&
      (isSuperAdmin || !item.permission || permissions.includes(item.permission))
    ),
  })).filter(group => group.items.length > 0)

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
        {visibleGroups.map(group => (
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
                  key={item.module}
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
