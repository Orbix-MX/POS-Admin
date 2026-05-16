import { useERPStore } from '@/store/erp-store'
import { KPICard } from '@/components/shared/kpi-card'
import { Download } from 'lucide-react'
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'

export function Reportes() {
  const { dashboard, inventario } = useERPStore()

  const reportCards = [
    { titulo: "Reporte de Ventas", desc: "Análisis completo de ventas por período, cliente y producto.", icono: "📊", color: "#6366f1", badge: "Disponible" },
    { titulo: "Reporte de Compras", desc: "Órdenes de compra, gastos por proveedor y tendencias.", icono: "🛒", color: "#0ea5e9", badge: "Disponible" },
    { titulo: "Inventario Valorizado", desc: "Valorización de stock actual a precio de costo y venta.", icono: "📦", color: "#10b981", badge: "Disponible" },
    { titulo: "Estado de Resultados", desc: "P&L mensual: ingresos, egresos, utilidad bruta y neta.", icono: "💰", color: "#f59e0b", badge: "Disponible" },
    { titulo: "Cartera de Clientes", desc: "Ranking de clientes por volumen, frecuencia y valor.", icono: "👥", color: "#8b5cf6", badge: "Disponible" },
    { titulo: "Análisis de Proveedores", desc: "Evaluación de proveedores por plazo, precio y cumplimiento.", icono: "🚚", color: "#ec4899", badge: "Próximamente" },
  ]

  const donutData = [
    { name: "Stock OK", value: inventario.filter(x => x.estado === "OK").length, color: "#16a34a" },
    { name: "Stock Bajo", value: inventario.filter(x => x.estado === "Bajo").length, color: "#d97706" },
    { name: "Agotado", value: inventario.filter(x => x.estado === "Agotado").length, color: "#dc2626" },
  ]

  return (
    <div className="p-7 flex flex-col gap-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3.5">
        {[
          { label: "Ventas Anuales", value: "$547,400", change: "+18%", up: true },
          { label: "Compras Anuales", value: "$295,700", change: "+11%", up: true },
          { label: "Margen Promedio", value: "34%", change: "+2pp", up: true },
          { label: "Rotación Stock", value: "4.2x", change: "+0.3x", up: true },
        ].map((k, i) => <KPICard key={i} {...k} />)}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-[13px] font-bold text-foreground mb-4">Tendencia Anual — Ventas vs Compras</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dashboard.ventasMensuales}>
              <defs>
                <linearGradient id="colorV2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorC2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}K`} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#6366f1" fill="url(#colorV2)" strokeWidth={2} />
              <Area type="monotone" dataKey="compras" name="Compras" stroke="#f59e0b" fill="url(#colorC2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-[13px] font-bold text-foreground mb-4">Estado del Inventario</div>
          <div className="flex items-center gap-5">
            <PieChart width={110} height={110}>
              <Pie data={donutData} cx={55} cy={55} innerRadius={32} outerRadius={48} paddingAngle={2} dataKey="value">
                {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
            <div className="flex flex-col gap-2.5">
              {donutData.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-xs text-muted-foreground">{s.name}</span>
                  <span className="text-xs font-bold text-foreground ml-auto">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="text-[11px] text-muted-foreground mb-1">Valor total inventario</div>
            <div className="text-lg font-extrabold text-foreground">$248,400.00</div>
          </div>
        </div>
      </div>

      {/* Report cards */}
      <div>
        <div className="text-[13px] font-bold text-foreground mb-3.5">Reportes Disponibles</div>
        <div className="grid grid-cols-3 gap-3.5">
          {reportCards.map((r, i) => (
            <div key={i} className={`bg-card border border-border rounded-xl p-5 transition-all ${r.badge === 'Disponible' ? 'cursor-pointer hover:shadow-md' : 'opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-lg" style={{ background: r.color + "20" }}>
                  {r.icono}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.badge === 'Disponible' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                  {r.badge}
                </span>
              </div>
              <div className="text-[13px] font-bold text-foreground mb-1.5">{r.titulo}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{r.desc}</div>
              {r.badge === "Disponible" && (
                <button className="mt-3.5 flex items-center gap-1.5 text-xs font-semibold bg-transparent border-none cursor-pointer p-0" style={{ color: r.color }}>
                  <Download className="w-3.5 h-3.5" /> Descargar PDF
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
