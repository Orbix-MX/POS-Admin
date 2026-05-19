import { useState, useEffect, useCallback } from 'react'
import {
  Wallet, TrendingUp, ArrowUpCircle, ArrowDownCircle, Users, Pause,
  X, Plus, Check, Loader2, RotateCcw, AlertCircle, Clock,
  ChevronDown, Trash2, PlayCircle, PanelLeftOpen, PanelLeftClose,
  ShieldAlert, Eye, EyeOff,
} from 'lucide-react'
import {
  fetchActiveCashSession, openCashSession, closeCashSession, closeSessionWithAuth,
  verifyCloseAuth, createManualMovement,
  fmtMoney, fmtDate, MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_COLORS, INCOME_TYPES,
  type ApiCashSession,
} from '@/services/core/caja-service'
import {
  getOrders, ORDER_STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS,
  ORDER_STATUS_LABELS, customerName, fmtMoney as fmtOrderMoney, type ApiOrder,
} from '@/services/retail/ventas-service'
import {
  fetchClientes, createCliente, type CreateClienteInput,
} from '@/services/core/clientes-service'
import type { Cliente, CartItem, HoldSale } from '@/hooks/retail/use-pos'
import { useAuthStore } from '@/store/auth-store'

// ─── Shared ───────────────────────────────────────────────────────────────────

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-card">
      <span className="text-[13px] font-extrabold text-foreground">{title}</span>
      <button onClick={onClose} className="p-1 rounded hover:bg-muted cursor-pointer">
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  )
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
      <Icon className="w-7 h-7 opacity-30" />
      <span className="text-xs text-center px-4">{text}</span>
    </div>
  )
}

// ─── Admin Auth Modal ─────────────────────────────────────────────────────────

interface AdminAuthModalProps {
  onVerified: (creds: { email: string; password: string }) => void
  onCancel: () => void
}

