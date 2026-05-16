import { useMemo } from 'react'
import { Search, ChevronRight, X, AlertCircle, Loader2 } from 'lucide-react'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import {
  useCxC,
  CXC_FILTER_STATUSES,
  fmtDate,
  cxcCustomerName,
  type ApiCxC,
} from '@/hooks/core/use-cxc'
import {
  CXC_STATUS_LABELS,
  CXC_STATUS_COLORS,
  fmtMoney,
} from '@/services/core/cxc-service'

const PAYMENT_METHOD_OPTIONS = ['CASH', 'TRANSFER', 'CARD', 'CHEQUE']

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>
      {label}
    </span>
  )
}

export function Cxc() {
  const {
    loading, error, stats, loadRecords,
    search, setSearch,
    statusFilter, setStatusFilter,
    page, setPage,
    filtered, pageData,
    detailOpen, detailCxC,
    handleOpenDetail, handleCloseDetail,
    payOpen, payForm, setPayForm, paying, payError, payTargetBalance,
    handleOpenPay, handleClosePay, handleRegisterPayment,
  } = useCxC()

  const columns: Column<ApiCxC>[] = useMemo(() => [
    {
      label: 'Orden',
      render: r => (
        <div>
          <div className="font-mono text-xs font-semibold text-foreground">{r.order.orderNumber}</div>
          <div className="text-[11px] text-muted-foreground">{fmtDate(r.createdAt)}</div>
        </div>
      ),
    },
    {
      label: 'Cliente',
      render: r => <span className="text-[13px] text-foreground">{cxcCustomerName(r.customer)}</span>,
    },
    {
      label: 'Vence',
      render: r => {
        const overdue = r.status !== 'PAGADO' && new Date(r.dueDate) < new Date()
        return (
          <span className={`text-xs ${overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
            {fmtDate(r.dueDate)}
          </span>
        )
      },
    },
    {
      label: 'Estado',
      render: r => <StatusPill label={CXC_STATUS_LABELS[r.status]} color={CXC_STATUS_COLORS[r.status]} />,
    },
    {
      label: 'Saldo',
      align: 'right',
      render: r => (
        <div className="text-right">
          <div className="font-bold text-foreground">{fmtMoney(r.balance)}</div>
          <div className="text-[11px] text-muted-foreground">de {fmtMoney(r.totalAmount)}</div>
        </div>
      ),
    },
    {
      label: '',
      render: r => (
        <div className="flex gap-1">
          {r.status !== 'PAGADO' && (
            <button
              onClick={() => handleOpenPay(r)}
              className="px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-[11px] font-semibold cursor-pointer"
            >
              Abonar
            </button>
          )}
          <button
            onClick={() => handleOpenDetail(r)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      ),
    },
  ], [handleOpenPay, handleOpenDetail])

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* stats */}
      {stats && (
        <div className="flex gap-3.5">
          {[
            { label: 'Pendiente', value: fmtMoney(stats.pendiente.balance), sub: `${stats.pendiente.count} cuentas`, color: 'text-amber-600' },
            { label: 'Parcial',   value: fmtMoney(stats.parcial.balance),   sub: `${stats.parcial.count} cuentas`,   color: 'text-blue-600'  },
            { label: 'Vencido',   value: fmtMoney(stats.vencido.balance),   sub: `${stats.vencido.count} cuentas`,   color: 'text-red-600'   },
            { label: 'Cobrado',   value: fmtMoney(stats.pagado.total),      sub: `${stats.pagado.count} cuentas`,    color: 'text-green-600' },
          ].map((s, i) => (
            <div key={i} className="flex-1 bg-card border border-border rounded-[10px] px-4.5 py-3.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{s.label}</div>
              <div className={`text-[22px] font-extrabold tracking-tight ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* table card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {CXC_FILTER_STATUSES.map(s => (
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
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar cliente u orden…"
              className="border-none bg-transparent outline-none text-xs text-foreground w-[180px]"
            />
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
            <button onClick={loadRecords} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer">
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
      {detailOpen && detailCxC && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={handleCloseDetail} />
          <div className="w-[420px] bg-card border-l border-border h-full overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <div className="font-mono text-sm font-bold text-foreground">{detailCxC.order.orderNumber}</div>
                <div className="text-xs text-muted-foreground">{cxcCustomerName(detailCxC.customer)}</div>
              </div>
              <button onClick={handleCloseDetail} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5">
              <div className="flex gap-2 items-center justify-between">
                <StatusPill label={CXC_STATUS_LABELS[detailCxC.status]} color={CXC_STATUS_COLORS[detailCxC.status]} />
                {detailCxC.status !== 'PAGADO' && (
                  <button
                    onClick={() => handleOpenPay(detailCxC)}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Registrar pago
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total</div>
                  <div className="text-lg font-bold text-foreground">{fmtMoney(detailCxC.totalAmount)}</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Saldo pendiente</div>
                  <div className={`text-lg font-bold ${Number(detailCxC.balance) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {fmtMoney(detailCxC.balance)}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Fecha de vencimiento</div>
                <div className={`text-sm font-semibold ${detailCxC.status !== 'PAGADO' && new Date(detailCxC.dueDate) < new Date() ? 'text-red-600' : 'text-foreground'}`}>
                  {fmtDate(detailCxC.dueDate)}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Historial de pagos</div>
                {detailCxC.payments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin pagos registrados</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detailCxC.payments.map(p => (
                      <div key={p.id} className="flex justify-between items-start border border-border rounded-lg px-3 py-2">
                        <div>
                          <div className="text-xs font-semibold text-foreground">{p.paymentMethod}</div>
                          <div className="text-[11px] text-muted-foreground">{fmtDate(p.paymentDate)}</div>
                          {p.reference && <div className="text-[11px] text-muted-foreground">Ref: {p.reference}</div>}
                        </div>
                        <div className="text-sm font-bold text-green-600">{fmtMoney(p.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* payment modal */}
      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClosePay} />
          <div className="relative bg-card border border-border rounded-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">Registrar pago</h2>
              <button onClick={handleClosePay} className="p-1 rounded-lg hover:bg-muted cursor-pointer">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground">
              Saldo pendiente: <span className="font-bold text-foreground">{fmtMoney(payTargetBalance)}</span>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Monto *</label>
                <input
                  type="number"
                  min={0.01}
                  max={payTargetBalance}
                  step={0.01}
                  value={payForm.amount}
                  onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Método de pago *</label>
                <select
                  value={payForm.paymentMethod}
                  onChange={e => setPayForm(p => ({ ...p, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                >
                  {PAYMENT_METHOD_OPTIONS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Referencia</label>
                <input
                  value={payForm.reference}
                  onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Notas</label>
                <input
                  value={payForm.notes}
                  onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                  placeholder="Opcional"
                />
              </div>
            </div>

            {payError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {payError}
              </div>
            )}

            <div className="flex gap-2.5 justify-end pt-1">
              <button
                onClick={handleClosePay}
                className="px-4 py-2 border border-border rounded-lg text-[13px] cursor-pointer text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegisterPayment}
                disabled={paying}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {paying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Registrar pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
