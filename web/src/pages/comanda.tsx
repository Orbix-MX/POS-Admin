import { useState, useEffect, useCallback } from 'react'
import {
  Search, X, Check, Loader2, Plus, Minus, ShoppingCart,
  ChevronRight, UtensilsCrossed, Clock, ArrowLeft, LayoutGrid, Store, Delete,
} from 'lucide-react'
import { fetchProducts, type Product } from '@/services/retail/product-service'
import {
  getActiveDiningOrders, openDiningOrder, addDiningOrderItem, changeDiningOrderStatus,
  diningOrderTotal, fmtDiningMoney,
  type DiningOrder,
} from '@/services/restaurant/dining-orders-service'
import { fetchTables, type RestaurantTable } from '@/services/restaurant/tables-service'
import { verifyWaiterPin, waiterFullName, type VerifiedWaiter } from '@/services/restaurant/waiter-auth-service'
import { useAuthStore } from '@/store/auth-store'
import { useWaiterStore } from '@/store/waiter-store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalCartItem {
  lineId: string  // unique per cart line
  id: string
  name: string
  sku: string
  price: number
  qty: number
  comment: string
}

type ComandaStage = 'login' | 'open-orders' | 'ordering' | 'success'

// Destino de captura para una cuenta nueva (aún no persistida).
type CaptureTarget =
  | { kind: 'dine-in'; tableId: string; label: string }
  | { kind: 'counter'; reference: string; label: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diff < 1) return 'ahora'
  if (diff < 60) return `${diff} min`
  return `${Math.floor(diff / 60)} h`
}

