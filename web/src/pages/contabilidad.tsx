import { AvatarInitials } from '@/components/shared/avatar-initials'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable, type Column } from '@/components/shared/data-table'
import { Download, Plus, Loader2 } from 'lucide-react'
import { useContabilidad } from '@/hooks/core/use-contabilidad'
import type { CuentaCobrar, CuentaPagar } from '@/services/core/contabilidad-service'

const cobrarCols: Column<CuentaCobrar>[] = [
  { label: "Factura", render: r => <span className="font-mono text-xs font-bold text-primary">{r.id}</span> },
  { label: "Cliente", render: r => <div className="flex items-center gap-2"><AvatarInitials name={r.cliente} size={26} /><span className="text-[13px] font-medium text-foreground">{r.cliente}</span></div> },
  { label: "Monto", align: "right", render: r => <span className="font-bold text-foreground text-sm">{r.monto}</span> },
  { label: "Vencimiento", render: r => <span className="text-xs text-muted-foreground">{r.fechaVenc}</span> },
  { label: "Días", align: "center", render: r => <span className={`text-xs font-semibold ${r.diasVenc > 0 ? 'text-red-600' : 'text-green-600'}`}>{r.diasVenc > 0 ? `+${r.diasVenc} vencido` : `${Math.abs(r.diasVenc)}d restantes`}</span> },
  { label: "Estado", render: r => <StatusBadge status={r.estado} /> },
]

const pagarCols: Column<CuentaPagar>[] = [
  { label: "Orden", render: r => <span className="font-mono text-xs font-bold text-primary">{r.id}</span> },
  { label: "Proveedor", render: r => <div className="flex items-center gap-2"><AvatarInitials name={r.proveedor} size={26} /><span className="text-[13px] font-medium text-foreground">{r.proveedor}</span></div> },
  { label: "Monto", align: "right", render: r => <span className="font-bold text-foreground text-sm">{r.monto}</span> },
  { label: "Vencimiento", render: r => <span className="text-xs text-muted-foreground">{r.fechaVenc}</span> },
  { label: "Días", align: "center", render: r => <span className={`text-xs font-semibold ${r.diasVenc > 0 ? 'text-red-600' : 'text-blue-600'}`}>{r.diasVenc > 0 ? `+${r.diasVenc} vencido` : `${Math.abs(r.diasVenc)}d restantes`}</span> },
  { label: "Estado", render: r => <StatusBadge status={r.estado} /> },
]

export function Contabilidad() {
  const { contabilidad, loading, error, tab, setTab, loadContabilidad } = useContabilidad()
  const d = contabilidad

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando contabilidad...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-red-500">{error}</span>
          <button onClick={loadContabilidad} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-7 flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-3.5">
        {[
          { label: "Ingresos Mes", value: d.resumen.ingresos, color: "text-green-600", sub: "Ventas cobradas" },
          { label: "Egresos Mes", value: d.resumen.egresos, color: "text-red-600", sub: "Compras pagadas" },
          { label: "Utilidad Neta", value: d.resumen.utilidad, color: "text-primary", sub: "Ingreso - Egreso" },
          { label: "Margen", value: d.resumen.margen, color: "text-violet-600", sub: "Rentabilidad" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-[10px] px-4.5 py-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{s.label}</div>
            <div className={`text-2xl font-extrabold tracking-tight mb-1 ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
            {[
              { id: 'cobrar' as const, label: "Cuentas por Cobrar", count: d.cuentasPorCobrar.length },
              { id: 'pagar' as const, label: "Cuentas por Pagar", count: d.cuentasPorPagar.length },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 border-none rounded-md text-xs font-semibold cursor-pointer transition-all
                  ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'bg-transparent text-muted-foreground'}`}>
                {t.label}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold
                  ${tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-border text-muted-foreground'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-2.5">
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg bg-card text-xs cursor-pointer text-muted-foreground">
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
            <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground border-none rounded-lg text-xs font-semibold cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Nuevo Asiento
            </button>
          </div>
        </div>
        {tab === 'cobrar'
          ? <DataTable columns={cobrarCols} rows={d.cuentasPorCobrar} />
          : <DataTable columns={pagarCols} rows={d.cuentasPorPagar} />
        }
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-[13px] font-bold text-foreground mb-3.5">Alertas de Cobro</div>
          {d.cuentasPorCobrar.filter(x => x.diasVenc > 0).map((x, i, arr) => (
            <div key={i} className={`flex items-center gap-3 py-2.5 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
              <div className="flex-1">
                <div className="text-xs font-semibold text-foreground">{x.cliente} · {x.id}</div>
                <div className="text-[11px] text-muted-foreground">Vencida hace {x.diasVenc} días</div>
              </div>
              <span className="font-bold text-[13px] text-red-600">{x.monto}</span>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-[13px] font-bold text-foreground mb-3.5">Próximos Pagos</div>
          {d.cuentasPorPagar.map((x, i) => (
            <div key={i} className={`flex items-center gap-3 py-2.5 ${i < d.cuentasPorPagar.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              <div className="flex-1">
                <div className="text-xs font-semibold text-foreground">{x.proveedor} · {x.id}</div>
                <div className="text-[11px] text-muted-foreground">Vence: {x.fechaVenc}</div>
              </div>
              <span className="font-bold text-[13px] text-foreground">{x.monto}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