function AdminAuthModal({ onVerified, onCancel }: AdminAuthModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!email.trim() || !password) { setError('Email y contraseña requeridos'); return }
    setSubmitting(true); setError(null)
    try {
      await verifyCloseAuth({ authEmail: email.trim(), authPassword: password })
      onVerified({ email: email.trim(), password })
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Autorización fallida')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-400 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <div className="text-[13px] font-extrabold text-foreground">Autorización requerida</div>
            <div className="text-[11px] text-muted-foreground">Ingresa credenciales de un administrador para cerrar caja</div>
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Email del administrador</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@tienda.com"
            autoFocus
            className="w-full mt-1 px-3 py-2 border border-border rounded-xl text-[12px] bg-muted outline-none focus:border-primary focus:bg-card"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Contraseña</label>
          <div className="relative mt-1">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              placeholder="••••••••"
              className="w-full px-3 py-2 pr-9 border border-border rounded-xl text-[12px] bg-muted outline-none focus:border-primary focus:bg-card"
            />
            <button
              onClick={() => setShowPass(p => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground border-none bg-transparent cursor-pointer"
            >
              {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        {error && (
          <div className="flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{error}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel}
            className="flex-1 py-2 border border-border rounded-xl text-[12px] font-semibold cursor-pointer text-muted-foreground hover:bg-muted">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-[12px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
            {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Verificando…</> : <><Check className="w-3.5 h-3.5" />Autorizar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Caja Panel ───────────────────────────────────────────────────────────────

function CajaPanel({ onClose, onSessionChange }: { onClose: () => void; onSessionChange?: () => void }) {
  const permissions = useAuthStore(s => s.permissions)
  const userRole = useAuthStore(s => s.user?.role)
  const canClose = userRole === 'SUPER_ADMIN' || permissions.includes('pos.cash:close')

  const [session, setSession] = useState<ApiCashSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [showOpenForm, setShowOpenForm] = useState(false)
  const [showCloseForm, setShowCloseForm] = useState(false)
  const [showAdminAuth, setShowAdminAuth] = useState(false)
  const [authorizedCreds, setAuthorizedCreds] = useState<{ email: string; password: string } | null>(null)
  const [openForm, setOpenForm] = useState({ exchangeRateUsdMxn: '', openingAmount: '', openingAmountUsd: '', notes: '' })
  const [closeForm, setCloseForm] = useState({ cashCounted: '', cashCountedUsd: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSession = useCallback(async () => {
    setLoading(true)
    try { setSession(await fetchActiveCashSession()) }
    catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSession() }, [loadSession])

  const handleOpen = async () => {
    const rate = parseFloat(openForm.exchangeRateUsdMxn)
    const amount = parseFloat(openForm.openingAmount) || 0
    if (!rate || rate <= 0) { setError('Tipo de cambio requerido'); return }
    setSubmitting(true); setError(null)
    try {
      const s = await openCashSession({
        exchangeRateUsdMxn: rate,
        openingAmount: amount,
        openingAmountUsd: parseFloat(openForm.openingAmountUsd) || undefined,
        notes: openForm.notes || undefined,
      })
      setSession(s)
      setShowOpenForm(false)
      setOpenForm({ exchangeRateUsdMxn: '', openingAmount: '', openingAmountUsd: '', notes: '' })
      onSessionChange?.()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al abrir caja')
    } finally { setSubmitting(false) }
  }

  const handleClose = async () => {
    if (!session) return
    const counted = parseFloat(closeForm.cashCounted) || 0
    const countedUsd = parseFloat(closeForm.cashCountedUsd) || 0
    setSubmitting(true); setError(null)
    try {
      if (authorizedCreds) {
        await closeSessionWithAuth(session.id, {
          cashCounted: counted, cashCountedUsd: countedUsd, notes: closeForm.notes || undefined,
          authEmail: authorizedCreds.email, authPassword: authorizedCreds.password,
        })
      } else {
        await closeCashSession(session.id, { cashCounted: counted, cashCountedUsd: countedUsd, notes: closeForm.notes || undefined })
      }
      setSession(null); setShowCloseForm(false); setAuthorizedCreds(null)
      setCloseForm({ cashCounted: '', cashCountedUsd: '', notes: '' })
      onSessionChange?.()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al cerrar caja')
    } finally { setSubmitting(false) }
  }

  const summary = session?.summary
  const recentMovements = session?.movements?.slice(0, 8) ?? []

  return (
    <div className="flex flex-col h-full">
      {showAdminAuth && (
        <AdminAuthModal
          onVerified={creds => { setAuthorizedCreds(creds); setShowAdminAuth(false) }}
          onCancel={() => setShowAdminAuth(false)}
        />
      )}
      <PanelHeader title="Estado de Caja" onClose={onClose} />
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Cargando…</span>
          </div>
        ) : session ? (
          <>
            {/* Status */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs font-bold text-green-600">CAJA ABIERTA</span>
                </div>
                <button onClick={loadSession} className="p-1 rounded hover:bg-muted cursor-pointer">
                  <RotateCcw className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Apertura: {fmtDate(session.openedAt)} · TC: {fmtMoney(Number(session.exchangeRateUsdMxn))}/USD
              </div>
              {session.openedBy && (
                <div className="text-[10px] text-muted-foreground mt-0.5">Cajero: {session.openedBy.email}</div>
              )}
            </div>

            {/* Summary */}
            {summary && (
              <div className="px-4 py-3 border-b border-border space-y-1.5">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Resumen del turno</div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Ventas</span>
                  <span className="font-semibold text-green-600">{fmtMoney(summary.totals.sales.total)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Ingresos manuales</span>
                  <span className="font-semibold text-emerald-600">{fmtMoney(summary.totals.income.total)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Egresos manuales</span>
                  <span className="font-semibold text-orange-500">{fmtMoney(summary.totals.expense.total)}</span>
                </div>
                <div className="h-px bg-border my-1" />
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-foreground">Efectivo esperado</span>
                  <span className="text-foreground">{fmtMoney(summary.expectedCash)}</span>
                </div>
                {summary.expectedCashUsd > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Efectivo USD esperado</span>
                    <span className="text-amber-600">${summary.expectedCashUsd.toFixed(2)} USD</span>
                  </div>
                )}
              </div>
            )}

            {/* Recent movements */}
            {recentMovements.length > 0 && (
              <div className="px-4 py-3 border-b border-border">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Últimos movimientos</div>
                <div className="space-y-1.5">
                  {recentMovements.map(m => (
                    <div key={m.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-[10px] font-semibold ${MOVEMENT_TYPE_COLORS[m.type as keyof typeof MOVEMENT_TYPE_COLORS] ?? 'text-muted-foreground'}`}>
                          {MOVEMENT_TYPE_LABELS[m.type as keyof typeof MOVEMENT_TYPE_LABELS] ?? m.type}
                        </span>
                        {m.notes && <span className="text-[9px] text-muted-foreground truncate max-w-[90px]">{m.notes}</span>}
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${(INCOME_TYPES as readonly string[]).includes(m.type) ? 'text-green-600' : 'text-red-500'}`}>
                        {(INCOME_TYPES as readonly string[]).includes(m.type) ? '+' : '-'}{fmtMoney(Number(m.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close form */}
            {showCloseForm ? (
              <div className="px-4 py-3 space-y-2.5 border-b border-border bg-red-50/40">
                <div className="text-[11px] font-bold text-red-600">Cerrar caja</div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold">Efectivo MXN contado</label>
                  <input type="number" min={0} step="0.01" value={closeForm.cashCounted}
                    onChange={e => setCloseForm(p => ({ ...p, cashCounted: e.target.value }))}
                    placeholder="0.00"
                    className="w-full mt-1 px-2.5 py-1.5 border border-border rounded-lg text-[12px] bg-card outline-none focus:border-red-400" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold">Efectivo USD contado</label>
                  <input type="number" min={0} step="0.01" value={closeForm.cashCountedUsd}
                    onChange={e => setCloseForm(p => ({ ...p, cashCountedUsd: e.target.value }))}
                    placeholder="0.00"
                    className="w-full mt-1 px-2.5 py-1.5 border border-amber-300 rounded-lg text-[12px] bg-card outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold">Notas (opcional)</label>
                  <input value={closeForm.notes}
                    onChange={e => setCloseForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Observaciones…"
                    className="w-full mt-1 px-2.5 py-1.5 border border-border rounded-lg text-[12px] bg-card outline-none focus:border-primary" />
                </div>
                {authorizedCreds && (
                  <div className="flex items-center gap-1.5 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    Autorizado por <span className="font-semibold">{authorizedCreds.email}</span>
                  </div>
                )}
                {error && <div className="flex items-start gap-1.5 text-[11px] text-red-600"><AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />{error}</div>}
                <div className="flex gap-2">
                  <button onClick={() => { setShowCloseForm(false); setAuthorizedCreds(null); setError(null) }}
                    className="flex-1 py-2 border border-border rounded-lg text-[11px] font-semibold cursor-pointer text-muted-foreground hover:bg-muted">
                    Cancelar
                  </button>
                  <button onClick={handleClose} disabled={submitting || (!canClose && !authorizedCreds)}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Confirmar cierre
                  </button>
                </div>
                {!canClose && !authorizedCreds && (
                  <button
                    onClick={() => { setError(null); setShowAdminAuth(true) }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 border border-amber-300 text-amber-700 rounded-lg text-[11px] font-semibold cursor-pointer hover:bg-amber-50 transition-colors"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" /> Solicitar autorización de admin
                  </button>
                )}
              </div>
            ) : (
              <div className="px-4 py-3">
                <button onClick={() => { setShowCloseForm(true); setError(null) }}
                  className="w-full py-2 border border-red-300 text-red-600 rounded-lg text-[12px] font-bold cursor-pointer hover:bg-red-50 transition-colors">
                  Cerrar caja
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <EmptyState icon={Wallet} text="No hay sesión de caja abierta" />
            {/* Open form */}
            {showOpenForm ? (
              <div className="px-4 py-3 space-y-2.5 border-t border-border bg-green-50/40">
                <div className="text-[11px] font-bold text-green-700">Abrir caja</div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold">Tipo de cambio USD/MXN *</label>
                  <input type="number" min={0.01} step="0.01" value={openForm.exchangeRateUsdMxn}
                    onChange={e => setOpenForm(p => ({ ...p, exchangeRateUsdMxn: e.target.value }))}
                    placeholder="17.50"
                    className="w-full mt-1 px-2.5 py-1.5 border border-border rounded-lg text-[12px] bg-card outline-none focus:border-primary" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-semibold">Fondo MXN</label>
                    <input type="number" min={0} step="0.01" value={openForm.openingAmount}
                      onChange={e => setOpenForm(p => ({ ...p, openingAmount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full mt-1 px-2.5 py-1.5 border border-border rounded-lg text-[12px] bg-card outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-amber-600">Fondo USD</label>
                    <input type="number" min={0} step="0.01" value={openForm.openingAmountUsd}
                      onChange={e => setOpenForm(p => ({ ...p, openingAmountUsd: e.target.value }))}
                      placeholder="0.00"
                      className="w-full mt-1 px-2.5 py-1.5 border border-amber-300 rounded-lg text-[12px] bg-card outline-none focus:border-amber-500" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold">Notas (opcional)</label>
                  <input value={openForm.notes}
                    onChange={e => setOpenForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Turno matutino…"
                    className="w-full mt-1 px-2.5 py-1.5 border border-border rounded-lg text-[12px] bg-card outline-none focus:border-primary" />
                </div>
                {error && <div className="flex items-start gap-1.5 text-[11px] text-red-600"><AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />{error}</div>}
                <div className="flex gap-2">
                  <button onClick={() => { setShowOpenForm(false); setError(null) }}
                    className="flex-1 py-2 border border-border rounded-lg text-[11px] font-semibold cursor-pointer text-muted-foreground hover:bg-muted">
                    Cancelar
                  </button>
                  <button onClick={handleOpen} disabled={submitting}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Abrir caja
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3">
                <button onClick={() => { setShowOpenForm(true); setError(null) }}
                  className="w-full py-2 bg-green-600 text-white rounded-lg text-[12px] font-bold cursor-pointer hover:bg-green-700 transition-colors">
                  Abrir caja
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Mis Ventas Panel ─────────────────────────────────────────────────────────

function MisVentasPanel({ onClose }: { onClose: () => void }) {
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

  useEffect(() => {
    setLoading(true)
    getOrders({ limit: 100, page: 1 })
      .then(res => {
        const today = res.data.filter(o => new Date(o.createdAt) >= todayStart)
        setOrders(today)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const todayTotal = orders.reduce((s, o) => s + Number(o.total), 0)
  const paidCount = orders.filter(o => o.paymentStatus === 'PAID').length
  const pendingCount = orders.filter(o => o.paymentStatus === 'PENDING').length

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Ventas del día" onClose={onClose} />
      {loading ? (
        <div className="flex items-center justify-center h-20 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Cargando…</span>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="px-4 py-3 border-b border-border bg-muted/30 shrink-0">
            <div className="text-lg font-extrabold text-foreground">{fmtOrderMoney(todayTotal)}</div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
              <span>{orders.length} ventas</span>
              {paidCount > 0 && <span className="text-green-600">{paidCount} pagadas</span>}
              {pendingCount > 0 && <span className="text-amber-600">{pendingCount} pendientes</span>}
            </div>
          </div>
          {/* Orders list */}
          <div className="flex-1 overflow-y-auto">
            {orders.length === 0 ? (
              <EmptyState icon={TrendingUp} text="Sin ventas registradas hoy" />
            ) : (
              orders.map(order => (
                <div key={order.id} className="border-b border-border">
                  <button
                    onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer text-left bg-transparent border-none"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-foreground">{order.orderNumber}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{customerName(order.customer)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-bold text-foreground">{fmtOrderMoney(Number(order.total))}</div>
                      <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block ${PAYMENT_STATUS_COLORS[order.paymentStatus]}`}>
                        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </div>
                    </div>
                    <ChevronDown className={`w-3 h-3 text-muted-foreground shrink-0 transition-transform ${expanded === order.id ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded === order.id && (
                    <div className="px-4 pb-3 bg-muted/20 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ORDER_STATUS_COLORS[order.status]}`}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {order.items.length > 0 && (
                        <div className="space-y-0.5 mt-1.5">
                          {order.items.map(item => (
                            <div key={item.id} className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground truncate max-w-[140px]">{item.name} ×{item.quantity}</span>
                              <span className="text-foreground font-semibold shrink-0">{fmtOrderMoney(Number(item.total))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {order.payments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {order.payments.map(p => (
                            <span key={p.id} className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              {p.paymentMethod} {fmtOrderMoney(Number(p.amount))}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Cash Movement Panel ──────────────────────────────────────────────────────

function CashMovementPanel({
  type, onClose,
}: {
  type: 'INCOME' | 'EXPENSE'
  onClose: () => void
}) {
  const isIncome = type === 'INCOME'
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'MXN' | 'USD'>('MXN')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Ingresa un monto válido'); return }
    if (!reason.trim()) { setError('El motivo es requerido'); return }
    setSubmitting(true); setError(null)
    try {
      await createManualMovement({ type, amount: amt, currency, reason: reason.trim(), notes: notes.trim() || undefined })
      setSuccess(true)
      setAmount(''); setReason(''); setNotes('')
      setTimeout(() => setSuccess(false), 2500)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al registrar movimiento')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        title={isIncome ? 'Ingreso de efectivo' : 'Retiro de efectivo'}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isIncome ? 'bg-emerald-50 border border-emerald-200' : 'bg-orange-50 border border-orange-200'}`}>
          {isIncome
            ? <ArrowUpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            : <ArrowDownCircle className="w-4 h-4 text-orange-500 shrink-0" />
          }
          <span className={`text-[11px] font-semibold ${isIncome ? 'text-emerald-700' : 'text-orange-600'}`}>
            {isIncome
              ? 'Registra fondos que entran a la caja (fondo extra, depósito, etc.)'
              : 'Registra fondos que salen de la caja (gastos operativos, retiro parcial, etc.)'}
          </span>
        </div>

        {/* Amount + currency */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Monto *</label>
          <div className="flex gap-2 mt-1">
            <input
              type="number" min={0.01} step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="flex-1 px-2.5 py-2 border border-border rounded-lg text-[13px] bg-muted outline-none focus:border-primary focus:bg-card"
            />
            <select value={currency} onChange={e => setCurrency(e.target.value as 'MXN' | 'USD')}
              className="px-2.5 py-2 border border-border rounded-lg text-[12px] bg-muted outline-none focus:border-primary cursor-pointer">
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Motivo *</label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={isIncome ? 'Ej: Fondo inicial extra, depósito' : 'Ej: Compra de papelería, retiro parcial'}
            className="w-full mt-1 px-2.5 py-2 border border-border rounded-lg text-[12px] bg-muted outline-none focus:border-primary focus:bg-card"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Notas adicionales (opcional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Detalle adicional…"
            rows={2}
            className="w-full mt-1 px-2.5 py-2 border border-border rounded-lg text-[12px] bg-muted outline-none focus:border-primary focus:bg-card resize-none"
          />
        </div>

        {error && (
          <div className="flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-1.5 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <Check className="w-3.5 h-3.5 shrink-0" />Movimiento registrado correctamente
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={`w-full py-2.5 rounded-lg text-[13px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-colors ${isIncome ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" />Registrando…</>
            : isIncome
              ? <><ArrowUpCircle className="w-4 h-4" />Registrar ingreso</>
              : <><ArrowDownCircle className="w-4 h-4" />Registrar retiro</>
          }
        </button>
      </div>
    </div>
  )
}

// ─── Clientes Panel ───────────────────────────────────────────────────────────

function ClientesPanel({
  onSelectCliente,
  onClose,
}: {
  onSelectCliente: (c: Cliente) => void
  onClose: () => void
}) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateClienteInput>({ firstName: '', lastName: '', email: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setClientes(await fetchClientes()) }
    catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = clientes.filter(c => {
    const q = search.toLowerCase()
    return !q || c.nombre.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.telefono ?? '').includes(q)
  })

  const handleCreate = async () => {
    if (!createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.email.trim()) {
      setCreateError('Nombre, apellido y email son requeridos'); return
    }
    setCreating(true); setCreateError(null)
    try {
      const c = await createCliente(createForm)
      setClientes(prev => [c, ...prev])
      setShowCreate(false)
      setCreateForm({ firstName: '', lastName: '', email: '' })
    } catch (e: unknown) {
      setCreateError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al crear cliente')
    } finally { setCreating(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Clientes" onClose={onClose} />

      {/* Search + create */}
      <div className="px-3 py-2.5 border-b border-border shrink-0 space-y-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email, teléfono…"
          className="w-full px-2.5 py-2 border border-border rounded-lg text-[12px] bg-muted outline-none focus:border-primary focus:bg-card"
        />
        <button
          onClick={() => { setShowCreate(!showCreate); setCreateError(null) }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-primary/50 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/5 cursor-pointer transition-colors"
        >
          <Plus className="w-3 h-3" /> Nuevo cliente rápido
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-3 py-3 border-b border-border bg-primary/5 shrink-0 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={createForm.firstName} onChange={e => setCreateForm(p => ({ ...p, firstName: e.target.value }))}
              placeholder="Nombre *" autoFocus
              className="px-2.5 py-1.5 border border-border rounded-lg text-[11px] bg-card outline-none focus:border-primary" />
            <input value={createForm.lastName} onChange={e => setCreateForm(p => ({ ...p, lastName: e.target.value }))}
              placeholder="Apellido *"
              className="px-2.5 py-1.5 border border-border rounded-lg text-[11px] bg-card outline-none focus:border-primary" />
          </div>
          <input value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
            placeholder="Email *" type="email"
            className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[11px] bg-card outline-none focus:border-primary" />
          <input value={createForm.phone ?? ''} onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="Teléfono (opcional)"
            className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[11px] bg-card outline-none focus:border-primary" />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="hasCredit"
              checked={createForm.hasCredit ?? false}
              onChange={e => setCreateForm(p => ({ ...p, hasCredit: e.target.checked }))}
              className="cursor-pointer" />
            <label htmlFor="hasCredit" className="text-[11px] text-foreground cursor-pointer">Habilitar crédito</label>
          </div>
          {createForm.hasCredit && (
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} value={createForm.creditLimit ?? ''} onChange={e => setCreateForm(p => ({ ...p, creditLimit: parseFloat(e.target.value) || undefined }))}
                placeholder="Límite crédito"
                className="px-2.5 py-1.5 border border-border rounded-lg text-[11px] bg-card outline-none focus:border-primary" />
              <input type="number" min={0} max={365} value={createForm.creditDays ?? ''} onChange={e => setCreateForm(p => ({ ...p, creditDays: parseInt(e.target.value) || undefined }))}
                placeholder="Días crédito"
                className="px-2.5 py-1.5 border border-border rounded-lg text-[11px] bg-card outline-none focus:border-primary" />
            </div>
          )}
          {createError && <div className="text-[11px] text-red-600">{createError}</div>}
          <div className="flex gap-2">
            <button onClick={() => { setShowCreate(false); setCreateError(null) }}
              className="flex-1 py-1.5 border border-border rounded-lg text-[11px] cursor-pointer text-muted-foreground hover:bg-muted">Cancelar</button>
            <button onClick={handleCreate} disabled={creating}
              className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1">
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Cargando…</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} text={search ? 'Sin resultados' : 'No hay clientes registrados'} />
        ) : (
          filtered.slice(0, 50).map(c => (
            <button key={c.id} onClick={() => onSelectCliente(c)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 border-b border-border hover:bg-muted/40 transition-colors cursor-pointer text-left bg-transparent">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                {c.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-foreground truncate">{c.nombre}</div>
                <div className="text-[10px] text-muted-foreground truncate">{c.email}</div>
                {c.telefono && <div className="text-[10px] text-muted-foreground">{c.telefono}</div>}
              </div>
              <div className="text-right shrink-0">
                {c.hasCredit && (
                  <div className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">CRÉDITO</div>
                )}
                <div className="text-[10px] text-muted-foreground mt-0.5">{c.pedidos} pedidos</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Apartados Panel ──────────────────────────────────────────────────────────

function ApartadosPanel({
  holdSales, carrito, cartTotal, cliente,
  onHold, onResume, onDiscard, onClose,
}: {
  holdSales: HoldSale[]
  carrito: CartItem[]
  cartTotal: number
  cliente: Cliente | null
  onHold: (label?: string) => void
  onResume: (id: string) => void
  onDiscard: (id: string) => void
  onClose: () => void
}) {
  const [label, setLabel] = useState('')

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Apartados / Hold" onClose={onClose} />
      <div className="flex-1 overflow-y-auto">

        {/* Hold current cart */}
        {carrito.length > 0 && (
          <div className="px-4 py-3 border-b border-border bg-amber-50/40">
            <div className="text-[11px] font-bold text-amber-700 mb-2">Apartar carrito actual</div>
            <div className="text-[10px] text-muted-foreground mb-2">
              {carrito.length} artículo(s) · {fmt(cartTotal)}
              {cliente && <span> · {cliente.nombre}</span>}
            </div>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Etiqueta (ej: Mesa 3, Cliente López…)"
              className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[11px] bg-card outline-none focus:border-primary mb-2"
            />
            <button
              onClick={() => { onHold(label.trim() || undefined); setLabel('') }}
              className="w-full py-2 bg-amber-500 text-white rounded-lg text-[12px] font-bold cursor-pointer hover:bg-amber-600 transition-colors flex items-center justify-center gap-1.5"
            >
              <Pause className="w-3.5 h-3.5" /> Apartar y limpiar carrito
            </button>
          </div>
        )}

        {/* Hold sales list */}
        {holdSales.length === 0 ? (
          <EmptyState icon={Pause} text="Sin ventas apartadas. Usa el botón de arriba para apartar el carrito actual." />
        ) : (
          <>
            <div className="px-4 pt-3 pb-1">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{holdSales.length} apartado(s)</div>
            </div>
            {holdSales.map(hold => (
              <div key={hold.id} className="flex items-center gap-2.5 px-4 py-3 border-b border-border hover:bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-foreground">{hold.label}</div>
                  {hold.cliente && <div className="text-[10px] text-muted-foreground truncate">{hold.cliente.nombre}</div>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-semibold text-foreground">{fmt(hold.total)}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(hold.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => onResume(hold.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded text-[10px] font-bold cursor-pointer hover:opacity-90">
                    <PlayCircle className="w-3 h-3" /> Retomar
                  </button>
                  <button onClick={() => onDiscard(hold.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-600 rounded text-[10px] font-semibold cursor-pointer hover:bg-red-200">
                    <Trash2 className="w-3 h-3" /> Descartar
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sidebar root ─────────────────────────────────────────────────────────────

export type PanelId = 'caja' | 'ventas' | 'ingreso' | 'egreso' | 'clientes' | 'apartados'

interface SidebarIconProps {
  id: PanelId
  icon: React.ElementType
  label: string
  active: boolean
  expanded: boolean
  badge?: number
  dot?: 'green' | 'red' | null
  onClick: () => void
}

function SidebarIcon({ id: _id, icon: Icon, label, active, expanded, badge, dot, onClick }: SidebarIconProps) {
  if (expanded) {
    return (
      <button
        onClick={onClick}
        title={label}
        className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer border-none transition-all text-left
          ${active ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'}`}
      >
        <div className="relative shrink-0">
          <Icon style={{ width: '16px', height: '16px' }} />
          {dot && (
            <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-card ${dot === 'green' ? 'bg-green-500' : 'bg-red-500'}`} />
          )}
        </div>
        <span className="text-[12px] font-semibold truncate flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <div className="shrink-0 min-w-[18px] h-4 bg-amber-500 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white px-1">
            {badge}
          </div>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer border-none transition-all
        ${active ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'}`}
    >
      <Icon style={{ width: '18px', height: '18px' }} />
      {dot && (
        <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-card ${dot === 'green' ? 'bg-green-500' : 'bg-red-500'}`} />
      )}
      {badge != null && badge > 0 && (
        <div className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-amber-500 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white px-0.5">
          {badge}
        </div>
      )}
    </button>
  )
}

export interface PosSidebarProps {
  carrito: CartItem[]
  cliente: Cliente | null
  cartTotal: number
  holdSales: HoldSale[]
  onHoldCart: (label?: string) => void
  onResumeHoldSale: (id: string) => void
  onDiscardHoldSale: (id: string) => void
  onSelectCliente: (c: Cliente) => void
  onSessionChange?: () => void
  controlledPanel?: PanelId | null
  onPanelChange?: (p: PanelId | null) => void
}

export function PosSidebar({
  carrito, cliente, cartTotal,
  holdSales, onHoldCart, onResumeHoldSale, onDiscardHoldSale,
  onSelectCliente, onSessionChange,
  controlledPanel, onPanelChange,
}: PosSidebarProps) {
  const [internalPanel, setInternalPanel] = useState<PanelId | null>(null)
  const activePanel = controlledPanel !== undefined ? controlledPanel : internalPanel
  const setActivePanel = useCallback((p: PanelId | null) => {
    if (onPanelChange) onPanelChange(p)
    else setInternalPanel(p)
  }, [onPanelChange])
  const [sessionOpen, setSessionOpen] = useState<boolean | null>(null)
  const [railExpanded, setRailExpanded] = useState(false)

  useEffect(() => {
    fetchActiveCashSession()
      .then(s => setSessionOpen(s !== null))
      .catch(() => setSessionOpen(null))
  }, [])

  const handleSessionChange = useCallback(() => {
    fetchActiveCashSession()
      .then(s => setSessionOpen(s !== null))
      .catch(() => setSessionOpen(null))
    onSessionChange?.()
  }, [onSessionChange])

  const toggle = (id: PanelId) => setActivePanel(activePanel === id ? null : id)

  const handleSelectCliente = (c: Cliente) => {
    onSelectCliente(c)
    setActivePanel(null)
  }

  const iconProps = { expanded: railExpanded }

  return (
    <div className="flex shrink-0 h-full border-r border-border bg-card">
      {/* Icon rail */}
      <div
        className="h-full flex flex-col pt-3 pb-2 gap-1 transition-all duration-200"
        style={{ width: railExpanded ? '180px' : '52px', alignItems: railExpanded ? 'stretch' : 'center', padding: railExpanded ? '12px 8px 8px' : undefined }}
      >
        <SidebarIcon id="caja" icon={Wallet} label="Estado de caja"
          active={activePanel === 'caja'}
          dot={sessionOpen === null ? null : sessionOpen ? 'green' : 'red'}
          onClick={() => toggle('caja')} {...iconProps} />
        <SidebarIcon id="ventas" icon={TrendingUp} label="Ventas del día"
          active={activePanel === 'ventas'}
          onClick={() => toggle('ventas')} {...iconProps} />
        <div className={`h-px bg-border my-0.5 ${railExpanded ? 'mx-1' : 'w-6'}`} />
        <SidebarIcon id="ingreso" icon={ArrowUpCircle} label="Ingreso de efectivo"
          active={activePanel === 'ingreso'}
          onClick={() => toggle('ingreso')} {...iconProps} />
        <SidebarIcon id="egreso" icon={ArrowDownCircle} label="Retiro de efectivo"
          active={activePanel === 'egreso'}
          onClick={() => toggle('egreso')} {...iconProps} />
        <div className={`h-px bg-border my-0.5 ${railExpanded ? 'mx-1' : 'w-6'}`} />
        <SidebarIcon id="clientes" icon={Users} label="Clientes"
          active={activePanel === 'clientes'}
          onClick={() => toggle('clientes')} {...iconProps} />
        <SidebarIcon id="apartados" icon={Pause} label="Apartados / Hold"
          active={activePanel === 'apartados'}
          badge={holdSales.length}
          onClick={() => toggle('apartados')} {...iconProps} />

        {/* Spacer + expand toggle */}
        <div className="flex-1" />
        <button
          onClick={() => setRailExpanded(p => !p)}
          title={railExpanded ? 'Colapsar menú' : 'Expandir menú'}
          className={`cursor-pointer border-none bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors
            ${railExpanded ? 'flex items-center gap-2.5 px-3 py-2 w-full' : 'w-10 h-10 flex items-center justify-center'}`}
        >
          {railExpanded
            ? <><PanelLeftClose style={{ width: '16px', height: '16px', flexShrink: 0 }} /><span className="text-[11px] font-semibold">Colapsar</span></>
            : <PanelLeftOpen style={{ width: '18px', height: '18px' }} />
          }
        </button>
      </div>

      {/* Panel */}
      {activePanel && (
        <div className="w-[300px] h-full flex flex-col border-l border-border overflow-hidden">
          {activePanel === 'caja' && (
            <CajaPanel onClose={() => setActivePanel(null)} onSessionChange={handleSessionChange} />
          )}
          {activePanel === 'ventas' && (
            <MisVentasPanel onClose={() => setActivePanel(null)} />
          )}
          {activePanel === 'ingreso' && (
            <CashMovementPanel type="INCOME" onClose={() => setActivePanel(null)} />
          )}
          {activePanel === 'egreso' && (
            <CashMovementPanel type="EXPENSE" onClose={() => setActivePanel(null)} />
          )}
          {activePanel === 'clientes' && (
            <ClientesPanel onSelectCliente={handleSelectCliente} onClose={() => setActivePanel(null)} />
          )}
          {activePanel === 'apartados' && (
            <ApartadosPanel
              holdSales={holdSales}
              carrito={carrito}
              cartTotal={cartTotal}
              cliente={cliente}
              onHold={onHoldCart}
              onResume={onResumeHoldSale}
              onDiscard={onDiscardHoldSale}
              onClose={() => setActivePanel(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
