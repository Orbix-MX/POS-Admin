import { useMemo } from 'react'
import { ChevronRight, X, AlertCircle, Loader2, MessageCircle } from 'lucide-react'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import { RefreshButton } from '@/components/shared/refresh-button'
import {
  useStoreOrders,
  STORE_ORDER_FILTER_STATUSES,
  type ApiStoreOrder,
  type StoreOrderStatus,
} from '@/hooks/core/use-store-orders'
import {
  STORE_ORDER_STATUS_LABELS,
  STORE_ORDER_STATUS_COLORS,
  STORE_ORDER_NEXT_STATUSES,
  fmtMoney,
  fmtDate,
} from '@/services/core/store-orders-service'

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>
      {label}
    </span>
  )
}

const PER_PAGE = 10

export function PedidosWhatsapp() {
  const {
    orders, total, loading, error, load,
    statusFilter, handleChangeStatusFilter,
    page, setPage,
    detailOpen, detailOrder, updating,
    handleOpenDetail, handleCloseDetail, handleUpdateStatus,
  } = useStoreOrders()

  const columns: Column<ApiStoreOrder>[] = useMemo(() => [
    {
      label: 'Pedido',
      render: r => (
        <div>
          <div className="font-mono text-xs font-semibold text-foreground">{r.orderNumber}</div>
          <div className="text-[11px] text-muted-foreground">{fmtDate(r.createdAt)}</div>
        </div>
      ),
    },
    {
      label: 'Teléfono',
      render: r => <span className="text-[13px] text-foreground">{r.phone}</span>,
    },
    {
      label: 'Artículos',
      render: r => <span className="text-[13px] text-muted-foreground">{r._count?.items ?? '—'}</span>,
    },
    {
      label: 'Estado',
      render: r => <StatusPill label={STORE_ORDER_STATUS_LABELS[r.status]} color={STORE_ORDER_STATUS_COLORS[r.status]} />,
    },
    {
      label: 'Subtotal',
      align: 'right',
      render: r => <span className="font-bold text-foreground">{fmtMoney(r.subtotal)}</span>,
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
  ], [handleOpenDetail])

  const nextStatuses: StoreOrderStatus[] = detailOrder ? STORE_ORDER_NEXT_STATUSES[detailOrder.status] : []

  return (
    <div className="p-7 flex flex-col gap-5">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-600" />
            <span className="text-[13px] font-semibold text-foreground">Pedidos enviados por WhatsApp</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton loading={loading} onClick={load} />
          </div>
        </div>

        <div className="px-4 py-3 border-b border-border">
          <div className="flex gap-1.5 flex-wrap">
            {STORE_ORDER_FILTER_STATUSES.map(s => (
              <button
                key={s.key}
                onClick={() => handleChangeStatusFilter(s.key)}
                className={`px-3 py-1.5 border rounded-md text-xs cursor-pointer font-medium transition-all
                  ${statusFilter === s.key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}
              >
                {s.label}
              </button>
            ))}
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
            <button onClick={load} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer">
              Reintentar
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <MessageCircle className="w-7 h-7" />
            <span className="text-sm">Todavía no hay pedidos por WhatsApp</span>
          </div>
        ) : (
          <>
            <DataTable columns={columns} rows={orders} />
            <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />
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
              <StatusPill label={STORE_ORDER_STATUS_LABELS[detailOrder.status]} color={STORE_ORDER_STATUS_COLORS[detailOrder.status]} />

              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Teléfono de contacto</div>
                <a href={`https://wa.me/${detailOrder.phone}`} target="_blank" rel="noreferrer" className="text-sm text-green-700 font-medium hover:underline">
                  {detailOrder.phone}
                </a>
              </div>

              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Productos</div>
                <div className="flex flex-col gap-1.5">
                  {(detailOrder.items ?? []).map(item => (
                    <div key={item.id} className="flex justify-between items-start text-sm">
                      <div>
                        <span className="text-foreground">{item.name}</span>
                        <span className="text-muted-foreground text-xs ml-1.5">×{item.quantity}</span>
                      </div>
                      <span className="text-foreground font-medium">{fmtMoney(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-3 flex justify-between font-bold text-foreground text-base">
                <span>Subtotal</span><span>{fmtMoney(detailOrder.subtotal)}</span>
              </div>

              {detailOrder.status === 'DELIVERED' && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  Entregado el {fmtDate(detailOrder.deliveredAt)} — stock descontado.
                </p>
              )}

              {nextStatuses.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Cambiar estado</div>
                  <div className="flex gap-2 flex-wrap">
                    {nextStatuses.map(s => (
                      <button
                        key={s}
                        disabled={updating}
                        onClick={() => handleUpdateStatus(detailOrder.id, s)}
                        className="px-3 py-1.5 border border-border rounded-lg text-xs cursor-pointer hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {STORE_ORDER_STATUS_LABELS[s]}
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
