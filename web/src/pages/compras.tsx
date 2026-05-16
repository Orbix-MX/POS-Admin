import { useMemo, type Dispatch, type SetStateAction } from 'react'
import {
  Search, Plus, Loader2, X, ChevronRight, Package, Truck,
  CheckCircle2, Clock, XCircle, Send, ReceiptText, Eye,
  AlertCircle, Calendar, FileText, Building2, CreditCard,
} from 'lucide-react'
import { AvatarInitials } from '@/components/shared/avatar-initials'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import {
  useCompras,
  FILTER_STATUSES,
  type ApiPurchaseOrder,
  type SupplierPaymentMethod,
  type ReceiveForm,
} from '@/hooks/retail/use-compras'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  fmtMoney,
  fmtDate,
  calcReceived,
  type PurchaseOrderStatus,
} from '@/services/retail/compras-service'
import {
  PAYABLE_STATUS_LABELS,
  PAYABLE_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  type RegisterPaymentInput,
} from '@/services/core/payables-service'
import { PurchaseForm } from '@/components/purchases/PurchaseForm'

type PaymentModalFormState = RegisterPaymentInput & { _method: SupplierPaymentMethod }

// ---- Status lifecycle ----

const STATUS_STEPS: PurchaseOrderStatus[] = ['BORRADOR', 'ENVIADA', 'PARCIAL', 'COMPLETADA']

const STATUS_ICONS: Record<PurchaseOrderStatus, typeof Clock> = {
  BORRADOR:   FileText,
  ENVIADA:    Truck,
  PARCIAL:    Package,
  COMPLETADA: CheckCircle2,
  CANCELADA:  XCircle,
}

