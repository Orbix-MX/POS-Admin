import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Loader2, Building2, AlertTriangle, RefreshCw } from 'lucide-react'
import {
  fetchTenants, updateTenantStatus,
} from '@/services/platform/platform-tenants-service'
import type { PlatformTenant, TenantStatus, TenantPlan } from '@/services/platform/platform-tenants-service'
import { TenantStatusBadge, TenantPlanBadge } from '@/components/platform/tenant-status-badge'
import { PlatformProvisionModal } from '@/components/platform/platform-provision-modal'

const PLANS: TenantPlan[] = ['FREE', 'STARTER', 'PRO', 'PLUS', 'ENTERPRISE']
const STATUSES: TenantStatus[] = ['ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED', 'DISABLED', 'CANCELLED']

function errMessage(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error inesperado'
}

export function PlatformEmpresas() {
  const navigate = useNavigate()
  const [tenants, setTenants] = useState<PlatformTenant[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [page, setPage] = useState(1)
  const [provisionOpen, setProvisionOpen] = useState(false)

  // Confirm status change
  const [confirmModal, setConfirmModal] = useState<{
    tenantId: string; tenantName: string; action: 'suspend' | 'activate'; newStatus: TenantStatus
  } | null>(null)
  const [confirmReason, setConfirmReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const LIMIT = 15

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchTenants({
        page,
        limit: LIMIT,
        ...(statusFilter && { status: statusFilter }),
        ...(planFilter && { plan: planFilter }),
        ...(search && { search }),
      })
      setTenants(res.data)
      setTotal(res.meta.total)
    } catch {
      setError('Error al cargar empresas')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, planFilter, search])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / LIMIT)

  const handleStatusChange = useCallback(async () => {
    if (!confirmModal) return
    setSaving(true)
    setActionError(null)
    try {
      await updateTenantStatus(confirmModal.tenantId, confirmModal.newStatus, confirmReason)
      setConfirmModal(null)
      setConfirmReason('')
      await load()
    } catch (e) {
      setActionError(errMessage(e))
    } finally {
      setSaving(false)
    }
  }, [confirmModal, confirmReason, load])

  const openSuspend = useCallback((t: PlatformTenant) => {
    setConfirmModal({ tenantId: t.id, tenantName: t.name, action: 'suspend', newStatus: 'SUSPENDED' })
    setConfirmReason('')
    setActionError(null)
  }, [])

  const openActivate = useCallback((t: PlatformTenant) => {
    setConfirmModal({ tenantId: t.id, tenantName: t.name, action: 'activate', newStatus: 'ACTIVE' })
    setConfirmReason('')
    setActionError(null)
  }, [])

  return (
    <div className="p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Empresas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{total} empresa{total !== 1 ? 's' : ''} registrada{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 rounded-lg text-[13px] text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 bg-transparent cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setProvisionOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[13px] font-semibold hover:bg-indigo-500 transition-colors border-none cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva empresa
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre o slug..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-300 outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="">Todos los estados</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={planFilter}
          onChange={e => { setPlanFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-300 outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="">Todos los planes</option>
          {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-red-400 text-[13px]">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        ) : tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-500">
            <Building2 className="w-10 h-10 opacity-30" />
            <span className="text-[13px]">Sin empresas registradas</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700/50">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Empresa</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Plan</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Usuarios</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Sucursales</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Creada</th>
                <th className="text-right px-5 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} className="border-b border-zinc-700/30 hover:bg-zinc-700/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="text-[13px] font-semibold text-zinc-100">{t.name}</div>
                    <div className="text-[11px] text-zinc-500">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <TenantPlanBadge plan={t.plan} />
                  </td>
                  <td className="px-4 py-3.5">
                    <TenantStatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-zinc-300">
                    {t._count?.memberships ?? '—'}
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-zinc-300">
                    {t._count?.branches ?? '—'}
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-zinc-500">
                    {new Date(t.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/platform/empresas/${t.id}`)}
                        className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 rounded-lg bg-transparent cursor-pointer transition-colors"
                      >
                        Ver
                      </button>
                      {t.status !== 'SUSPENDED' && t.status !== 'CANCELLED' ? (
                        <button
                          onClick={() => openSuspend(t)}
                          className="px-2.5 py-1 text-[11px] text-amber-400 hover:text-amber-300 border border-amber-700/50 hover:border-amber-600 rounded-lg bg-transparent cursor-pointer transition-colors"
                        >
                          Suspender
                        </button>
                      ) : (
                        <button
                          onClick={() => openActivate(t)}
                          className="px-2.5 py-1 text-[11px] text-emerald-400 hover:text-emerald-300 border border-emerald-700/50 hover:border-emerald-600 rounded-lg bg-transparent cursor-pointer transition-colors"
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-zinc-500">
            Página {page} de {totalPages} · {total} resultados
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-[12px] border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed bg-transparent cursor-pointer transition-colors"
            >
              Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-[12px] border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed bg-transparent cursor-pointer transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Confirm status modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-[420px] shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 bg-amber-500/15 rounded-lg flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <div>
                <div className="text-[15px] font-bold text-white">
                  {confirmModal.action === 'suspend' ? 'Suspender empresa' : 'Activar empresa'}
                </div>
                <div className="text-[13px] text-zinc-400 mt-1">
                  {confirmModal.action === 'suspend'
                    ? `Los usuarios de "${confirmModal.tenantName}" no podrán iniciar sesión.`
                    : `Los usuarios de "${confirmModal.tenantName}" podrán acceder nuevamente.`
                  }
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[12px] font-semibold text-zinc-400 mb-1.5 block">
                Razón {confirmModal.action === 'suspend' ? '(requerida)' : '(opcional)'}
              </label>
              <input
                value={confirmReason}
                onChange={e => setConfirmReason(e.target.value)}
                placeholder="Ej: Falta de pago, violación de términos..."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
              />
            </div>

            {actionError && (
              <div className="mb-3 text-[12px] text-red-400">{actionError}</div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmModal(null)}
                disabled={saving}
                className="px-4 py-2 text-[13px] text-zinc-400 border border-zinc-700 rounded-lg bg-transparent cursor-pointer hover:border-zinc-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleStatusChange}
                disabled={saving || (confirmModal.action === 'suspend' && !confirmReason.trim())}
                className={`px-4 py-2 text-[13px] font-semibold text-white border-none rounded-lg cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                  ${confirmModal.action === 'suspend' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {confirmModal.action === 'suspend' ? 'Suspender' : 'Activar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provision modal */}
      {provisionOpen && (
        <PlatformProvisionModal
          onClose={() => setProvisionOpen(false)}
          onSuccess={() => { setProvisionOpen(false); load() }}
        />
      )}
    </div>
  )
}
