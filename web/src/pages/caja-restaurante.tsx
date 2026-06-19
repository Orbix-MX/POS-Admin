import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, CreditCard, Banknote, ArrowLeftRight,
  Search, X, Plus, Minus, Loader2, Check, UtensilsCrossed,
  Clock, ShoppingBag, AlertCircle, ChevronRight, PackagePlus, Lock, Trash2,
} from 'lucide-react'
import { fmtComandaMoney } from '@/services/retail/comanda-service'
import {
  getActiveDiningOrders, checkoutDiningOrder, isPayableDiningOrder, diningOrderTotal,
  openDiningOrder, addDiningOrderItem, changeDiningOrderStatus,
  type DiningOrder,
} from '@/services/restaurant/dining-orders-service'
import { fetchProducts, type Product } from '@/services/retail/product-service'
import { fetchSupplies, type Supply } from '@/services/retail/supplies-service'
import { withdrawForSupplies } from '@/services/core/caja-service'
import { printOrder } from '@/services/core/print-service'
import { verifyWaiterPin, waiterFullName } from '@/services/restaurant/waiter-auth-service'
import { useAuthStore } from '@/store/auth-store'
import { useWaiterStore } from '@/store/waiter-store'

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelMode = 'empty' | 'table' | 'direct'

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'

interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  qty: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  return hrs === 1 ? '1 hr' : `${hrs} hrs`
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'CASH', label: 'Efectivo', icon: Banknote },
  { value: 'CARD', label: 'Tarjeta', icon: CreditCard },
  { value: 'TRANSFER', label: 'Transfer.', icon: ArrowLeftRight },
]

// ─── Left panel: table card ───────────────────────────────────────────────────

function isDineIn(o: DiningOrder) { return o.serviceType === 'DINE_IN' || o.tableId != null }

function diningLabel(o: DiningOrder): string {
  return o.table?.name ?? o.reference ?? 'Cuenta'
}

function waiterLabel(o: DiningOrder): string | null {
  const name = `${o.waiter?.firstName ?? ''} ${o.waiter?.lastName ?? ''}`.trim()
  return name || null
}

