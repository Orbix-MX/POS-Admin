import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, ShoppingBag, ShoppingCart, Package,
  Users, Truck, FileText, Settings, Shield,
  ChevronDown, LogOut, Landmark, Receipt, TrendingUp, Wrench, UserCheck, MapPin, UtensilsCrossed,
} from 'lucide-react'

type NavItem = {
  module: string
  label: string
  icon: LucideIcon
  path: string
  permission?: string
  featureGuard?: (hasFeature: (f: TenantFeature) => boolean, hasPosMode: (m: PosOperationMode) => boolean) => boolean
}

type NavGroup = {
  group: string
  key: string
  items: NavItem[]
}
import { useERPStore } from '@/store/erp-store'
import { useAuthStore } from '@/store/auth-store'
import { useTenantFeatures } from '@/hooks/use-tenant-features'
import type { TenantFeature, PosOperationMode } from '@/hooks/use-tenant-features'
import { AvatarInitials } from './avatar-initials'

function TenantLogo({ logoUrl, name, size = 30 }: { logoUrl?: string; name: string; size?: number }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="rounded-lg object-cover shrink-0"
        style={{ width: size, height: size }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <div
      className="rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}

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
      {
        module: 'comanda',
        label: 'Comandas',
        icon: UtensilsCrossed,
        path: '/comanda',
        featureGuard: (hasFeature, hasPosMode) => hasFeature('TABLES') || hasPosMode('TABLE_SERVICE'),
      },
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
  const { empresa, tenantBranding } = useERPStore()
  const { user, logout, enabledModules, permissions, currentBranch, availableBranches, confirmBranch } = useAuthStore()
  const { hasFeature, hasPosMode } = useTenantFeatures()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ business: true, management: true })
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)

  const displayName = user ? `${user.firstName} ${user.lastName}` : empresa.usuario
  const displayEmail = user?.email ?? empresa.email

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const visibleGroups = ALL_NAV.map(group => ({
    ...group,
    items: group.items.filter(item =>
      enabledModules.includes(item.module) &&
      (isSuperAdmin || !item.permission || permissions.includes(item.permission)) &&
      (!item.featureGuard || item.featureGuard(hasFeature, hasPosMode))
    ),
  })).filter(group => group.items.length > 0)

  return (
    <div className="w-[210px] shrink-0 border-r border-border bg-card flex flex-col h-full overflow-hidden">
      {/* Logo / Tenant branding */}
      <div className="px-4 h-[58px] flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <TenantLogo
            logoUrl={tenantBranding?.logoUrl}
            name={tenantBranding?.displayName ?? tenantBranding?.name ?? 'T'}
            size={32}
          />
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-foreground leading-tight truncate">
              {tenantBranding?.displayName ?? tenantBranding?.name ?? empresa.nombre}
            </div>
            <div className="text-[10px] text-muted-foreground">{empresa.version}</div>
          </div>
        </div>
        <button className="text-muted-foreground bg-transparent border-none cursor-pointer shrink-0">
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {/* Branch indicator */}
      {currentBranch && (
        <div className="relative">
          <button
            onClick={() => (availableBranches?.length ?? 0) > 1 && setBranchMenuOpen(p => !p)}
            className={`w-full flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 text-left ${(availableBranches?.length ?? 0) > 1 ? 'hover:bg-muted/60 cursor-pointer' : 'cursor-default'}`}
          >
            <MapPin className="w-3 h-3 text-primary shrink-0" />
            <span className="text-[11px] font-semibold text-foreground truncate flex-1">{currentBranch.name}</span>
            {(availableBranches?.length ?? 0) > 1 && (
              <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${branchMenuOpen ? 'rotate-180' : ''}`} />
            )}
          </button>
          {branchMenuOpen && (availableBranches?.length ?? 0) > 1 && (
            <div className="absolute left-0 right-0 top-full z-50 bg-card border border-border shadow-lg">
              {availableBranches!.filter(b => b.status === 'ACTIVE').map(b => (
                <button
                  key={b.id}
                  onClick={() => { confirmBranch(b.id); setBranchMenuOpen(false) }}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left text-[12px] hover:bg-muted/50 ${b.id === currentBranch.id ? 'text-primary font-semibold' : 'text-foreground'}`}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Platform branding footer — white-label: hide via VITE_WHITE_LABEL=true */}
      {import.meta.env.VITE_WHITE_LABEL !== 'true' && (
        <div className="px-4 py-2 border-t border-border/50 flex items-center gap-1.5">
          <div className="w-4 h-4 bg-primary/15 rounded flex items-center justify-center shrink-0">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0.5" y="0.5" width="3.5" height="3.5" rx="0.75" fill="currentColor" className="text-primary" />
              <rect x="6" y="0.5" width="3.5" height="3.5" rx="0.75" fill="currentColor" className="text-primary" opacity="0.5" />
              <rect x="0.5" y="6" width="3.5" height="3.5" rx="0.75" fill="currentColor" className="text-primary" opacity="0.5" />
              <rect x="6" y="6" width="3.5" height="3.5" rx="0.75" fill="currentColor" className="text-primary" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-medium text-muted-foreground/50 leading-none">Powered by</div>
            <div className="text-[10px] font-bold text-muted-foreground/60 leading-tight truncate">
              Orbix ERP <span className="font-normal opacity-70">v{__APP_VERSION__}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