function StatusBadgePO({ status }: { status: PurchaseOrderStatus }) {
  const Icon = STATUS_ICONS[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${STATUS_COLORS[status]}`}>
      <Icon className="w-3 h-3" />
      {STATUS_LABELS[status]}
    </span>
  )
}

function LifecycleBar({ status }: { status: PurchaseOrderStatus }) {
  if (status === 'CANCELADA') {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-red-500">
        <XCircle className="w-3.5 h-3.5" />
        <span>Orden cancelada</span>
      </div>
    )
  }
  const current = STATUS_STEPS.indexOf(status)
  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((s, i) => {
        const done = i <= current
        const Icon = STATUS_ICONS[s]
        return (
          <div key={s} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
              done
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}>
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{STATUS_LABELS[s]}</span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`w-4 h-px ${done && i < current ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---- Progress bar for received items ----

function ReceiptProgress({ received, ordered }: { received: number; ordered: number }) {
  const pct = ordered === 0 ? 0 : Math.min(100, Math.round((received / ordered) * 100))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-border'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground tabular-nums whitespace-nowrap">
        {received}/{ordered}
      </span>
    </div>
  )
}

// ---- Order Detail Side Drawer ----

function DetailDrawer({
  order,
  open,
  loading,
  onClose,
  onSend,
  onCancel,
  onReceive,
  onEdit,
  onPayment,
}: {
  order: ApiPurchaseOrder | null
  open: boolean
  loading: boolean
  onClose: () => void
  onSend: (id: string) => void
  onCancel: (id: string) => void
  onReceive: (order: ApiPurchaseOrder) => void
  onEdit: (order: ApiPurchaseOrder) => void
  onPayment: (accountPayableId: string, balance: number) => void
}) {
  if (!open || !order) return null

  const receivedMap = calcReceived(order)
  const canSend = order.status === 'BORRADOR'
  const canEdit = order.status === 'BORRADOR'
  const canReceive = order.status === 'ENVIADA' || order.status === 'PARCIAL'
  const canCancel = order.status !== 'COMPLETADA' && order.status !== 'CANCELADA'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-card border-l border-border shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="font-mono text-[13px] font-bold text-foreground">{order.orderNumber}</span>
              <StatusBadgePO status={order.status} />
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Building2 className="w-3 h-3" />
              <span>{order.supplier.name}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}

          {!loading && (
            <>
              {/* Lifecycle */}
              <div className="px-5 py-4 border-b border-border">
                <LifecycleBar status={order.status} />
              </div>

              {/* Meta info */}
              <div className="px-5 py-4 border-b border-border grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Fecha de orden</div>
                  <div className="text-[13px] text-foreground flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    {fmtDate(order.orderDate)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Entrega esperada</div>
                  <div className={`text-[13px] flex items-center gap-1.5 ${order.expectedDate ? 'text-foreground' : 'text-muted-foreground'}`}>
                    <Truck className="w-3 h-3 text-muted-foreground" />
                    {fmtDate(order.expectedDate)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total</div>
                  <div className="text-[16px] font-bold text-foreground tabular-nums">{fmtMoney(order.total)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Productos</div>
                  <div className="text-[13px] text-foreground">{order.items.length} línea{order.items.length !== 1 ? 's' : ''}</div>
                </div>
              </div>

              {/* Items */}
              <div className="px-5 py-4 border-b border-border">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Artículos</div>
                <div className="space-y-3">
                  {order.items.map(item => {
                    const recv = receivedMap[item.productId] ?? 0
                    return (
                      <div key={item.id} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                          <Package className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-[13px] font-medium text-foreground truncate">{item.product.name}</span>
                            <span className="text-[12px] font-semibold text-foreground tabular-nums shrink-0">{fmtMoney(item.total)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px] text-muted-foreground">
                            <span className="font-mono">{item.product.sku}</span>
                            <span>{item.quantityOrdered} × {fmtMoney(item.unitCost)}</span>
                          </div>
                          <ReceiptProgress received={recv} ordered={item.quantityOrdered} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              {order.notes && (
                <div className="px-5 py-3 border-b border-border">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Notas</div>
                  <p className="text-[12px] text-foreground leading-relaxed">{order.notes}</p>
                </div>
              )}

              {/* Receipts */}
              {(order.receipts?.length ?? 0) > 0 && (
                <div className="px-5 py-4 border-b border-border">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Recepciones ({order.receipts!.length})
                  </div>
                  <div className="space-y-3">
                    {order.receipts!.map(receipt => (
                      <div key={receipt.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                          <div className="flex items-center gap-1.5 text-[12px]">
                            <ReceiptText className="w-3.5 h-3.5 text-primary" />
                            <span className="font-medium text-foreground">{fmtDate(receipt.receivedDate)}</span>
                          </div>
                          {receipt.receivedBy && (
                            <span className="text-[11px] text-muted-foreground">
                              {receipt.receivedBy.firstName} {receipt.receivedBy.lastName}
                            </span>
                          )}
                        </div>
                        <div className="divide-y divide-border">
                          {receipt.items.map(ri => (
                            <div key={ri.id} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                              <span className="text-foreground truncate">{ri.product.name}</span>
                              <span className="font-semibold text-foreground tabular-nums shrink-0 ml-2">+{ri.quantityReceived}</span>
                            </div>
                          ))}
                        </div>
                        {receipt.notes && (
                          <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-t border-border bg-muted/20">
                            {receipt.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cuenta por pagar (CxP) */}
              {order.accountPayable && (
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Cuenta por Pagar
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${PAYABLE_STATUS_COLORS[order.accountPayable.status]}`}>
                      {PAYABLE_STATUS_LABELS[order.accountPayable.status]}
                    </span>
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                      <div className="px-3 py-2.5">
                        <div className="text-[10px] text-muted-foreground mb-0.5">Total facturado</div>
                        <div className="text-[14px] font-bold text-foreground tabular-nums">{fmtMoney(order.accountPayable.totalAmount)}</div>
                      </div>
                      <div className="px-3 py-2.5">
                        <div className="text-[10px] text-muted-foreground mb-0.5">Saldo pendiente</div>
                        <div className={`text-[14px] font-bold tabular-nums ${Number(order.accountPayable.balance) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          {fmtMoney(order.accountPayable.balance)}
                        </div>
                      </div>
                    </div>

                    {/* Payment history */}
                    {order.accountPayable.payments.length > 0 && (
                      <div className="divide-y divide-border">
                        {order.accountPayable.payments.map(pmt => (
                          <div key={pmt.id} className="flex items-center justify-between px-3 py-1.5 text-[11px]">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CreditCard className="w-3 h-3" />
                              <span>{fmtDate(pmt.paymentDate)}</span>
                              <span className="text-foreground font-medium">{PAYMENT_METHOD_LABELS[pmt.paymentMethod]}</span>
                            </div>
                            <span className="font-semibold text-green-600 tabular-nums">-{fmtMoney(pmt.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {order.accountPayable.status !== 'PAGADO' && (
                      <div className="px-3 py-2.5 border-t border-border bg-muted/20">
                        <button
                          onClick={() => onPayment(order.accountPayable!.id, Number(order.accountPayable!.balance))}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[12px] font-semibold hover:opacity-90 transition-opacity w-full justify-center"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Registrar pago
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions footer */}
        <div className="shrink-0 border-t border-border px-5 py-3 flex items-center gap-2 flex-wrap">
          {canEdit && (
            <button
              onClick={() => { onClose(); onEdit(order) }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Editar
            </button>
          )}
          {canSend && (
            <button
              onClick={() => onSend(order.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-[12px] font-medium hover:bg-blue-600 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar orden
            </button>
          )}
          {canReceive && (
            <button
              onClick={() => onReceive(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-[12px] font-medium hover:bg-green-600 transition-colors"
            >
              <Package className="w-3.5 h-3.5" />
              Recibir mercancía
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onCancel(order.id)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-[12px] font-medium hover:bg-red-50 dark:border-red-800/40 dark:hover:bg-red-900/20 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Payment Modal ----

function PaymentModal({
  open,
  balance,
  form,
  setForm,
  paying,
  paymentError,
  onClose,
  onPay,
}: {
  open: boolean
  balance: number
  form: PaymentModalFormState
  setForm: Dispatch<SetStateAction<PaymentModalFormState>>
  paying: boolean
  paymentError: string | null
  onClose: () => void
  onPay: () => void
}) {
  if (!open) return null

  const METHODS: Array<{ value: SupplierPaymentMethod; label: string }> = [
    { value: 'CASH', label: 'Efectivo' },
    { value: 'TRANSFER', label: 'Transferencia' },
    { value: 'CARD', label: 'Tarjeta' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Registrar pago a proveedor
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Saldo pendiente: <span className="font-semibold text-foreground">{fmtMoney(balance)}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Monto *</label>
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
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Método de pago *</label>
            <select
              value={form.paymentMethod}
              onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value as SupplierPaymentMethod }))}
              className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
            >
              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Referencia</label>
            <input
              type="text"
              value={form.reference ?? ''}
              onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
              placeholder="Nº de transferencia, cheque, etc."
              className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Notas</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary resize-none"
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
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg bg-card text-[13px] text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onPay}
              disabled={paying || !form.amount || form.amount <= 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
            >
              {paying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <CreditCard className="w-3.5 h-3.5" />
              Registrar pago
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Receive Modal ----

function ReceiveModal({
  open,
  form,
  setForm,
  receiving,
  receiveError,
  onClose,
  onReceive,
}: {
  open: boolean
  form: ReceiveForm
  setForm: Dispatch<SetStateAction<ReceiveForm>>
  receiving: boolean
  receiveError: string | null
  onClose: () => void
  onReceive: () => void
}) {
  if (!open) return null

  const setQty = (productId: string, val: number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(i =>
        i.productId === productId
          ? { ...i, quantityReceived: Math.max(0, Math.min(val, i.quantityOrdered - i.alreadyReceived)) }
          : i
      ),
    }))
  }

  const setAll = () => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(i => ({ ...i, quantityReceived: i.quantityOrdered - i.alreadyReceived })),
    }))
  }

  const total = form.items.reduce((s, i) => s + i.quantityReceived, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-green-500" />
              Recibir mercancía
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Ingresa las cantidades recibidas por producto</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Items */}
        <div className="px-5 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Productos</span>
            <button onClick={setAll} className="text-[11px] text-primary hover:underline font-medium">
              Recibir todo pendiente
            </button>
          </div>

          {form.items.map(item => {
            const remaining = item.quantityOrdered - item.alreadyReceived
            const pct = item.quantityOrdered > 0
              ? ((item.alreadyReceived + item.quantityReceived) / item.quantityOrdered) * 100
              : 0
            return (
              <div key={item.productId} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground truncate">{item.productName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Pedido: {item.quantityOrdered} · Recibido: {item.alreadyReceived} · Pendiente: <span className="font-semibold text-foreground">{remaining}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      value={item.quantityReceived}
                      onChange={e => setQty(item.productId, parseInt(e.target.value) || 0)}
                      disabled={remaining === 0}
                      className="w-20 text-center px-2 py-1.5 border border-border rounded-lg text-[13px] font-semibold text-foreground bg-card outline-none focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-border'}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Notes */}
        <div className="px-5 pb-4">
          <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Notas de recepción</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="Observaciones, daños, discrepancias…"
            className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary transition-colors resize-none"
          />
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3">
          {receiveError && (
            <div className="flex items-center gap-2 text-red-500 text-[12px] mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {receiveError}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-muted-foreground">
              Total a recibir: <span className="font-semibold text-foreground">{total} unidade{total !== 1 ? 's' : ''}</span>
            </span>
            <div className="flex gap-2.5">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-lg bg-card text-[13px] text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={onReceive}
                disabled={receiving || total === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-[13px] font-semibold hover:bg-green-600 disabled:opacity-60 transition-colors"
              >
                {receiving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmar recepción
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Main page ----

export function Compras() {
  const hook = useCompras()

  const columns: Column<ApiPurchaseOrder>[] = useMemo(() => [
    {
      label: 'Orden',
      render: r => (
        <span className="font-mono text-[12px] font-bold text-muted-foreground tracking-tight">{r.orderNumber}</span>
      ),
    },
    {
      label: 'Proveedor',
      render: r => (
        <div className="flex items-center gap-2">
          <AvatarInitials name={r.supplier.name} size={28} />
          <div>
            <div className="text-[13px] font-semibold text-foreground leading-tight">{r.supplier.name}</div>
            {r.supplier.email && (
              <div className="text-[11px] text-muted-foreground">{r.supplier.email}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      label: 'Estado',
      render: r => <StatusBadgePO status={r.status} />,
    },
    {
      label: 'Artículos',
      render: r => (
        <div className="space-y-1 min-w-[120px]">
          {r.items.slice(0, 2).map(item => {
            const recv = (r.receipts ?? []).reduce((s, rec) => {
              const ri = rec.items.find(x => x.productId === item.productId)
              return s + (ri?.quantityReceived ?? 0)
            }, 0)
            return (
              <div key={item.id}>
                <ReceiptProgress received={recv} ordered={item.quantityOrdered} />
              </div>
            )
          })}
          {r.items.length > 2 && (
            <div className="text-[10px] text-muted-foreground">+{r.items.length - 2} más</div>
          )}
        </div>
      ),
    },
    {
      label: 'Total',
      align: 'right',
      render: r => (
        <span className="font-bold text-foreground tabular-nums text-[13px]">{fmtMoney(r.total)}</span>
      ),
    },
    {
      label: 'F. Orden',
      render: r => <span className="text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(r.orderDate)}</span>,
    },
    {
      label: 'Entrega',
      render: r => (
        <span className={`text-[12px] whitespace-nowrap ${r.expectedDate ? 'text-foreground' : 'text-muted-foreground'}`}>
          {fmtDate(r.expectedDate)}
        </span>
      ),
    },
    {
      label: '',
      render: r => (
        <button
          onClick={() => hook.handleOpenDetail(r)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ver</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      ),
    },
  ], [hook.handleOpenDetail])

  if (hook.loading) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando compras…</span>
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
            onClick={hook.loadOrders}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          {
            label: 'Gasto Total',
            value: hook.stats.totalGasto,
            sub: 'Órdenes completadas',
            color: 'text-primary',
            icon: <CheckCircle2 className="w-4 h-4" />,
            accent: 'bg-primary/8',
          },
          {
            label: 'En Tránsito',
            value: hook.stats.enviadas,
            sub: 'Enviadas y parciales',
            color: 'text-blue-600',
            icon: <Truck className="w-4 h-4" />,
            accent: 'bg-blue-50 dark:bg-blue-900/20',
          },
          {
            label: 'Completadas',
            value: hook.stats.completadas,
            sub: 'Recibidas al 100%',
            color: 'text-green-600',
            icon: <CheckCircle2 className="w-4 h-4" />,
            accent: 'bg-green-50 dark:bg-green-900/20',
          },
          {
            label: 'Borradores',
            value: hook.stats.borradores,
            sub: 'Pendientes de enviar',
            color: 'text-amber-600',
            icon: <FileText className="w-4 h-4" />,
            accent: 'bg-amber-50 dark:bg-amber-900/20',
          },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-[10px] px-4 py-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</span>
              <div className={`p-1.5 rounded-lg ${s.accent} ${s.color}`}>{s.icon}</div>
            </div>
            <div className={`font-extrabold tracking-tight ${s.color} ${typeof s.value === 'string' && s.value.length > 8 ? 'text-lg' : 'text-[28px]'}`}>
              {s.value}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Table panel */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border gap-3 flex-wrap">
          {/* Status filters */}
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_STATUSES.map(s => (
              <button
                key={s.key}
                onClick={() => { hook.setStatusFilter(s.key); hook.setPage(1) }}
                className={`px-3 py-1.5 border rounded-md text-xs font-medium transition-all cursor-pointer ${
                  hook.statusFilter === s.key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Search + new */}
          <div className="flex gap-2.5 items-center">
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={hook.search}
                onChange={e => { hook.setSearch(e.target.value); hook.setPage(1) }}
                placeholder="Buscar orden o proveedor…"
                className="border-none bg-transparent outline-none text-xs text-foreground w-[180px]"
              />
            </div>
            <button
              onClick={hook.handleOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground border-none rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva Orden
            </button>
          </div>
        </div>

        <DataTable columns={columns} rows={hook.pageData} />

        {hook.filtered.length === 0 && !hook.loading && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="w-10 h-10 mb-3 opacity-30" />
            <span className="text-[13px]">No hay órdenes de compra</span>
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

      {/* Modals */}
      <PurchaseForm
        open={hook.createOpen}
        onClose={hook.handleCloseCreate}
        editing={hook.editingOrder}
        orderForm={hook.orderForm}
        setOrderForm={hook.setOrderForm}
        saving={hook.saving}
        formError={hook.formError}
        onSave={hook.handleSaveOrder}
      />

      <DetailDrawer
        order={hook.detailOrder}
        open={hook.detailOpen}
        loading={hook.detailLoading}
        onClose={hook.handleCloseDetail}
        onSend={hook.handleSend}
        onCancel={hook.handleCancel}
        onReceive={order => { hook.handleCloseDetail(); hook.handleOpenReceive(order) }}
        onEdit={hook.handleOpenEdit}
        onPayment={hook.handleOpenPayment}
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

      <ReceiveModal
        open={hook.receiveOpen}
        form={hook.receiveForm}
        setForm={hook.setReceiveForm}
        receiving={hook.receiving}
        receiveError={hook.receiveError}
        onClose={hook.handleCloseReceive}
        onReceive={hook.handleReceive}
      />
    </div>
  )
}
