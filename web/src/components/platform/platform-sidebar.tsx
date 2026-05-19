import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, LogOut, Shield, Activity } from 'lucide-react'
import { usePlatformAuthStore } from '@/store/platform-auth-store'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/platform/dashboard' },
  { label: 'Empresas', icon: Building2, path: '/platform/empresas' },
  { label: 'Auditoría', icon: Activity, path: '/platform/auditoria' },
]

export function PlatformSidebar() {
  const { user, logout } = usePlatformAuthStore()
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Admin'

  return (
    <div className="w-[220px] shrink-0 bg-zinc-950 flex flex-col h-full border-r border-zinc-800">
      {/* Logo */}
      <div className="px-5 h-[56px] flex items-center gap-3 border-b border-zinc-800">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-[13px] font-bold text-white leading-tight">Platform Admin</div>
          <div className="text-[10px] text-zinc-500">SaaS Management</div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 py-4 px-2">
        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-3 mb-2">Administración</div>
        {NAV.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 font-semibold'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </div>

      {/* User */}
      <div className="border-t border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {user?.firstName?.[0]?.toUpperCase() ?? 'P'}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-200 truncate">{displayName}</div>
            <div className="text-[10px] text-zinc-500 truncate">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={logout}
          title="Cerrar sesión"
          className="text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer transition-colors ml-2"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
