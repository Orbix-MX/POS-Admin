import { useState, useEffect } from 'react'
import { Building2, Users, GitBranch, TrendingUp, Loader2 } from 'lucide-react'
import { fetchDashboardStats } from '@/services/platform/platform-tenants-service'
import type { PlatformDashboardStats, TenantPlan } from '@/services/platform/platform-tenants-service'

const PLAN_ORDER: TenantPlan[] = ['FREE', 'STARTER', 'PRO', 'PLUS', 'ENTERPRISE']

const PLAN_COLORS: Record<TenantPlan, string> = {
  FREE:       'bg-zinc-700',
  STARTER:    'bg-sky-600',
  PRO:        'bg-indigo-600',
  PLUS:       'bg-purple-600',
  ENTERPRISE: 'bg-amber-500',
}

export function PlatformDashboard() {
  const [stats, setStats] = useState<PlatformDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!stats) return null

  const kpis = [
    { label: 'Empresas activas',    value: stats.tenants.active,    icon: Building2,   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Empresas en trial',   value: stats.tenants.trial,     icon: TrendingUp,  color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
    { label: 'Empresas suspendidas',value: stats.tenants.suspended, icon: Building2,   color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
    { label: 'Usuarios totales',    value: stats.users.total,       icon: Users,       color: 'text-indigo-400',  bg: 'bg-indigo-500/10'  },
    { label: 'Sucursales totales',  value: stats.branches.total,    icon: GitBranch,   color: 'text-purple-400',  bg: 'bg-purple-500/10'  },
  ]

  const planMap = new Map(stats.byPlan.map(p => [p.plan, p.count]))
  const totalTenants = stats.tenants.total

  return (
    <div className="p-8 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Vista global de la plataforma SaaS</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-5">
              <div className={`w-9 h-9 ${k.bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className={`w-4.5 h-4.5 ${k.color}`} />
              </div>
              <div className="text-2xl font-extrabold text-white">{k.value.toLocaleString()}</div>
              <div className="text-[12px] text-zinc-500 mt-0.5">{k.label}</div>
            </div>
          )
        })}
      </div>

      {/* Plans breakdown + Totals */}
      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* Plans bar */}
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-6">
          <div className="text-[14px] font-bold text-white mb-5">Distribución por Plan</div>
          <div className="flex flex-col gap-4">
            {PLAN_ORDER.map(plan => {
              const count = planMap.get(plan) ?? 0
              const pct = totalTenants > 0 ? Math.round((count / totalTenants) * 100) : 0
              return (
                <div key={plan}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-zinc-400 font-medium">{plan}</span>
                    <span className="text-[12px] text-zinc-300 font-bold">{count} <span className="text-zinc-600 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${PLAN_COLORS[plan]} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-6 flex flex-col gap-4">
          <div className="text-[14px] font-bold text-white mb-1">Resumen</div>
          {[
            { label: 'Total empresas', value: stats.tenants.total },
            { label: 'Total usuarios', value: stats.users.total },
            { label: 'Total sucursales', value: stats.branches.total },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between py-2 border-b border-zinc-700/50 last:border-0">
              <span className="text-[13px] text-zinc-400">{r.label}</span>
              <span className="text-[15px] font-bold text-white">{r.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
