import { useMemo, type Dispatch, type SetStateAction } from 'react'
import {
  Loader2, X, AlertCircle, Landmark, CheckCircle2,
  TrendingUp, ArrowUpRight, ArrowDownRight,
  Clock, Eye, ChevronRight, Banknote, CreditCard, Wifi,
} from 'lucide-react'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import { useCaja, type ApiCashSession } from '@/hooks/core/use-caja'
import {
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPE_COLORS,
  INCOME_TYPES,
  fmtMoney,
  fmtUsd,
  fmtDate,
  type SessionSummary,
  type OpenSessionInput,
  type CloseSessionInput,
} from '@/services/core/caja-service'

// ---- helpers ----

function StatusBadge({ status }: { status: 'ABIERTA' | 'CERRADA' }) {
  if (status === 'ABIERTA') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Abierta
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Cerrada
    </span>
  )
}

function DiffBadge({ diff }: { diff: number }) {
  const abs = Math.abs(diff)
  if (Math.abs(diff) < 0.01) {
    return <span className="text-[12px] font-semibold text-green-600">{fmtMoney(0)} ✓</span>
  }
  if (diff > 0) {
    return <span className="text-[12px] font-semibold text-blue-600">+{fmtMoney(abs)} (sobrante)</span>
  }
  return <span className="text-[12px] font-semibold text-red-500">-{fmtMoney(abs)} (faltante)</span>
}

// ---- Summary Panel ----

type SummaryBreakdownRow = {
  label: string
  cash: number
  cashUsd: number
  card: number
  transfer: number
  isBase?: boolean
  income?: boolean
}

