import { useMemo } from 'react'
import { Search, ChevronRight, X, AlertCircle, Loader2 } from 'lucide-react'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import { RefreshButton } from '@/components/shared/refresh-button'
import {
  useVentas,
  ORDER_FILTER_STATUSES,
  ORDER_ORIGIN_FILTERS,
  fmtMoney,
  fmtDate,
  customerName,
  type ApiOrder,
} from '@/hooks/retail/use-ventas'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from '@/services/retail/ventas-service'

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>
      {label}
    </span>
  )
}

export function Ventas() {
  const {
    loading, error, loadOrders,
    search, setSearch,
    statusFilter, setStatusFilter,
    originFilter, setOriginFilter,
    page, setPage,
    filtered, pageData, stats,
    detailOpen, detailOrder,
    handleOpenDetail, handleCloseDetail,
    handleUpdateStatus,
    showOriginColumn,
    showOriginFilters,
  } = useVentas()

  const columns: Column<ApiOrder>[] = useMemo(() => [
    {
      label: 'Orden',
      render: r => (
        <div>
          <div className="font-mono text-xs font-semibold text-foreground">{r.orderNumber}</div>
          <div className="text-[11px] text-muted-foreground">{fmtDate(r.createdAt)}</div>
        </div>
      ),
    },
    {
      label: 'Cliente',
      render: r => (
        <span className="text-[13px] text-foreground">{customerName(r.customer)}</span>
      ),
    },
    ...(showOriginColumn ? [{
      label: 'Origen',
      render: (r: ApiOrder) => {
        const isRest = r.orderOrigin === 'RESTAURANT_COMANDA'
          || (r.orderOrigin == null && r.tableNumber != null)
        return isRest
          ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">🍽 Mesa {r.tableNumber ?? '—'}</span>
          : <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">🛒 POS</span>
      },
    }] : []),
    {
      label: 'Estado',
      render: r => (
        <StatusPill label={ORDER_STATUS_LABELS[r.status]} color={ORDER_STATUS_COLORS[r.status]} />
      ),
    },
    {
      label: 'Pago',
      render: r => (
        <StatusPill label={PAYMENT_STATUS_LABELS[r.paymentStatus]} color={PAYMENT_STATUS_COLORS[r.paymentStatus]} />
      ),
    },
    {
      label: 'Total',
      align: 'right',
      render: r => <span className="font-bold text-foreground">{fmtMoney(r.total)}</span>,
    },
    {
      label: '',
      render: r => (
        <button
          onClick={() => handleOpenDetail(r)}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      ),
    },
  ], [handleOpenDetail, showOriginColumn])

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* stats */}
      <div className="flex gap-3.5">
        {[
          { label: 'Total Ventas', value: stats.total,        color: 'text-foreground'  },
          { label: 'Facturado',    value: stats.totalRevenue,  color: 'text-green-600'   },
          { label: 'Pendientes',   value: stats.pendientes,    color: 'text-amber-600'   },
          { label: 'Canceladas',   value: stats.canceladas,    color: 'text-red-600'     },
        ].map((s, i) => (
          <div key={i} className="flex-1 bg-card border border-border rounded-[10px] px-4.5 py-3.5">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{s.label}</div>
            <div className={`text-[26px] font-extrabold tracking-tight ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* table card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border gap-3 flex-wrap">
          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {ORDER_FILTER_STATUSES.map(s => (
                <button
                  key={s.key}
                  onClick={() => { setStatusFilter(s.key); setPage(1) }}
                  className={`px-3 py-1.5 border rounded-md text-xs cursor-pointer font-medium transition-all
                    ${statusFilter === s.key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {showOriginFilters && (
              <div className="flex gap-1.5 flex-wrap">
                {ORDER_ORIGIN_FILTERS.map(o => (
                  <button
                    key={o.key}
                    onClick={() => { setOriginFilter(o.key); setPage(1) }}
                    className={`px-3 py-1.5 border rounded-md text-xs cursor-pointer font-medium transition-all
                      ${originFilter === o.key
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton loading={loading} onClick={loadOrders} />
            <div className="flex gap-2 bg-muted rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar venta…"
                className="border-none bg-transparent outline-none text-xs text-foreground w-[160px]"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <AlertCircle className="w-7 h-7 text-red-500" />
            <span className="text-sm text-red-500">{error}</span>
            <button onClick={loadOrders} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer">
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <DataTable columns={columns} rows={pageData} />
            <Pagination page={page} total={filtered.length} perPage={8} onChange={setPage} />
          </>
        )}
      </div>

      {/* detail drawer */}
      {detailOpen && detailOrder && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={handleCloseDetail} />
          <div className="w-[420px] bg-card border-l border-border h-full overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <div className="font-mono text-sm font-bold text-foreground">{detailOrder.orderNumber}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(detailOrder.createdAt)}</div>
              </div>
              <button onClick={handleCloseDetail} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5">
              <div className="flex gap-2 flex-wrap">
                <StatusPill label={ORDER_STATUS_LABELS[detailOrder.status]} color={ORDER_STATUS_COLORS[detailOrder.status]} />
                <StatusPill label={PAYMENT_STATUS_LABELS[detailOrder.paymentStatus]} color={PAYMENT_STATUS_COLORS[detailOrder.paymentStatus]} />
                {(detailOrder.orderOrigin === 'RESTAURANT_COMANDA' || (detailOrder.orderOrigin == null && detailOrder.tableNumber != null)) && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">🍽 Restaurante</span>
                )}
              </div>

              {(detailOrder.orderOrigin === 'RESTAURANT_COMANDA' || detailOrder.tableNumber) && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3.5 py-2.5 flex flex-col gap-1">
                  <div className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">Info de mesa</div>
                  {detailOrder.tableNumber && (
                    <div className="text-sm text-foreground">Mesa: <span className="font-semibold">{detailOrder.tableNumber}</span></div>
                  )}
                  {detailOrder.employeeNumber && (
                    <div className="text-sm text-foreground">Mesero: <span className="font-semibold">{detailOrder.employeeNumber}</span></div>
                  )}
                </div>
              )}

              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cliente</div>
                <div className="text-sm text-foreground">{customerName(detailOrder.customer)}</div>
                {detailOrder.customer && (
                  <div className="text-xs text-muted-foreground">{detailOrder.customer.email}</div>
                )}
              </div>

              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Productos</div>
                <div className="flex flex-col gap-1.5">
                  {detailOrder.items.map(item => (
                    <div key={item.id} className="flex justify-between items-start text-sm">
                      <div>
                        <span className="text-foreground">{item.name}</span>
                        <span className="text-muted-foreground text-xs ml-1.5">×{item.quantity}</span>
                      </div>
                      <span className="text-foreground font-medium">{fmtMoney(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-3 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>{fmtMoney(detailOrder.subtotal)}</span>
                </div>
                {Number(detailOrder.discount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuento</span><span>-{fmtMoney(detailOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-foreground text-base">
                  <span>Total</span><span>{fmtMoney(detailOrder.total)}</span>
                </div>
              </div>

              {detailOrder.payments.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Pagos</div>
                  {detailOrder.payments.map(p => (
                    <div key={p.id} className="flex justify-between text-sm py-1">
                      <span className="text-muted-foreground">{p.paymentMethod}</span>
                      <span className="text-foreground font-medium">{fmtMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {detailOrder.notes && (
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Notas</div>
                  <p className="text-xs text-muted-foreground">{detailOrder.notes}</p>
                </div>
              )}

              {detailOrder.status !== 'CANCELLED' && detailOrder.status !== 'DELIVERED' && (
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Cambiar estado</div>
                  <div className="flex gap-2 flex-wrap">
                    {(['CONFIRMED', 'PROCESSING', 'DELIVERED', 'CANCELLED'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => handleUpdateStatus(detailOrder.id, s)}
                        className="px-3 py-1.5 border border-border rounded-lg text-xs cursor-pointer hover:bg-muted transition-colors"
                      >
                        {ORDER_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
