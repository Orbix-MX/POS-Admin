import { useERPStore } from '@/store/erp-store'
import { KPICard } from '@/components/shared/kpi-card'
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export function Dashboard() {
  const { dashboard } = useERPStore()
  const d = dashboard
  const activityIcon: Record<string, string> = { venta: "💰", compra: "🛒", stock: "📦", pago: "✅" }

  return (
    <div className="p-7 flex flex-col gap-6">
      {/* KPIs */}
      <div className="flex gap-4">
        {d.kpis.map((k, i) => (
          <KPICard key={i} label={k.label} value={k.value} change={k.change} up={k.up} />
        ))}
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-[1fr_300px] gap-4">
        {/* Area Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[13px] font-bold text-foreground">Ventas vs Compras 2026</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Comparativa mensual</div>
            </div>
            <select className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-card text-foreground cursor-pointer">
              <option>Anual 2026</option>
              <option>Trimestral</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={d.ventasMensuales}>
              <defs>
                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCompras" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}K`} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(value) => [`$${Number(value).toLocaleString()}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#6366f1" fill="url(#colorVentas)" strokeWidth={2} />
              <Area type="monotone" dataKey="compras" name="Compras" stroke="#f59e0b" fill="url(#colorCompras)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Actividad reciente */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
          <div className="text-[13px] font-bold text-foreground mb-4">Actividad Reciente</div>
          <div className="flex flex-col gap-3.5 flex-1">
            {d.actividadReciente.map((a, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm shrink-0">
                  {activityIcon[a.tipo] || "•"}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-foreground leading-snug">{a.desc}</div>
                  <div className="flex justify-between mt-0.5">
                    {a.monto && <span className="text-[11px] font-bold text-primary">{a.monto}</span>}
                    <span className="text-[10px] text-muted-foreground">{a.tiempo}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Productos */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="text-[13px] font-bold text-foreground mb-4">Productos Más Vendidos</div>
        <div className="flex flex-col">
          {d.topProductos.map((p, i) => {
            const maxV = d.topProductos[0].vendidos
            const pct = (p.vendidos / maxV) * 100
            return (
              <div key={i} className={`flex items-center gap-3.5 py-2.5 ${i < d.topProductos.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="w-[22px] h-[22px] rounded-md bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-foreground mb-1.5">{p.nombre}</div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-600" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-foreground">{p.ingreso}</div>
                  <div className="text-[10px] text-muted-foreground">{p.vendidos} uds.</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
