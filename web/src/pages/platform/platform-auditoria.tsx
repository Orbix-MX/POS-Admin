import { useState, useEffect } from 'react'
import { Activity, Loader2 } from 'lucide-react'
import { platformApi } from '@/lib/platform-api-client'
import type { PlatformAuditLog, ListResponse } from '@/services/platform/platform-tenants-service'

export function PlatformAuditoria() {
  const [logs, setLogs] = useState<PlatformAuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    platformApi.get<ListResponse<PlatformAuditLog>>('/platform/tenants/audit-global', { params: { page, limit: 30 } })
      .then(r => { setLogs(r.data.data); setTotal(r.data.meta.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Auditoría de Plataforma</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{total} registros totales</p>
      </div>

      <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-600 text-[13px]">
            <Activity className="w-4 h-4" /> Sin registros de auditoría
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700/50">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-zinc-500 uppercase">Acción</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase">Tenant</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase">Realizado por</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase">Notas</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-zinc-700/20 hover:bg-zinc-700/10">
                  <td className="px-5 py-3 text-[12px] font-mono text-indigo-400">{log.action}</td>
                  <td className="px-4 py-3 text-[12px] text-zinc-500 font-mono">{log.tenantId ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-zinc-400">
                    {log.platformUser ? `${log.platformUser.firstName} ${log.platformUser.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-zinc-500">{log.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-[11px] text-zinc-600">
                    {new Date(log.createdAt).toLocaleString('es-MX')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
