import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowUpCircle, Check, Loader2, X } from 'lucide-react'
import {
  fetchUpgradeRequests,
  resolveUpgradeRequest,
  type UpgradeRequest,
  type UpgradeRequestStatus,
} from '@/services/platform/platform-upgrade-requests-service'
import { TenantPlanBadge, TenantStatusBadge } from '@/components/platform/tenant-status-badge'

const TABS: { status: UpgradeRequestStatus; label: string }[] = [
  { status: 'PENDING', label: 'Pendientes' },
  { status: 'HANDLED', label: 'Atendidas' },
  { status: 'CANCELLED', label: 'Canceladas' },
]

/**
 * Bandeja de solicitudes de "Mejorar plan" que mandan los dueños desde la app. No hay
 * cobro: Platform las atiende a mano (renueva o emite la licencia desde la ficha de la
 * empresa) y las marca aquí.
 *
 * @odd planes-self-service T-003
 */
export function PlatformSolicitudes() {
  const [tab, setTab] = useState<UpgradeRequestStatus>('PENDING')
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (status: UpgradeRequestStatus) => {
    setLoading(true)
    setError(null)
    try {
      setRequests(await fetchUpgradeRequests(status))
    } catch {
      setError('No se pudieron cargar las solicitudes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(tab)
  }, [tab, load])

  const resolve = async (id: string, status: 'HANDLED' | 'CANCELLED') => {
    setBusyId(id)
    setError(null)
    try {
      await resolveUpgradeRequest(id, status)
      setRequests(rs => rs.filter(r => r.id !== id))
    } catch {
      // 404: otra persona la resolvió antes. Se recarga para mostrar lo vigente y el
      // aviso va después: `load` limpia el error al empezar.
      await load(tab)
      setError('No se pudo actualizar la solicitud. Puede que ya esté resuelta.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Solicitudes de plan</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Dueños que piden mejorar su plan desde la app. Actívalo desde la licencia de la empresa y márcala como atendida.
        </p>
      </div>

      <div className="flex gap-1 border-b border-zinc-800" role="tablist">
        {TABS.map(t => (
          <button
            key={t.status}
            role="tab"
            aria-selected={tab === t.status}
            onClick={() => setTab(t.status)}
            className={`px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.status
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div data-testid="solicitudes-error" className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-600 text-[13px]" data-testid="solicitudes-empty">
            <ArrowUpCircle className="w-4 h-4" /> Sin solicitudes {TABS.find(t => t.status === tab)?.label.toLowerCase()}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700/50">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-zinc-500 uppercase">Empresa</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase">Pide</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase">Solicitante</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase">Nota</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase">Fecha</th>
                {tab === 'PENDING' && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} data-testid={`solicitud-${r.id}`} className="border-b border-zinc-700/20 hover:bg-zinc-700/10">
                  <td className="px-5 py-3">
                    <Link to={`/platform/empresas/${r.tenant.id}`} className="text-[13px] font-semibold text-zinc-200 hover:text-indigo-400">
                      {r.tenant.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-1.5">
                      <TenantStatusBadge status={r.tenant.status} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <TenantPlanBadge plan={r.currentPlan} />
                      <span className="text-zinc-600">→</span>
                      <TenantPlanBadge plan={r.requestedPlan} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-zinc-400">
                    {`${r.requestedBy.firstName} ${r.requestedBy.lastName}`.trim() || '—'}
                    <div className="text-[11px] text-zinc-600">{r.requestedBy.email}</div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-zinc-500 max-w-[260px]">{r.note ?? '—'}</td>
                  <td className="px-4 py-3 text-[11px] text-zinc-600">{new Date(r.createdAt).toLocaleString('es-MX')}</td>
                  {tab === 'PENDING' && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => resolve(r.id, 'HANDLED')}
                          disabled={busyId === r.id}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Atendida
                        </button>
                        <button
                          onClick={() => resolve(r.id, 'CANCELLED')}
                          disabled={busyId === r.id}
                          className="flex items-center gap-1 rounded-lg bg-zinc-700/40 px-3 py-1.5 text-[12px] font-semibold text-zinc-400 hover:bg-zinc-700/60 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> Cancelar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