function orderLabel(o: DiningOrder): string {
  return o.table?.name ?? o.reference ?? 'Cuenta'
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ComandaProductCard({
  p, inCartQty, onAdd,
}: { p: Product; inCartQty: number; onAdd: () => void }) {
  const agotado = p.trackInventory && p.stock === 0
  return (
    <button
      onClick={onAdd}
      disabled={agotado}
      className={`bg-card border-2 rounded-2xl p-4 text-left relative transition-all flex flex-col gap-1
        ${agotado ? 'opacity-50 cursor-not-allowed border-border' : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:border-primary active:scale-95'}
        ${inCartQty > 0 ? 'border-primary bg-primary/5' : 'border-border'}`}
      style={{ minHeight: '130px' }}
    >
      {inCartQty > 0 && (
        <div className="absolute top-2.5 right-2.5 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-[11px] font-extrabold text-primary-foreground shadow">
          {inCartQty}
        </div>
      )}
      {agotado && (
        <div className="absolute top-2.5 left-2.5 text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">AGOTADO</div>
      )}
      <div className="text-sm font-bold text-foreground leading-snug mt-2 line-clamp-2 flex-1">{p.name}</div>
      <div className="text-[10px] text-muted-foreground font-mono">{p.sku}</div>
      <div className="text-base font-extrabold text-primary mt-1">{fmtDiningMoney(p.price)}</div>
    </button>
  )
}

// ─── Cart Row ─────────────────────────────────────────────────────────────────

function CartItemRow({
  item, onPlus, onMinus, lineNumber, onCommentChange,
}: {
  item: LocalCartItem
  onPlus: () => void
  onMinus: () => void
  lineNumber: number
  onCommentChange: (comment: string) => void
}) {
  return (
    <div className="flex flex-col px-4 py-3 border-b border-border hover:bg-muted/20 transition-colors">
      {/* Name + controls row */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-muted-foreground/60 shrink-0">#{lineNumber}</span>
            <div className="text-[13px] font-bold text-foreground truncate">{item.name}</div>
          </div>
          <div className="text-[11px] text-muted-foreground">{fmtDiningMoney(item.price)} c/u</div>
        </div>
        <div className="flex items-center border border-border rounded-xl overflow-hidden shrink-0">
          <button onClick={onMinus}
            className="w-8 h-8 border-none bg-muted cursor-pointer text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-colors">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-bold text-foreground">{item.qty}</span>
          <button onClick={onPlus}
            className="w-8 h-8 border-none bg-muted cursor-pointer text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-sm font-extrabold text-foreground w-[62px] text-right shrink-0">
          {fmtDiningMoney(item.price * item.qty)}
        </div>
      </div>

      {/* Comment input */}
      <input
        type="text"
        value={item.comment}
        onChange={e => onCommentChange(e.target.value)}
        placeholder="Nota para cocina…"
        className="mt-2 w-full text-[12px] px-2.5 py-1.5 bg-muted/60 border border-border/60 rounded-lg text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/60 focus:bg-card transition-colors"
      />
    </div>
  )
}

// ─── Open Order Card ──────────────────────────────────────────────────────────

function OpenOrderCard({
  order, onContinue,
}: { order: DiningOrder; onContinue: () => void }) {
  const total = diningOrderTotal(order)
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[15px] font-extrabold text-foreground">{orderLabel(order)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {order.items.length} producto{order.items.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
          <Clock className="w-3 h-3" />
          {timeAgo(order.openedAt)}
        </div>
      </div>

      {/* Items summary */}
      <div className="flex flex-col gap-1">
        {order.items.slice(0, 4).map((item) => (
          <div key={item.id} className="flex items-center gap-2 text-[12px]">
            <span className="w-5 h-5 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
              {item.quantity}
            </span>
            <span className="flex-1 text-foreground truncate">{item.productName}</span>
            <span className="text-muted-foreground shrink-0">{fmtDiningMoney(item.unitPrice)}</span>
          </div>
        ))}
        {order.items.length > 4 && (
          <div className="text-[11px] text-muted-foreground pl-7">
            +{order.items.length - 4} más…
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border">
        <div className="text-[13px] font-bold text-foreground">
          Total: {fmtDiningMoney(total)}
        </div>
        <button
          onClick={onContinue}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-[12px] font-bold cursor-pointer hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar productos
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Comanda() {
  const branchId = useAuthStore((s) => s.currentBranch?.id ?? null)
  // Cocina se determina por el MÓDULO habilitado (enabledModules incluye 'kitchen'),
  // igual que el backend DiningOrdersService.isKitchenEnabled. No usar el feature
  // 'KITCHEN' (Tenant.enabledFeatures) — es un campo distinto y desincroniza el flujo.
  const kitchenEnabled = useAuthStore((s) => s.enabledModules.includes('kitchen'))

  const [stage, setStage] = useState<ComandaStage>('login')

  // Login (autorización de mesero por PIN — no emite token)
  const [pin, setPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [waiter, setWaiter] = useState<VerifiedWaiter | null>(null)
  // Mesero persistente entre operaciones/páginas (comanda ↔ caja). Un PIN basta.
  const storeWaiter = useWaiterStore((s) => s.waiter)
  const setStoreWaiter = useWaiterStore((s) => s.setWaiter)
  const clearStoreWaiter = useWaiterStore((s) => s.clearWaiter)

  // Open orders + tables
  const [openOrders, setOpenOrders] = useState<DiningOrder[]>([])
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [counterRef, setCounterRef] = useState('')
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardError, setBoardError] = useState('')

  // Ordering state
  const [target, setTarget] = useState<CaptureTarget | null>(null) // cuenta nueva
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null) // cuenta existente (OPEN)
  const [activeOrder, setActiveOrder] = useState<DiningOrder | null>(null)
  const [activeLabel, setActiveLabel] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<LocalCartItem[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // Success
  const [successLabel, setSuccessLabel] = useState('')

  // ── Product loader ──────────────────────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    setCatalogLoading(true)
    try {
      const res = await fetchProducts()
      const active = (res.data ?? []).filter((p: Product) => p.status === 'ACTIVE')
      setProducts(active)

      // Derive categories from products — avoids a separate API call and permission issues
      const catMap = new Map<string, string>()
      for (const p of active) {
        if (p.category?.id && p.category?.name) {
          catMap.set(p.category.id, p.category.name)
        }
      }
      setCategories(
        Array.from(catMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
    } catch { /* silent */ }
    finally { setCatalogLoading(false) }
  }, [])

  useEffect(() => {
    if (stage === 'ordering') loadProducts()
  }, [stage, loadProducts])

  // ── Tablero: mesas + mis cuentas abiertas ─────────────────────────────────────

  const loadBoard = useCallback(async (w: VerifiedWaiter | null) => {
    if (!branchId || !w) return
    setBoardLoading(true)
    setBoardError('')
    try {
      const [allTables, orders] = await Promise.all([
        fetchTables(branchId),
        getActiveDiningOrders(branchId),
      ])
      setTables(allTables.filter(t => t.isActive))
      // Mis cuentas en captura (OPEN) — son a las que puedo seguir agregando.
      setOpenOrders(orders.filter(o => o.status === 'OPEN' && o.waiter?.id === w.id))
    } catch {
      setBoardError('Error al cargar mesas y cuentas. Intenta de nuevo.')
    } finally {
      setBoardLoading(false)
    }
  }, [branchId])

  // ── Auto-return after success ────────────────────────────────────────────────

  useEffect(() => {
    if (stage !== 'success') return
    const t = setTimeout(() => {
      setStage('open-orders')
      setTarget(null); setActiveOrderId(null); setActiveOrder(null); setActiveLabel('')
      setCart([]); setSendError(null); setSearch(''); setSelectedCategoryId(null)
      setCounterRef('')
      void loadBoard(waiter)
    }, 2200)
    return () => clearTimeout(t)
  }, [stage, waiter, loadBoard])

  // ── Login (PIN → autoriza mesero) ──────────────────────────────────────────────

  const handleLogin = useCallback(async (value: string) => {
    if (!/^\d{4,6}$/.test(value)) {
      setLoginError('El PIN debe tener entre 4 y 6 dígitos.')
      return
    }
    setLoginError('')
    setLoginLoading(true)
    try {
      const w = await verifyWaiterPin(value)
      setWaiter(w)
      setStoreWaiter(w)
      setStage('open-orders')
      await loadBoard(w)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      setLoginError(err?.response?.data?.message ?? 'PIN incorrecto.')
      setPin('')
    } finally {
      setLoginLoading(false)
    }
  }, [loadBoard, setStoreWaiter])

  // Mesero ya identificado en una operación previa (p. ej. caja) → saltar el PIN.
  useEffect(() => {
    if (stage === 'login' && !waiter && storeWaiter) {
      setWaiter(storeWaiter)
      setStage('open-orders')
      void loadBoard(storeWaiter)
    }
  }, [stage, waiter, storeWaiter, loadBoard])

  const pressPinKey = (key: string) => {
    setLoginError('')
    setPin(prev => {
      const next = (prev + key).slice(0, 6)
      if (next.length >= 4 && key !== '') { /* allow explicit submit */ }
      return next
    })
  }

  const logoutWaiter = () => {
    setWaiter(null); clearStoreWaiter(); setPin(''); setLoginError('')
    setOpenOrders([]); setTables([])
    setStage('login')
  }

  // ── Abrir / continuar cuenta → ordering ────────────────────────────────────────

  const startDineIn = (t: RestaurantTable) => {
    setTarget({ kind: 'dine-in', tableId: t.id, label: t.name })
    setActiveOrderId(null); setActiveOrder(null)
    setActiveLabel(t.name)
    resetOrderingState()
    setStage('ordering')
  }

  const startCounter = () => {
    const ref = counterRef.trim()
    const label = ref || 'Mostrador'
    setTarget({ kind: 'counter', reference: ref, label })
    setActiveOrderId(null); setActiveOrder(null)
    setActiveLabel(label)
    resetOrderingState()
    setStage('ordering')
  }

  const handleContinueOrder = (order: DiningOrder) => {
    setTarget(null)
    setActiveOrderId(order.id)
    setActiveOrder(order)
    setActiveLabel(orderLabel(order))
    resetOrderingState()
    setStage('ordering')
  }

  const resetOrderingState = () => {
    setCart([]); setSendError(null); setSearch(''); setSelectedCategoryId(null)
  }

  // ── Cart handlers ─────────────────────────────────────────────────────────────

  const handleAddToCart = (p: Product) => {
    const lineId = `${p.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    setCart(prev => [...prev, { lineId, id: p.id!, name: p.name, sku: p.sku, price: Number(p.price), qty: 1, comment: '' }])
  }

  const handleCartPlus = (lineId: string) =>
    setCart(prev => prev.map(i => i.lineId === lineId ? { ...i, qty: i.qty + 1 } : i))

  const handleCartMinus = (lineId: string) =>
    setCart(prev => {
      const item = prev.find(i => i.lineId === lineId)
      if (!item) return prev
      if (item.qty <= 1) return prev.filter(i => i.lineId !== lineId)
      return prev.map(i => i.lineId === lineId ? { ...i, qty: i.qty - 1 } : i)
    })

  const handleCommentChange = (lineId: string, comment: string) =>
    setCart(prev => prev.map(i => i.lineId === lineId ? { ...i, comment } : i))

  const cartTotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0)

  // ── Send ──────────────────────────────────────────────────────────────────────
  // Flujo único (igual que la app): crea/usa el DiningOrder, guarda items y avanza
  // el estado a cocina (SENT_TO_KITCHEN) o a caja (READY_FOR_PAYMENT). No imprime:
  // la cocina recibe la comanda por estado/KDS y el ticket se genera al cobrar.

  const handleSend = async () => {
    if (cart.length === 0 || !branchId || !waiter) return
    setSending(true); setSendError(null)
    try {
      let orderId = activeOrderId
      if (!orderId) {
        const created = target?.kind === 'dine-in'
          ? await openDiningOrder(branchId, { serviceType: 'DINE_IN', tableId: target.tableId, waiterId: waiter.id })
          : await openDiningOrder(branchId, { serviceType: 'COUNTER', reference: target?.kind === 'counter' ? target.reference || undefined : undefined, waiterId: waiter.id })
        orderId = created.id
      }

      for (const i of cart) {
        await addDiningOrderItem(branchId, orderId, {
          productId: i.id,
          productName: i.name,
          unitPrice: i.price,
          quantity: i.qty,
          ...(i.comment.trim() && { notes: i.comment.trim() }),
        })
      }

      const next = kitchenEnabled ? 'SENT_TO_KITCHEN' : 'READY_FOR_PAYMENT'
      await changeDiningOrderStatus(branchId, orderId, next)

      setSuccessLabel(activeLabel)
      setStage('success')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      setSendError(err?.response?.data?.message ?? err?.message ?? 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  const filteredProducts = products.filter(p => {
    const matchesCat = !selectedCategoryId || p.categoryId === selectedCategoryId
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    return matchesCat && matchesSearch
  })

  // ══ Stage: login (PIN pad) ══════════════════════════════════════════════════════

  if (stage === 'login') {
    const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen p-6 bg-background">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UtensilsCrossed className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">Captura de Comanda</h1>
            <p className="text-sm text-muted-foreground">Ingresa tu PIN de empleado</p>
          </div>

          {/* PIN dots */}
          <div className="flex items-center justify-center gap-3">
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all ${i < pin.length ? 'bg-primary' : 'border-2 border-border'}`}
              />
            ))}
          </div>

          {loginError && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-center">
              {loginError}
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {PIN_KEYS.map(k => (
              <button
                key={k}
                onClick={() => pressPinKey(k)}
                disabled={loginLoading}
                className="py-4 rounded-xl bg-muted text-foreground text-xl font-bold cursor-pointer hover:bg-muted/70 active:scale-95 transition-all disabled:opacity-50"
              >
                {k}
              </button>
            ))}
            <button
              onClick={() => setPin(p => p.slice(0, -1))}
              disabled={loginLoading || pin.length === 0}
              className="py-4 rounded-xl bg-muted text-muted-foreground flex items-center justify-center cursor-pointer hover:bg-muted/70 active:scale-95 transition-all disabled:opacity-40"
            >
              <Delete className="w-5 h-5" />
            </button>
            <button
              onClick={() => pressPinKey('0')}
              disabled={loginLoading}
              className="py-4 rounded-xl bg-muted text-foreground text-xl font-bold cursor-pointer hover:bg-muted/70 active:scale-95 transition-all disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={() => handleLogin(pin)}
              disabled={loginLoading || pin.length < 4}
              className="py-4 rounded-xl bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══ Stage: open-orders (tablero) ══════════════════════════════════════════════

  if (stage === 'open-orders') {
    const availableTables = tables.filter(t => t.status === 'AVAILABLE')
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-background">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-card shrink-0 flex items-center gap-3">
          <button
            onClick={logoutWaiter}
            className="p-2 rounded-xl hover:bg-muted cursor-pointer border-none bg-transparent transition-colors"
            title="Cambiar empleado"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <div className="text-[15px] font-extrabold text-foreground">
              {waiter ? waiterFullName(waiter) : 'Mesero'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {openOrders.length > 0
                ? `${openOrders.length} cuenta${openOrders.length !== 1 ? 's' : ''} en captura`
                : 'Sin cuentas en captura'}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          {boardError && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              {boardError}
            </div>
          )}

          {/* ── Mostrador / Para llevar (COUNTER) ─────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
            <div className="text-[13px] font-bold text-foreground flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" /> Mostrador / Para llevar
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={counterRef}
                onChange={e => setCounterRef(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') startCounter() }}
                placeholder="Referencia (opcional): Cliente, Para llevar…"
                className="flex-1 min-w-0 px-3.5 py-2.5 border border-border rounded-xl text-[13px] bg-muted text-foreground outline-none focus:border-primary focus:bg-card transition-colors"
              />
              <button
                onClick={startCounter}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-[13px] font-bold cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Abrir
              </button>
            </div>
          </div>

          {/* ── Mis cuentas en captura (OPEN) ─────────────────────────────────── */}
          {openOrders.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-0.5">
                Mis cuentas en captura · {openOrders.length}
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {openOrders.map(order => (
                  <OpenOrderCard
                    key={order.id}
                    order={order}
                    onContinue={() => handleContinueOrder(order)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Mesas disponibles (DINE_IN) ───────────────────────────────────── */}
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-0.5 flex items-center gap-2">
              <LayoutGrid className="w-3.5 h-3.5" /> Mesas disponibles
              {availableTables.length > 0 && <span>· {availableTables.length}</span>}
            </div>
            {boardLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Cargando mesas…</span>
              </div>
            ) : availableTables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <UtensilsCrossed className="w-10 h-10 text-muted-foreground/30" />
                <div className="text-[13px] font-semibold text-muted-foreground">No hay mesas disponibles</div>
                <div className="text-[11px] text-muted-foreground/60">Usa Mostrador o libera una mesa al cobrar</div>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                {availableTables.map(t => (
                  <button
                    key={t.id}
                    onClick={() => startDineIn(t)}
                    className="bg-card border-2 border-border rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:border-primary active:scale-95 transition-all"
                    style={{ minHeight: '110px' }}
                  >
                    <UtensilsCrossed className="w-5 h-5 text-primary" />
                    <div className="text-[14px] font-extrabold text-foreground text-center leading-tight">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground">{t.area?.name} · {t.capacity}p</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ══ Stage: success ════════════════════════════════════════════════════════════

  if (stage === 'success') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen p-6 bg-background">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-foreground">
              {kitchenEnabled ? '¡Enviada a cocina!' : '¡Lista para cobro!'}
            </h2>
            <p className="text-muted-foreground mt-1 text-base">{successLabel}</p>
          </div>
          <p className="text-sm text-muted-foreground">Regresando en unos segundos…</p>
        </div>
      </div>
    )
  }

  // ══ Stage: ordering ═══════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setStage('open-orders')}
            className="p-2 rounded-xl hover:bg-muted cursor-pointer border-none bg-transparent transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold text-foreground truncate">
              {activeLabel}{waiter && <span className="ml-2 text-[11px] font-normal text-muted-foreground">· {waiterFullName(waiter)}</span>}
              {activeOrderId && <span className="ml-2 text-[11px] font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Agregando a cuenta existente</span>}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {cart.length} producto{cart.length !== 1 ? 's' : ''} nuevo{cart.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Catalog */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="px-5 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2 bg-muted rounded-xl px-3.5 py-2.5">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar producto…"
                className="border-none bg-transparent outline-none text-[13px] text-foreground w-full"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="border-none bg-transparent cursor-pointer text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category pills */}
          {categories.length > 0 && (
            <div className="flex gap-2 px-4 py-2.5 overflow-x-auto shrink-0 border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap cursor-pointer border transition-all shrink-0
                  ${!selectedCategoryId
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'}`}
              >
                Todos
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id!)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap cursor-pointer border transition-all shrink-0
                    ${selectedCategoryId === cat.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4">
            {catalogLoading ? (
              <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Cargando productos…</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                <Search className="w-8 h-8 opacity-30" />
                <span className="text-sm">{search ? 'Sin resultados' : 'No hay productos disponibles'}</span>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
                {filteredProducts.map(p => (
                  <ComandaProductCard
                    key={p.id}
                    p={p}
                    inCartQty={cart.filter(i => i.id === p.id).reduce((s, i) => s + i.qty, 0)}
                    onAdd={() => handleAddToCart(p)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart panel */}
        <div className="w-1/3 shrink-0 border-l border-border flex flex-col bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <div className="text-[13px] font-extrabold text-foreground flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              {activeOrderId ? 'Agregando a cuenta' : 'Cuenta nueva'}
            </div>
          </div>

          {/* Existing items summary (when editing) */}
          {activeOrderId && activeOrder && activeOrder.items.length > 0 && (
            <div className="border-b border-border">
              <div className="px-4 py-2 bg-amber-50 flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                  Ya ordenado ({activeOrder.items.length} items)
                </span>
              </div>
              <div className="divide-y divide-border/50 max-h-[140px] overflow-y-auto">
                {activeOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-4 py-2 opacity-60">
                    <span className="text-[11px] font-bold text-muted-foreground w-5 text-center shrink-0">
                      {item.quantity}
                    </span>
                    <span className="flex-1 text-[12px] text-foreground truncate">{item.productName}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {fmtDiningMoney(item.unitPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 gap-2 text-muted-foreground">
                <ShoppingCart className="w-8 h-8 opacity-25" />
                <span className="text-xs text-center px-4">
                  Toca un producto para agregarlo a la cuenta
                </span>
              </div>
            ) : (
              cart.map((item, idx) => (
                <CartItemRow
                  key={item.lineId}
                  item={item}
                  lineNumber={idx + 1}
                  onPlus={() => handleCartPlus(item.lineId)}
                  onMinus={() => handleCartMinus(item.lineId)}
                  onCommentChange={comment => handleCommentChange(item.lineId, comment)}
                />
              ))
            )}
          </div>

          {/* Total + send */}
          <div className="border-t border-border px-4 py-4 shrink-0 space-y-3">
            {cart.length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-muted-foreground">
                  {activeOrderId ? 'Agrega' : 'Total'}
                </span>
                <span className="text-xl font-extrabold text-foreground">{fmtDiningMoney(cartTotal)}</span>
              </div>
            )}

            {sendError && (
              <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {sendError}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={cart.length === 0 || sending}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-[14px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
              ) : kitchenEnabled ? (
                <><Check className="w-4 h-4" /> Enviar a cocina</>
              ) : (
                <><Check className="w-4 h-4" /> Enviar a caja</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
