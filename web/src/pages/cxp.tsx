import { useMemo } from 'react'
import {
  Search, Loader2, X, Eye, ChevronRight,
  CreditCard, AlertCircle, Building2, FileText,
  CheckCircle2, Clock, Banknote,
} from 'lucide-react'
import { AvatarInitials } from '@/components/shared/avatar-initials'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import {
  useCxp,
  STATUS_FILTERS,
  type ApiAccountPayable,
  type SupplierPaymentMethod,
  type RegisterPaymentInput,
} from '@/hooks/core/use-cxp'
import {
  PAYABLE_STATUS_LABELS,
  PAYABLE_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  type AccountPayableStatus,
} from '@/services/core/payables-service'
import { fmtMoney, fmtDate } from '@/services/retail/compras-service'

function PayableStatusBadge({ status }: { status: AccountPayableStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${PAYABLE_STATUS_COLORS[status]}`}>
      {PAYABLE_STATUS_LABELS[status]}
    </span>
  )
}

function DetailDrawer({
  payable, open, loading, onClose, onPayment,
}: {
  payable: ApiAccountPayable | null
  open: boolean
  loading: boolean
  onClose: () => void
  onPayment: (payable: ApiAccountPayable) => void
}) {
  if (!open || !payable) return null

  const total  = parseFloat(String(payable.totalAmount))
  const balance = parseFloat(String(payable.balance))
  const paid   = total - balance
  const pct    = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[460px] bg-card border-l border-border shadow-2xl flex flex-col h-full overflow-hidden">

        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="font-mono text-[13px] font-bold text-foreground">
                {payable.purchaseOrder?.orderNumber ?? payable.purchaseOrderId.slice(0, 8)}
              </span>
              <PayableStatusBadge status={payable.status} />
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Building2 className="w-3 h-3" />
              <span>{payable.supplier?.name ?? '—'}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}

          {!loading && (
            <>
              {/* Amounts */}
              <div className="px-5 py-4 border-b border-border">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total</div>
                    <div className="text-[14px] font-bold text-foreground tabular-nums">{fmtMoney(total)}</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pagado</div>
                    <div className="text-[14px] font-bold text-green-600 tabular-nums">{fmtMoney(paid)}</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Saldo</div>
                    <div className={`text-[14px] font-bold tabular-nums ${balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {fmtMoney(balance)}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Progreso de pago</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${balance === 0 ? 'bg-green-500' : paid > 0 ? 'bg-amber-400' : 'bg-border'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="px-5 py-4 border-b border-border grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Orden de compra</div>
                  <div className="text-[13px] font-mono font-bold text-primary">
                    {payable.purchaseOrder?.orderNumber ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Fecha de creación</div>
                  <div className="text-[13px] text-foreground">{fmtDate(payable.createdAt)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Proveedor</div>
                  <div className="text-[13px] text-foreground">{payable.supplier?.name ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Email proveedor</div>
                  <div className="text-[12px] text-muted-foreground truncate">{payable.supplier?.email ?? '—'}</div>
                </div>
              </div>

              {/* Payment history */}
              <div className="px-5 py-4">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Historial de pagos{payable.payments.length > 0 ? ` (${payable.payments.length})` : ''}
                </div>

                {payable.payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Clock className="w-8 h-8 mb-2 opacity-30" />
                    <span className="text-[12px]">Sin pagos registrados</span>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                    {payable.payments.map(pmt => (
                      <div key={pmt.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className={`p-1.5 rounded-lg ${pmt.paymentMethod === 'CASH' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                          <CreditCard className={`w-3.5 h-3.5 ${pmt.paymentMethod === 'CASH' ? 'text-green-600' : 'text-blue-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-foreground">
                            {PAYMENT_METHOD_LABELS[pmt.paymentMethod]}
                            {pmt.reference && (
                              <span className="text-muted-foreground font-normal"> · {pmt.reference}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{fmtDate(pmt.paymentDate)}</div>
                        </div>
                        <span className="font-bold text-[13px] text-green-600 tabular-nums shrink-0">
                          -{fmtMoney(pmt.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {payable.status !== 'PAGADO' && (
                  <button
                    onClick={() => onPayment(payable)}
                    className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:opacity-90 transition-opacity w-full justify-center"
                  >
                    <CreditCard className="w-4 h-4" />
                    Registrar pago
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PaymentModal({
  open, balance, form, setForm, paying, paymentError, onClose, onPay,
}: {
  open: boolean
  balance: number
  form: RegisterPaymentInput & { _method: SupplierPaymentMethod }
  setForm: (fn: (prev: RegisterPaymentInput & { _method: SupplierPaymentMethod }) => RegisterPaymentInput & { _method: SupplierPaymentMethod }) => void
  paying: boolean
  paymentError: string | null
  onClose: () => void
  onPay: () => void
}) {
  if (!open) return null

  const METHODS: Array<{ value: SupplierPaymentMethod; label: string }> = [
    { value: 'CASH',     label: 'Efectivo'       },
    { value: 'TRANSFER', label: 'Transferencia'  },
    { value: 'CARD',     label: 'Tarjeta'        },
  ]

  const isCash = form.paymentMethod === 'CASH'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Registrar pago a proveedor
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Saldo pendiente: <span className="font-semibold text-foreground">{fmtMoney(balance)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
              Monto *
            </label>
            <input
              type="number"
              min={0.01}
              max={balance}
              step={0.01}
              value={form.amount || ''}
              onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
              placeholder={`Máx. ${fmtMoney(balance)}`}
              className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
            />
            <div className="flex gap-2 mt-1.5">
              {([0.25, 0.5, 1] as const).map(frac => (
                <button
                  key={frac}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, amount: parseFloat((balance * frac).toFixed(2)) }))}
                  className="flex-1 py-1 border border-border rounded text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  {frac === 1 ? 'Saldo total' : `${frac * 100}%`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
              Método de pago *
            </label>
            <select
              value={form.paymentMethod}
              onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value as SupplierPaymentMethod }))}
              className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
            >
              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {isCash && (
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                <Banknote className="w-3 h-3" />
                Este pago afecta el saldo de caja
              </div>
            )}
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
              Referencia
            </label>
            <input
              type="text"
              value={form.reference ?? ''}
              onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
              placeholder="Nº de transferencia, cheque, etc."
              className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="border-t border-border px-5 py-3">
          {paymentError && (
            <div className="flex items-center gap-2 text-red-500 text-[12px] mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {paymentError}
            </div>
          )}
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg bg-card text-[13px] text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onPay}
              disabled={paying || !form.amount || form.amount <= 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
            >
              {paying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <CreditCard className="w-3.5 h-3.5" />
              Confirmar pago
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Cxp() {
  const hook = useCxp()

  const columns: Column<ApiAccountPayable>[] = useMemo(() => [
    {
      label: 'Proveedor',
      render: r => (
        <div className="flex items-center gap-2">
          <AvatarInitials name={r.supplier?.name ?? '?'} size={28} />
          <div>
            <div className="text-[13px] font-semibold text-foreground leading-tight">{r.supplier?.name ?? '—'}</div>
            {r.supplier?.email && (
              <div className="text-[11px] text-muted-foreground">{r.supplier.email}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      label: 'Orden',
      render: r => (
        <span className="font-mono text-[12px] font-bold text-muted-foreground tracking-tight">
          {r.purchaseOrder?.orderNumber ?? r.purchaseOrderId.slice(0, 8)}
        </span>
      ),
    },
    {
      label: 'Total',
      align: 'right',
      render: r => (
        <span className="font-bold text-foreground tabular-nums text-[13px]">{fmtMoney(r.totalAmount)}</span>
      ),
    },
    {
      label: 'Saldo',
      align: 'right',
      render: r => {
        const bal = parseFloat(String(r.balance))
        return (
          <span className={`font-bold tabular-nums text-[13px] ${bal > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {fmtMoney(bal)}
          </span>
        )
      },
    },
    {
      label: 'Estado',
      render: r => <PayableStatusBadge status={r.status} />,
    },
    {
      label: 'Fecha',
      render: r => (
        <span className="text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(r.createdAt)}</span>
      ),
    },
    {
      label: '',
      render: r => (
        <div className="flex items-center gap-1.5">
          {r.status !== 'PAGADO' && (
            <button
              onClick={e => { e.stopPropagation(); hook.handleOpenPayment(r) }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <CreditCard className="w-3 h-3" />
              Pagar
            </button>
          )}
          <button
            onClick={() => hook.handleOpenDetail(r)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      ),
    },
  ], [hook.handleOpenDetail, hook.handleOpenPayment])

  if (hook.loading) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando cuentas por pagar…</span>
        </div>
      </div>
    )
  }

  if (hook.error) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <span className="text-sm text-red-500">{hook.error}</span>
          <button
            onClick={hook.loadPayables}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const s = hook.stats

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          {
            label: 'Pendiente',
            value: s ? fmtMoney(s.pendiente.balance) : '—',
            sub: `${s?.pendiente.count ?? 0} cuenta${s?.pendiente.count !== 1 ? 's' : ''}`,
            color: 'text-amber-600',
            accent: 'bg-amber-50 dark:bg-amber-900/20',
            icon: <Clock className="w-4 h-4" />,
          },
          {
            label: 'Pago parcial',
            value: s ? fmtMoney(s.parcial.balance) : '—',
            sub: `${s?.parcial.count ?? 0} cuenta${s?.parcial.count !== 1 ? 's' : ''}`,
            color: 'text-blue-600',
            accent: 'bg-blue-50 dark:bg-blue-900/20',
            icon: <CreditCard className="w-4 h-4" />,
          },
          {
            label: 'Total pendiente',
            value: s ? fmtMoney(s.pendiente.balance + s.parcial.balance) : '—',
            sub: 'Saldo consolidado',
            color: 'text-primary',
            accent: 'bg-primary/8',
            icon: <FileText className="w-4 h-4" />,
          },
          {
            label: 'Pagadas',
            value: `${s?.pagado.count ?? 0}`,
            sub: s ? fmtMoney(s.pagado.total) : '—',
            color: 'text-green-600',
            accent: 'bg-green-50 dark:bg-green-900/20',
            icon: <CheckCircle2 className="w-4 h-4" />,
          },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-[10px] px-4 py-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
              <div className={`p-1.5 rounded-lg ${stat.accent} ${stat.color}`}>{stat.icon}</div>
            </div>
            <div className={`font-extrabold tracking-tight ${stat.color} ${stat.value.length > 8 ? 'text-lg' : 'text-[28px]'}`}>
              {stat.value}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Table panel */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(sf => (
              <button
                key={sf.key}
                onClick={() => { hook.setStatusFilter(sf.key); hook.setPage(1) }}
                className={`px-3 py-1.5 border rounded-md text-xs font-medium transition-all cursor-pointer ${
                  hook.statusFilter === sf.key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={hook.search}
              onChange={e => { hook.setSearch(e.target.value); hook.setPage(1) }}
              placeholder="Buscar proveedor u orden…"
              className="border-none bg-transparent outline-none text-xs text-foreground w-[180px]"
            />
          </div>
        </div>

        <DataTable columns={columns} rows={hook.pageData} />

        {hook.filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <span className="text-[13px]">No hay cuentas por pagar</span>
            {(hook.search || hook.statusFilter !== 'Todos') && (
              <button
                onClick={() => { hook.setSearch(''); hook.setStatusFilter('Todos'); hook.setPage(1) }}
                className="mt-2 text-[12px] text-primary hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        <Pagination page={hook.page} total={hook.filtered.length} perPage={8} onChange={hook.setPage} />
      </div>

      <DetailDrawer
        payable={hook.detailPayable}
        open={hook.detailOpen}
        loading={hook.detailLoading}
        onClose={hook.handleCloseDetail}
        onPayment={p => { hook.handleCloseDetail(); hook.handleOpenPayment(p) }}
      />

      <PaymentModal
        open={hook.paymentOpen}
        balance={hook.paymentBalance}
        form={hook.paymentForm}
        setForm={hook.setPaymentForm}
        paying={hook.paying}
        paymentError={hook.paymentError}
        onClose={hook.handleClosePayment}
        onPay={hook.handlePay}
      />
    </div>
  )
}
