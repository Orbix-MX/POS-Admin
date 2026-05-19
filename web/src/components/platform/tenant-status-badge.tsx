import type { TenantStatus, TenantPlan } from '@/services/platform/platform-tenants-service'

const STATUS_STYLES: Record<TenantStatus, string> = {
  ACTIVE:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  TRIAL:     'bg-blue-500/15 text-blue-400 border-blue-500/30',
  SUSPENDED: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  EXPIRED:   'bg-red-500/15 text-red-400 border-red-500/30',
  DISABLED:  'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  CANCELLED: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

const STATUS_LABELS: Record<TenantStatus, string> = {
  ACTIVE:    'Activo',
  TRIAL:     'Trial',
  SUSPENDED: 'Suspendido',
  EXPIRED:   'Expirado',
  DISABLED:  'Deshabilitado',
  CANCELLED: 'Cancelado',
}

const PLAN_STYLES: Record<TenantPlan, string> = {
  FREE:       'bg-zinc-500/15 text-zinc-400',
  STARTER:    'bg-sky-500/15 text-sky-400',
  PRO:        'bg-indigo-500/15 text-indigo-400',
  PLUS:       'bg-purple-500/15 text-purple-400',
  ENTERPRISE: 'bg-amber-500/15 text-amber-400',
}

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function TenantPlanBadge({ plan }: { plan: TenantPlan }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${PLAN_STYLES[plan]}`}>
      {plan}
    </span>
  )
}