function SummaryPanel({ summary }: { summary: SessionSummary }) {
  const { totals, openingAmount, openingAmountUsd, expectedCash, expectedCashUsd } = summary
  const hasUsd = openingAmountUsd > 0 || expectedCashUsd > 0 ||
    totals.sales.cashUsd > 0 || totals.cxc.cashUsd > 0 || totals.income.cashUsd > 0

  const rows: SummaryBreakdownRow[] = [
    { label: 'Fondo inicial', cash: openingAmount, cashUsd: openingAmountUsd, card: 0, transfer: 0, isBase: true },
    { label: 'Ventas', cash: totals.sales.cash, cashUsd: totals.sales.cashUsd, card: totals.sales.card, transfer: totals.sales.transfer, income: true },
    { label: 'Cobranza CxC', cash: totals.cxc.cash, cashUsd: totals.cxc.cashUsd, card: totals.cxc.card, transfer: totals.cxc.transfer, income: true },
    { label: 'Ingresos manuales', cash: totals.income.cash, cashUsd: totals.income.cashUsd, card: 0, transfer: 0, income: true },
    { label: 'Pagos proveedor', cash: totals.supplier.cash, cashUsd: totals.supplier.cashUsd, card: totals.supplier.card, transfer: totals.supplier.transfer, income: false },
    { label: 'Egresos manuales', cash: totals.expense.cash, cashUsd: totals.expense.cashUsd, card: 0, transfer: 0, income: false },
  ]

  const cols = hasUsd ? 5 : 4

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className={`grid px-4 py-2.5 bg-muted/40 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider`}
        style={{ gridTemplateColumns: `1fr${hasUsd ? ' auto auto' : ' auto'} auto auto` }}>
        <div>Concepto</div>
        <div className="text-right flex items-center justify-end gap-1"><Banknote className="w-3 h-3" /> Ef. MXN</div>
        {hasUsd && <div className="text-right flex items-center justify-end gap-1 text-amber-600"><Banknote className="w-3 h-3" /> Ef. USD</div>}
        <div className="text-right flex items-center justify-end gap-1"><CreditCard className="w-3 h-3" /> Tarjeta</div>
        <div className="text-right flex items-center justify-end gap-1"><Wifi className="w-3 h-3" /> Transfer.</div>
      </div>

      {rows.map((row, i) => {
        const isExpense = row.income === false
        const prefix = isExpense ? '−' : row.isBase ? '' : '+'
        return (
          <div key={i} className={`grid px-4 py-2.5 border-b border-border text-[12px] ${row.isBase ? 'bg-muted/20' : ''}`}
            style={{ gridTemplateColumns: `1fr${hasUsd ? ' auto auto' : ' auto'} auto auto` }}>
            <div className={`font-medium ${isExpense ? 'text-red-500' : 'text-foreground'}`}>
              {prefix} {row.label}
            </div>
            <div className={`text-right tabular-nums font-semibold min-w-[80px] ${isExpense ? 'text-red-500' : row.cash > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
              {row.cash > 0 ? `${prefix}${fmtMoney(row.cash)}` : '—'}
            </div>
            {hasUsd && (
              <div className={`text-right tabular-nums font-semibold min-w-[80px] ${isExpense ? 'text-red-500' : row.cashUsd > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {row.cashUsd > 0 ? `${prefix}${fmtUsd(row.cashUsd)}` : '—'}
              </div>
            )}
            <div className={`text-right tabular-nums font-semibold min-w-[80px] ${row.card > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
              {row.card > 0 ? fmtMoney(row.card) : '—'}
            </div>
            <div className={`text-right tabular-nums font-semibold min-w-[80px] ${row.transfer > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
              {row.transfer > 0 ? fmtMoney(row.transfer) : '—'}
            </div>
          </div>
        )
      })}

      <div className={`grid px-4 py-3 bg-primary/5 border-t-2 border-primary/20 text-[13px]`}
        style={{ gridTemplateColumns: `1fr${hasUsd ? ' auto auto' : ' auto'} auto auto` }}>
        <div className="font-bold text-foreground">Efectivo esperado</div>
        <div className="text-right font-extrabold text-primary tabular-nums min-w-[80px]">{fmtMoney(expectedCash)}</div>
        {hasUsd && <div className="text-right font-extrabold text-amber-600 tabular-nums min-w-[80px]">{fmtUsd(expectedCashUsd)}</div>}
        <div /><div />
      </div>
    </div>
  )
}

// ---- Session Detail Drawer ----

function DetailDrawer({
  session,
  open,
  loading,
  onClose,
}: {
  session: ApiCashSession | null
  open: boolean
  loading: boolean
  onClose: () => void
}) {
  if (!open || !session) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[520px] bg-card border-l border-border shadow-2xl flex flex-col h-full overflow-hidden">
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Landmark className="w-4 h-4 text-primary" />
              <span className="font-bold text-foreground">Sesión de caja</span>
              <StatusBadge status={session.status} />
            </div>
            <div className="text-[12px] text-muted-foreground">{fmtDate(session.openedAt)}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}

          {!loading && session.summary && (
            <>
              <div className="px-5 py-4 border-b border-border">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resumen de movimientos</div>
                <SummaryPanel summary={session.summary} />
              </div>

              {session.status === 'CERRADA' && session.cashCounted != null && (
                <div className="px-5 py-4 border-b border-border">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cierre</div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="border border-border rounded-lg px-2.5 py-2">
                        <div className="text-[10px] text-muted-foreground mb-0.5">Esperado MXN</div>
                        <div className="text-[13px] font-bold text-foreground tabular-nums">{fmtMoney(session.closingAmount)}</div>
                      </div>
                      <div className="border border-border rounded-lg px-2.5 py-2">
                        <div className="text-[10px] text-muted-foreground mb-0.5">Contado MXN</div>
                        <div className="text-[13px] font-bold text-foreground tabular-nums">{fmtMoney(session.cashCounted)}</div>
                      </div>
                      <div className="border border-border rounded-lg px-2.5 py-2">
                        <div className="text-[10px] text-muted-foreground mb-0.5">Diferencia MXN</div>
                        <DiffBadge diff={Number(session.difference ?? 0)} />
                      </div>
                    </div>
                    {session.cashCountedUsd != null && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-2">
                          <div className="text-[10px] text-amber-600 mb-0.5">Esperado USD</div>
                          <div className="text-[13px] font-bold text-amber-600 tabular-nums">{fmtUsd(session.summary?.expectedCashUsd ?? 0)}</div>
                        </div>
                        <div className="border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-2">
                          <div className="text-[10px] text-amber-600 mb-0.5">Contado USD</div>
                          <div className="text-[13px] font-bold text-amber-600 tabular-nums">{fmtUsd(session.cashCountedUsd)}</div>
                        </div>
                        <div className="border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-2">
                          <div className="text-[10px] text-amber-600 mb-0.5">Diferencia USD</div>
                          <span className={`text-[12px] font-semibold ${Math.abs(Number(session.differenceUsd ?? 0)) < 0.01 ? 'text-green-600' : Number(session.differenceUsd) > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                            {Math.abs(Number(session.differenceUsd ?? 0)) < 0.01 ? `${fmtUsd(0)} ✓` : Number(session.differenceUsd) > 0 ? `+${fmtUsd(Math.abs(Number(session.differenceUsd)))}` : `-${fmtUsd(Math.abs(Number(session.differenceUsd)))}`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Movement log */}
              {session.movements.length > 0 && (
                <div className="px-5 py-4">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Movimientos ({session.movements.length})
                  </div>
                  <div className="space-y-1.5">
                    {session.movements.slice(0, 50).map(m => {
                      const isIncome = (INCOME_TYPES as string[]).includes(m.type)
                      return (
                        <div key={m.id} className="flex items-center justify-between px-3 py-2 border border-border rounded-lg text-[12px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`shrink-0 ${MOVEMENT_TYPE_COLORS[m.type]}`}>
                              {isIncome ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <div className={`font-medium ${MOVEMENT_TYPE_COLORS[m.type]}`}>{MOVEMENT_TYPE_LABELS[m.type]}</div>
                              <div className="text-[10px] text-muted-foreground">{m.paymentMethod} · {fmtDate(m.createdAt)}</div>
                            </div>
                          </div>
                          <div className={`font-bold tabular-nums shrink-0 ml-2 ${isIncome ? 'text-green-600' : 'text-red-500'}`}>
                            {isIncome ? '+' : '−'}{fmtMoney(m.amount)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Open Modal ----

function OpenModal({
  visible,
  form,
  setForm,
  opening,
  openError,
  onClose,
  onOpen,
}: {
  visible: boolean
  form: OpenSessionInput
  setForm: Dispatch<SetStateAction<OpenSessionInput>>
  opening: boolean
  openError: string | null
  onClose: () => void
  onOpen: () => void
}) {
  if (!visible) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <Landmark className="w-4 h-4 text-green-500" />
            Abrir sesión de caja
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Tipo de cambio USD/MXN *</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={form.exchangeRateUsdMxn || ''}
              onChange={e => setForm(p => ({ ...p, exchangeRateUsdMxn: parseFloat(e.target.value) || 0 }))}
              placeholder="19.45"
              className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Este TC quedará fijo para toda la sesión</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Fondo inicial MXN *</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.openingAmount || ''}
                onChange={e => setForm(p => ({ ...p, openingAmount: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-amber-600 uppercase tracking-wide block mb-1.5">Fondo inicial USD</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.openingAmountUsd || ''}
                onChange={e => setForm(p => ({ ...p, openingAmountUsd: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-amber-500"
              />
            </div>
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
          {openError && (
            <div className="flex items-center gap-2 text-red-500 text-[12px] mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{openError}
            </div>
          )}
          <div className="flex justify-end gap-2.5">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-muted/50">Cancelar</button>
            <button
              onClick={onOpen}
              disabled={opening}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-[13px] font-semibold hover:bg-green-600 disabled:opacity-60"
            >
              {opening && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Abrir caja
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Close Modal ----

function CloseModal({
  visible,
  session,
  form,
  setForm,
  closing,
  closeError,
  onClose,
  onConfirm,
}: {
  visible: boolean
  session: ApiCashSession | null
  form: CloseSessionInput
  setForm: Dispatch<SetStateAction<CloseSessionInput>>
  closing: boolean
  closeError: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  if (!visible || !session) return null

  const expectedCashMxn = session.summary?.expectedCash ?? Number(session.openingAmount ?? 0)
  const expectedCashUsd = session.summary?.expectedCashUsd ?? Number(session.openingAmountUsd ?? 0)
  const diffMxn = Number(form.cashCounted) - expectedCashMxn
  const diffUsd = Number(form.cashCountedUsd ?? 0) - expectedCashUsd
  const tc = Number(session.exchangeRateUsdMxn ?? 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            Cerrar sesión de caja
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* TC indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">TC sesión: 1 USD = {fmtMoney(tc)}</span>
          </div>

          {/* MXN section */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-muted/30 border-b border-border">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Efectivo MXN</span>
            </div>
            <div className="px-3 py-3 space-y-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Esperado</span>
                <span className="font-bold tabular-nums text-foreground">{fmtMoney(expectedCashMxn)}</span>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Contado *</label>
                <input
                  type="number" min={0} step={0.01}
                  value={form.cashCounted || ''}
                  onChange={e => setForm(p => ({ ...p, cashCounted: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Diferencia</span>
                <DiffBadge diff={diffMxn} />
              </div>
            </div>
          </div>

          {/* USD section */}
          <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Efectivo USD</span>
            </div>
            <div className="px-3 py-3 space-y-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Esperado</span>
                <span className="font-bold tabular-nums text-amber-600">{fmtUsd(expectedCashUsd)}</span>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Contado</label>
                <input
                  type="number" min={0} step={0.01}
                  value={form.cashCountedUsd || ''}
                  onChange={e => setForm(p => ({ ...p, cashCountedUsd: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Diferencia</span>
                <span className={`text-[12px] font-semibold ${Math.abs(diffUsd) < 0.01 ? 'text-green-600' : diffUsd > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                  {Math.abs(diffUsd) < 0.01 ? `${fmtUsd(0)} ✓` : diffUsd > 0 ? `+${fmtUsd(Math.abs(diffUsd))} (sobrante)` : `-${fmtUsd(Math.abs(diffUsd))} (faltante)`}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Notas del cierre</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary resize-none"
            />
          </div>
        </div>
        <div className="border-t border-border px-5 py-3">
          {closeError && (
            <div className="flex items-center gap-2 text-red-500 text-[12px] mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{closeError}
            </div>
          )}
          <div className="flex justify-end gap-2.5">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-muted/50">Cancelar</button>
            <button
              onClick={onConfirm}
              disabled={closing}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {closing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirmar cierre
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Main Page ----

export function Caja() {
  const hook = useCaja()

  const columns: Column<ApiCashSession>[] = useMemo(() => [
    {
      label: 'Fecha apertura',
      render: r => <span className="text-[12px] text-foreground">{fmtDate(r.openedAt)}</span>,
    },
    {
      label: 'Estado',
      render: r => <StatusBadge status={r.status} />,
    },
    {
      label: 'Fondo',
      render: r => (
        <div>
          <span className="tabular-nums text-[12px] font-semibold text-foreground">{fmtMoney(r.openingAmount)}</span>
          {Number(r.openingAmountUsd) > 0 && <span className="ml-1.5 tabular-nums text-[11px] font-medium text-amber-600">+{fmtUsd(r.openingAmountUsd)}</span>}
        </div>
      ),
    },
    {
      label: 'Efectivo esperado',
      render: r => r.closingAmount != null
        ? <span className="tabular-nums text-[12px] font-semibold text-foreground">{fmtMoney(r.closingAmount)}</span>
        : <span className="text-[11px] text-muted-foreground">Abierta</span>,
    },
    {
      label: 'Diferencia',
      align: 'right',
      render: r => r.difference != null
        ? <DiffBadge diff={Number(r.difference)} />
        : <span className="text-[11px] text-muted-foreground">—</span>,
    },
    {
      label: 'Movimientos',
      render: r => <span className="text-[12px] text-muted-foreground">{r._count?.movements ?? 0}</span>,
    },
    {
      label: 'Cajero',
      render: r => <span className="text-[11px] text-muted-foreground">{r.openedBy?.email ?? '—'}</span>,
    },
    {
      label: '',
      render: r => (
        <button
          onClick={() => hook.handleOpenDetail(r)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        >
          <Eye className="w-3.5 h-3.5" />
          <ChevronRight className="w-3 h-3" />
        </button>
      ),
    },
  ], [hook.handleOpenDetail])

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Active session banner */}
      {hook.activeLoading ? (
        <div className="flex items-center justify-center h-16">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : hook.activeSession ? (
        <ActiveSessionBanner
          session={hook.activeSession}
          onClose={() => {
            hook.setCloseForm({ cashCounted: 0, cashCountedUsd: 0, notes: '' })
            void hook.handleOpenCloseModal()
          }}
          onViewDetail={() => hook.handleOpenDetail(hook.activeSession!)}
        />
      ) : (
        <NoSessionBanner onOpen={() => hook.setOpenModalVisible(true)} />
      )}

      {/* History table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="text-[14px] font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Historial de sesiones
          </div>
          <span className="text-[11px] text-muted-foreground">{hook.sessionsTotal} sesion{hook.sessionsTotal !== 1 ? 'es' : ''}</span>
        </div>

        {hook.historyLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <DataTable columns={columns} rows={hook.sessions} />
            {hook.sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Landmark className="w-8 h-8 mb-2 opacity-30" />
                <span className="text-[13px]">Sin sesiones registradas</span>
              </div>
            )}
            <Pagination page={hook.sessionsPage} total={hook.sessionsTotal} perPage={8} onChange={hook.setSessionsPage} />
          </>
        )}
      </div>

      {/* Modals */}
      <OpenModal
        visible={hook.openModalVisible}
        form={hook.openForm}
        setForm={hook.setOpenForm}
        opening={hook.opening}
        openError={hook.openError}
        onClose={() => hook.setOpenModalVisible(false)}
        onOpen={hook.handleOpenSession}
      />

      <CloseModal
        visible={hook.closeModalVisible}
        session={hook.activeSession}
        form={hook.closeForm}
        setForm={hook.setCloseForm}
        closing={hook.closing}
        closeError={hook.closeError}
        onClose={() => hook.setCloseModalVisible(false)}
        onConfirm={hook.handleCloseSession}
      />

      <DetailDrawer
        session={hook.detailSession}
        open={hook.detailOpen}
        loading={hook.detailLoading}
        onClose={hook.handleCloseDetail}
      />
    </div>
  )
}

// ---- Active Session Banner ----

function ActiveSessionBanner({
  session,
  onClose,
  onViewDetail,
}: {
  session: ApiCashSession
  onClose: () => void
  onViewDetail: () => void
}) {
  const expectedCash = session.summary?.expectedCash ?? Number(session.openingAmount)
  const expectedCashUsd = session.summary?.expectedCashUsd ?? Number(session.openingAmountUsd ?? 0)
  const movCount = session.summary?.movementsCount ?? session.movements?.length ?? 0
  const totals = session.summary?.totals
  const tc = Number(session.exchangeRateUsdMxn ?? 1)

  return (
    <div className="bg-card border border-green-200 dark:border-green-800/40 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <StatusBadge status="ABIERTA" />
            <span className="text-[13px] font-bold text-foreground">Sesión activa</span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              TC: {fmtMoney(tc)}/USD
            </span>
          </div>
          <div className="text-[12px] text-muted-foreground">
            Abierta {fmtDate(session.openedAt)} · {session.openedBy?.email ?? '—'}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onViewDetail}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] text-muted-foreground hover:bg-muted/50"
          >
            <Eye className="w-3.5 h-3.5" /> Ver detalle
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[12px] font-semibold hover:opacity-90"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Corte de caja
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Ef. MXN esperado', value: fmtMoney(expectedCash), icon: <Banknote className="w-4 h-4" />, color: 'text-green-600' },
          { label: 'Ef. USD esperado', value: fmtUsd(expectedCashUsd), icon: <Banknote className="w-4 h-4" />, color: 'text-amber-600' },
          { label: 'Ventas (total)', value: totals ? fmtMoney(totals.sales.total) : '—', icon: <TrendingUp className="w-4 h-4" />, color: 'text-blue-600' },
          { label: 'Movimientos', value: String(movCount), icon: <ArrowUpRight className="w-4 h-4" />, color: 'text-foreground' },
        ].map((s, i) => (
          <div key={i} className="bg-muted/30 rounded-lg px-3.5 py-3">
            <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground">{s.icon}<span className="text-[10px] font-bold uppercase tracking-wider">{s.label}</span></div>
            <div className={`text-[16px] font-extrabold tabular-nums ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NoSessionBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-4">
      <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center">
        <Landmark className="w-7 h-7 text-muted-foreground" />
      </div>
      <div className="text-center">
        <div className="text-[15px] font-semibold text-foreground mb-1">Sin sesión activa</div>
        <div className="text-[13px] text-muted-foreground">Abre una sesión para comenzar a registrar movimientos</div>
      </div>
      <button
        onClick={onOpen}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:opacity-90"
      >
        <Landmark className="w-4 h-4" />
        Abrir caja
      </button>
    </div>
  )
}