function TableCard({
  order,
  selected,
  onClick,
}: {
  order: DiningOrder
  selected: boolean
  onClick: () => void
}) {
  const total = diningOrderTotal(order)
  const dineIn = isDineIn(order)
  const label = diningLabel(order)
  const sublabel = waiterLabel(order) ?? (dineIn ? null : 'Mostrador')

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all cursor-pointer
        ${selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
        }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
            ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {dineIn ? <UtensilsCrossed className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold text-foreground truncate">{label}</div>
            {sublabel && <div className="text-[11px] text-muted-foreground truncate">{sublabel}</div>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[15px] font-extrabold text-foreground">{fmtComandaMoney(total)}</div>
          <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
            <Clock className="w-3 h-3" />{timeAgo(order.openedAt)}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        {order.items.length} artículo{order.items.length !== 1 ? 's' : ''}
      </div>
    </button>
  )
}

// ─── Right panel: order detail + checkout ────────────────────────────────────

function TableCheckoutPanel({
  branchId,
  order,
  onSuccess,
}: {
  branchId: string
  order: DiningOrder
  onSuccess: () => void
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const total = diningOrderTotal(order)
  const dineIn = isDineIn(order)
  const headerLabel = diningLabel(order)

  const handleCobrar = async () => {
    setLoading(true)
    setError(null)
    try {
      // Flujo financiero único (igual que la app móvil): el backend genera el
      // Order, consume inventario, registra Payment + CashMovement y retorna el
      // Order. El ticket se imprime desde el Order retornado, no del DiningOrder.
      const result = await checkoutDiningOrder(branchId, order.id, [
        { paymentMethod, amount: total },
      ])
      printOrder(result.id)
      setDone(true)
      setTimeout(onSuccess, 1500)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al cobrar')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <div className="text-center">
          <div className="text-xl font-extrabold text-foreground">¡Cobrado!</div>
          <div className="text-sm text-muted-foreground mt-1">{headerLabel}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            {dineIn
              ? <UtensilsCrossed className="w-4 h-4 text-primary" />
              : <ShoppingBag className="w-4 h-4 text-primary" />
            }
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-foreground">
              {headerLabel}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />{timeAgo(order.openedAt)}
              {waiterLabel(order) && <> · {waiterLabel(order)}</>}
            </div>
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
          Detalle del pedido
        </div>
        {order.items.map(item => (
          <div key={item.id} className="flex items-center justify-between px-6 py-3 border-b border-border/50 hover:bg-muted/20 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                {item.quantity}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-foreground truncate">{item.productName}</div>
                {item.notes && <div className="text-[10px] text-muted-foreground">{item.notes}</div>}
              </div>
            </div>
            <div className="text-[13px] font-bold text-foreground shrink-0 ml-4">
              {fmtComandaMoney(Number(item.unitPrice) * item.quantity)}
            </div>
          </div>
        ))}

        {/* Total row */}
        <div className="flex items-center justify-between px-6 py-4 bg-muted/30 mt-1">
          <span className="text-[14px] font-semibold text-muted-foreground">Total a cobrar</span>
          <span className="text-2xl font-extrabold text-foreground">{fmtComandaMoney(total)}</span>
        </div>
      </div>

      {/* Payment + action */}
      <div className="px-6 py-5 border-t border-border shrink-0 space-y-4 bg-card">
        <div>
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Método de pago
          </div>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-[12px] font-semibold transition-all cursor-pointer
                    ${paymentMethod === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button
          onClick={handleCobrar}
          disabled={loading}
          className="w-full py-4 bg-primary text-primary-foreground rounded-xl text-[15px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          {loading
            ? <><Loader2 className="w-5 h-5 animate-spin" />Procesando…</>
            : <><Check className="w-5 h-5" />Cobrar {fmtComandaMoney(total)}</>
          }
        </button>
      </div>
    </div>
  )
}

// ─── Right panel: direct checkout ────────────────────────────────────────────

type DirectAction = 'cobrar' | 'guardar'

function DirectCheckoutPanel({ branchId, kitchenEnabled, onSuccess }: { branchId: string; kitchenEnabled: boolean; onSuccess: () => void }) {
  const [products, setProducts] = useState<Product[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [clientName, setClientName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [loading, setLoading] = useState<DirectAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [doneAction, setDoneAction] = useState<DirectAction | null>(null)

  // Mesero por PIN (compartido con la comanda). Si ya se ingresó en otra
  // operación, basta y no se vuelve a pedir; aquí solo se identifica si falta.
  const waiter = useWaiterStore((s) => s.waiter)
  const setStoreWaiter = useWaiterStore((s) => s.setWaiter)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  const handleVerifyPin = async () => {
    if (!/^\d{4,6}$/.test(pin)) { setPinError('El PIN debe tener entre 4 y 6 dígitos.'); return }
    setPinError(null)
    setVerifying(true)
    try {
      const w = await verifyWaiterPin(pin)
      setStoreWaiter(w)
      setPin('')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      setPinError(err?.response?.data?.message ?? 'PIN incorrecto.')
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    fetchProducts()
      .then(res => setProducts((res.data ?? []).filter(p => p.status === 'ACTIVE')))
      .catch(() => {})
      .finally(() => setCatalogLoading(false))
  }, [])

  const addToCart = (p: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: p.id!, name: p.name, sku: p.sku, price: Number(p.price), qty: 1 }]
    })
  }

  const adjustCart = (id: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.id === id ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0)
    )
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)

  const filtered = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const resetAfterDone = () => {
    setDoneAction(null)
    setCart([])
    setClientName('')
    setSearch('')
    onSuccess()
  }

  // Flujo único sobre DiningOrder (igual que Comanda web y la app): abre una
  // cuenta COUNTER, guarda los items y avanza el estado. Con cocina va a
  // SENT_TO_KITCHEN; sin cocina queda READY_FOR_PAYMENT (lista para cobro).
  const handleGuardar = async () => {
    if (cart.length === 0 || !clientName.trim() || !branchId || !waiter) return
    setLoading('guardar')
    setError(null)
    try {
      const created = await openDiningOrder(branchId, { serviceType: 'COUNTER', reference: clientName.trim(), waiterId: waiter.id })
      for (const i of cart) {
        await addDiningOrderItem(branchId, created.id, {
          productId: i.id, productName: i.name, unitPrice: i.price, quantity: i.qty,
        })
      }
      await changeDiningOrderStatus(branchId, created.id, kitchenEnabled ? 'SENT_TO_KITCHEN' : 'READY_FOR_PAYMENT')
      setDoneAction('guardar')
      setTimeout(resetAfterDone, 1500)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al guardar')
    } finally {
      setLoading(null)
    }
  }

  // Cobro directo de mostrador (solo sin cocina): abre la cuenta, la marca
  // READY_FOR_PAYMENT y la cobra con DiningOrder.checkout (mismo footprint
  // financiero: Order + Payment + CashMovement + ticket). Con cocina este
  // botón se oculta: la cuenta debe pasar por el flujo de cocina antes de cobrar.
  const handleCobrar = async () => {
    if (cart.length === 0 || !branchId || !waiter) return
    setLoading('cobrar')
    setError(null)
    try {
      const reference = clientName.trim() || 'Mostrador'
      const created = await openDiningOrder(branchId, { serviceType: 'COUNTER', reference, waiterId: waiter.id })
      for (const i of cart) {
        await addDiningOrderItem(branchId, created.id, {
          productId: i.id, productName: i.name, unitPrice: i.price, quantity: i.qty,
        })
      }
      await changeDiningOrderStatus(branchId, created.id, 'READY_FOR_PAYMENT')
      const result = await checkoutDiningOrder(branchId, created.id, [{ paymentMethod, amount: cartTotal }])
      printOrder(result.id)
      setDoneAction('cobrar')
      setTimeout(resetAfterDone, 1500)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al cobrar')
    } finally {
      setLoading(null)
    }
  }

  if (doneAction) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <div className="text-center">
          <div className="text-xl font-extrabold text-foreground">
            {doneAction === 'cobrar' ? '¡Cobrado!' : '¡Pedido guardado!'}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {doneAction === 'cobrar' ? 'Cobro directo procesado' : `A nombre de: ${clientName}`}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Product catalog */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="text-[13px] font-extrabold text-foreground mb-2.5 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary" />
            Productos
          </div>
          <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="border-none bg-transparent outline-none text-[13px] text-foreground w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="border-none bg-transparent cursor-pointer text-muted-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {catalogLoading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Cargando…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <Search className="w-6 h-6 opacity-30" />
              <span className="text-xs">{search ? 'Sin resultados' : 'Sin productos'}</span>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
              {filtered.map(p => {
                const inCart = cart.find(i => i.id === p.id)?.qty ?? 0
                const agotado = p.trackInventory && p.stock === 0
                return (
                  <button
                    key={p.id}
                    onClick={() => !agotado && addToCart(p)}
                    disabled={agotado}
                    className={`relative rounded-xl border-2 p-3 text-left transition-all flex flex-col gap-1
                      ${agotado ? 'opacity-40 cursor-not-allowed border-border' : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-95'}
                      ${inCart > 0 ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
                    style={{ minHeight: 100 }}
                  >
                    {inCart > 0 && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-extrabold text-primary-foreground">
                        {inCart}
                      </div>
                    )}
                    <div className="text-[12px] font-bold text-foreground leading-snug line-clamp-2 flex-1 pr-5">{p.name}</div>
                    <div className="text-[11px] font-extrabold text-primary">{fmtComandaMoney(p.price)}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart + actions */}
      <div className="w-[280px] shrink-0 flex flex-col overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border shrink-0 text-[12px] font-extrabold text-foreground">
          Resumen
        </div>

        {/* Client name */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
            A nombre de
          </label>
          <input
            type="text"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="Nombre del cliente…"
            className="w-full px-3 py-2 border border-border rounded-lg text-[12px] bg-muted text-foreground outline-none focus:border-primary focus:bg-card transition-colors"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-28 gap-2 text-muted-foreground">
              <ShoppingBag className="w-6 h-6 opacity-25" />
              <span className="text-xs">Agrega productos</span>
            </div>
          ) : cart.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-foreground truncate">{item.name}</div>
                <div className="text-[11px] text-muted-foreground">{fmtComandaMoney(item.price)}</div>
              </div>
              <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
                <button
                  onClick={() => adjustCart(item.id, -1)}
                  className="w-7 h-7 bg-muted border-none cursor-pointer flex items-center justify-center hover:bg-muted/80 text-muted-foreground"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-7 text-center text-[12px] font-bold text-foreground">{item.qty}</span>
                <button
                  onClick={() => adjustCart(item.id, 1)}
                  className="w-7 h-7 bg-muted border-none cursor-pointer flex items-center justify-center hover:bg-muted/80 text-muted-foreground"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="text-[12px] font-bold text-foreground w-[60px] text-right shrink-0">
                {fmtComandaMoney(item.price * item.qty)}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-4 border-t border-border shrink-0 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[12px] font-semibold text-muted-foreground">Total</span>
            <span className="text-xl font-extrabold text-foreground">{fmtComandaMoney(cartTotal)}</span>
          </div>

          {/* Payment method — only relevant for cobrar */}
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENT_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg border-2 text-[10px] font-semibold transition-all cursor-pointer
                    ${paymentMethod === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              )
            })}
          </div>

          {error && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Mesero: chip si ya está identificado; PIN si falta. El PIN persiste
              entre operaciones (comanda/caja), así no se vuelve a pedir. */}
          {waiter ? (
            <div className="flex items-center justify-between gap-2 text-[11px] bg-muted/40 border border-border rounded-lg px-2.5 py-1.5">
              <span className="text-muted-foreground truncate">Mesero: <span className="font-semibold text-foreground">{waiterFullName(waiter)}</span></span>
            </div>
          ) : (
            <div className="space-y-1.5 bg-muted/30 border border-border rounded-lg p-2.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Identifica al mesero (PIN)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') handleVerifyPin() }}
                  placeholder="••••"
                  className="flex-1 min-w-0 px-3 py-2 border border-border rounded-lg text-[13px] tracking-widest bg-card text-foreground outline-none focus:border-primary"
                />
                <button
                  onClick={handleVerifyPin}
                  disabled={verifying || pin.length < 4}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-[12px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Validar'}
                </button>
              </div>
              {pinError && <div className="text-[11px] text-red-600">{pinError}</div>}
            </div>
          )}

          {/* Guardar pedido / Enviar a cocina */}
          <button
            onClick={handleGuardar}
            disabled={cart.length === 0 || !clientName.trim() || !waiter || loading !== null}
            className="w-full py-2.5 bg-muted border border-border text-foreground rounded-xl text-[12px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/80 transition-colors flex items-center justify-center gap-2"
          >
            {loading === 'guardar'
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{kitchenEnabled ? 'Enviando…' : 'Guardando…'}</>
              : <>{kitchenEnabled ? 'Enviar a cocina' : 'Guardar pedido'} {clientName.trim() ? `· ${clientName.trim()}` : ''}</>
            }
          </button>

          {/* Cobro directo: solo sin cocina. Con cocina la cuenta debe pasar por
              el flujo de preparación antes de poder cobrarse. */}
          {!kitchenEnabled && (
            <button
              onClick={handleCobrar}
              disabled={cart.length === 0 || !waiter || loading !== null}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-[13px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {loading === 'cobrar'
                ? <><Loader2 className="w-4 h-4 animate-spin" />Procesando…</>
                : <><Check className="w-4 h-4" />Cobrar {fmtComandaMoney(cartTotal)}</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <CreditCard className="w-8 h-8 opacity-30" />
      </div>
      <div className="text-center space-y-1">
        <div className="text-[14px] font-semibold text-foreground">Selecciona una mesa</div>
        <div className="text-[13px]">o inicia un cobro directo desde el panel izquierdo</div>
      </div>
      <div className="flex items-center gap-1.5 text-[12px] bg-muted/50 rounded-xl px-3 py-2 mt-1">
        <ChevronRight className="w-3.5 h-3.5 rotate-180" />
        Elige una mesa abierta o haz clic en "Cobro directo"
      </div>
    </div>
  )
}

// ─── Retiro para insumos (con autorización admin) ──────────────────────────────

interface WithdrawalLine {
  key: string
  supplyId: string
  quantity: string
  unitCost: string
}

function supplyUnitLabel(s: Supply): string {
  return s.inventoryUnit?.symbol ?? s.unit
}

function newLine(): WithdrawalLine {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, supplyId: '', quantity: '', unitCost: '' }
}

function SupplyWithdrawalModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [loadingSupplies, setLoadingSupplies] = useState(true)
  const [lines, setLines] = useState<WithdrawalLine[]>([newLine()])
  const [notes, setNotes] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSupplies()
      .then(res => setSupplies((res.data ?? []).filter(s => s.status === 'ACTIVE')))
      .catch(() => setError('No se pudieron cargar los insumos'))
      .finally(() => setLoadingSupplies(false))
  }, [])

  const setLine = (key: string, patch: Partial<WithdrawalLine>) =>
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)))
  const addLine = () => setLines(prev => [...prev, newLine()])
  const removeLine = (key: string) => setLines(prev => (prev.length > 1 ? prev.filter(l => l.key !== key) : prev))

  const lineTotal = (l: WithdrawalLine) => (Number(l.quantity) || 0) * (Number(l.unitCost) || 0)
  const grandTotal = lines.reduce((acc, l) => acc + lineTotal(l), 0)

  const handleSubmit = async () => {
    setError(null)
    const items = lines
      .filter(l => l.supplyId && Number(l.quantity) > 0)
      .map(l => ({ supplyId: l.supplyId, quantity: Number(l.quantity), lineCost: lineTotal(l) }))

    if (items.length === 0) { setError('Agrega al menos un insumo con cantidad.'); return }
    if (grandTotal <= 0) { setError('El monto del retiro debe ser mayor a 0.'); return }
    if (!authEmail.trim() || !authPassword.trim()) { setError('Ingresa el correo y contraseña del administrador.'); return }

    setSubmitting(true)
    try {
      await withdrawForSupplies({ items, notes: notes.trim() || undefined, authEmail: authEmail.trim(), authPassword })
      onDone()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } }; message?: string }
      const msg = err?.response?.data?.message
      setError(Array.isArray(msg) ? msg.join(' ') : msg ?? err?.message ?? 'Error al registrar el retiro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <PackagePlus className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <div className="text-[15px] font-extrabold text-foreground">Retiro para insumos</div>
              <div className="text-[11px] text-muted-foreground">Sale efectivo de caja y se suma al stock</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loadingSupplies ? (
            <div className="flex items-center justify-center h-24 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Cargando insumos…</span>
            </div>
          ) : (
            <>
              {lines.map(l => {
                const supply = supplies.find(s => s.id === l.supplyId)
                return (
                  <div key={l.key} className="border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={l.supplyId}
                        onChange={e => setLine(l.key, { supplyId: e.target.value })}
                        className="flex-1 min-w-0 px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                      >
                        <option value="">Selecciona un insumo…</option>
                        {supplies.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({supplyUnitLabel(s)})</option>
                        ))}
                      </select>
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(l.key)} className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer text-muted-foreground hover:text-red-500 hover:bg-muted shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Cantidad {supply ? `(${supplyUnitLabel(supply)})` : ''}
                        </label>
                        <input
                          type="number" min={0} step="any" value={l.quantity}
                          onChange={e => setLine(l.key, { quantity: e.target.value })}
                          placeholder="0"
                          className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Costo unitario
                        </label>
                        <input
                          type="number" min={0} step="any" value={l.unitCost}
                          onChange={e => setLine(l.key, { unitCost: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                    <div className="text-right text-[12px] text-muted-foreground">
                      Subtotal: <span className="font-bold text-foreground">{fmtComandaMoney(lineTotal(l))}</span>
                    </div>
                  </div>
                )
              })}

              <button
                onClick={addLine}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-border text-[12px] font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar otro insumo
              </button>

              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Notas / proveedor (opcional)
                </label>
                <input
                  type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Ej. Verdulería La Central"
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                />
              </div>

              {/* Authorization */}
              <div className="border border-orange-200 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-900/10 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-600 dark:text-orange-400">
                  <Lock className="w-3.5 h-3.5" /> Autorización de administrador
                </div>
                <input
                  type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                  placeholder="Correo del administrador" autoComplete="off"
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                />
                <input
                  type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                  placeholder="Contraseña" autoComplete="new-password"
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-red-600 text-[12px] bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[12px] font-semibold text-muted-foreground">Total a retirar</span>
            <span className="text-xl font-extrabold text-orange-500">{fmtComandaMoney(grandTotal)}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || loadingSupplies}
            className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-xl text-[14px] font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando…</>
              : <><Banknote className="w-4 h-4" /> Retirar {fmtComandaMoney(grandTotal)}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CajaRestaurante() {
  const branchId = useAuthStore((s) => s.currentBranch?.id ?? null)
  // Cocina por MÓDULO habilitado (mismo criterio que el backend y Comanda web).
  const kitchenEnabled = useAuthStore((s) => s.enabledModules.includes('kitchen'))
  const [tables, setTables] = useState<DiningOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [panelMode, setPanelMode] = useState<PanelMode>('empty')
  const [selectedTable, setSelectedTable] = useState<DiningOrder | null>(null)
  const [withdrawalOpen, setWithdrawalOpen] = useState(false)
  const [withdrawalToast, setWithdrawalToast] = useState<string | null>(null)

  const loadTables = useCallback(async () => {
    if (!branchId) { setTables([]); setLoading(false); return }
    setLoading(true)
    try {
      // Cuentas del branch listas para cobrar (DELIVERED / READY_FOR_PAYMENT).
      // La caja ve TODAS las cuentas, sin filtrar por mesero.
      const data = await getActiveDiningOrders(branchId)
      setTables(data.filter(isPayableDiningOrder))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => { loadTables() }, [loadTables])

  const selectTable = (table: DiningOrder) => {
    setSelectedTable(table)
    setPanelMode('table')
  }

  const handleTableSuccess = () => {
    setPanelMode('empty')
    setSelectedTable(null)
    loadTables()
  }

  const handleDirectSuccess = () => {
    loadTables()
  }

  const openDirect = () => {
    setSelectedTable(null)
    setPanelMode('direct')
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: open tables list ── */}
      <div className="w-[320px] shrink-0 border-r border-border flex flex-col bg-card overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
          <div className="text-[13px] font-extrabold text-foreground">
            Mesas abiertas
            {tables.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-primary text-primary-foreground rounded-full text-[10px] font-bold">
                {tables.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWithdrawalOpen(true)}
              title="Retiro para insumos (requiere autorización de administrador)"
              className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer text-muted-foreground hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-500 transition-colors"
            >
              <PackagePlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={loadTables}
              disabled={loading}
              title="Actualizar"
              className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Cobro directo button */}
        <button
          onClick={openDirect}
          className={`mx-3 mt-3 mb-1 flex items-center gap-2.5 px-3.5 py-3 rounded-xl border-2 text-left transition-all cursor-pointer
            ${panelMode === 'direct'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-muted/30'
            }`}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
            ${panelMode === 'direct' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[12px] font-bold">Cobro directo</div>
            <div className="text-[10px] opacity-70">Sin comanda previa</div>
          </div>
        </button>

        {/* Tables */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Cargando mesas…</span>
            </div>
          ) : tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <UtensilsCrossed className="w-7 h-7 opacity-25" />
              <span className="text-sm">No hay mesas abiertas</span>
            </div>
          ) : (
            tables.map(table => (
              <TableCard
                key={table.id}
                order={table}
                selected={panelMode === 'table' && selectedTable?.id === table.id}
                onClick={() => selectTable(table)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: action panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {panelMode === 'empty' && <EmptyState />}
        {panelMode === 'table' && selectedTable && branchId && (
          <TableCheckoutPanel
            key={selectedTable.id}
            branchId={branchId}
            order={selectedTable}
            onSuccess={handleTableSuccess}
          />
        )}
        {panelMode === 'direct' && branchId && (
          <DirectCheckoutPanel branchId={branchId} kitchenEnabled={kitchenEnabled} onSuccess={handleDirectSuccess} />
        )}
      </div>

      {/* Retiro para insumos modal */}
      {withdrawalOpen && (
        <SupplyWithdrawalModal
          onClose={() => setWithdrawalOpen(false)}
          onDone={() => {
            setWithdrawalOpen(false)
            setWithdrawalToast('Retiro registrado: efectivo descontado de caja y stock actualizado.')
            setTimeout(() => setWithdrawalToast(null), 4000)
          }}
        />
      )}

      {/* Toast de éxito */}
      {withdrawalToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-[13px] font-semibold">
          <Check className="w-4 h-4" /> {withdrawalToast}
        </div>
      )}
    </div>
  )
}
