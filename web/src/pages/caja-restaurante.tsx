import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, CreditCard, Banknote, ArrowLeftRight,
  Search, X, Plus, Minus, Loader2, Check, UtensilsCrossed,
  Clock, ShoppingBag, AlertCircle, ChevronRight,
} from 'lucide-react'
import {
  getOpenTables, checkoutComanda, directCheckout, createComanda, fmtComandaMoney,
  type OpenTable, type DirectCheckoutItem,
} from '@/services/retail/comanda-service'
import { fetchProducts, type Product } from '@/services/retail/product-service'
import { printOrder } from '@/services/core/print-service'

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

function isNumericTable(t: string) { return /^\d+$/.test(t.trim()) }

function TableCard({
  table,
  selected,
  onClick,
}: {
  table: OpenTable
  selected: boolean
  onClick: () => void
}) {
  const total = Number(table.total)
  const isTable = isNumericTable(table.tableNumber)
  const label = isTable ? `Mesa ${table.tableNumber}` : table.tableNumber
  const sublabel = isTable
    ? table.employeeNumber ? `Emp. ${table.employeeNumber}` : null
    : table.employeeNumber ? `Emp. ${table.employeeNumber}` : 'Pedido directo'

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
            {isTable ? <UtensilsCrossed className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold text-foreground truncate">{label}</div>
            {sublabel && <div className="text-[11px] text-muted-foreground truncate">{sublabel}</div>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[15px] font-extrabold text-foreground">{fmtComandaMoney(total)}</div>
          <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
            <Clock className="w-3 h-3" />{timeAgo(table.createdAt)}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        {table.items.length} artículo{table.items.length !== 1 ? 's' : ''}
      </div>
    </button>
  )
}

// ─── Right panel: order detail + checkout ────────────────────────────────────

function TableCheckoutPanel({
  table,
  onSuccess,
}: {
  table: OpenTable
  onSuccess: () => void
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const total = Number(table.total)

  const handleCobrar = async () => {
    setLoading(true)
    setError(null)
    try {
      await checkoutComanda(table.id, paymentMethod)
      printOrder(table.id)
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
          <div className="text-sm text-muted-foreground mt-1">Mesa {table.tableNumber}</div>
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
            {isNumericTable(table.tableNumber)
              ? <UtensilsCrossed className="w-4 h-4 text-primary" />
              : <ShoppingBag className="w-4 h-4 text-primary" />
            }
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-foreground">
              {isNumericTable(table.tableNumber) ? `Mesa ${table.tableNumber}` : table.tableNumber}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />{timeAgo(table.createdAt)}
              {table.employeeNumber && <> · Emp. {table.employeeNumber}</>}
            </div>
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
          Detalle del pedido
        </div>
        {table.items.map(item => (
          <div key={item.id} className="flex items-center justify-between px-6 py-3 border-b border-border/50 hover:bg-muted/20 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                {item.quantity}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-foreground truncate">{item.name}</div>
                {item.sku && <div className="text-[10px] text-muted-foreground font-mono">{item.sku}</div>}
              </div>
            </div>
            <div className="text-[13px] font-bold text-foreground shrink-0 ml-4">
              {fmtComandaMoney(item.total)}
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

function DirectCheckoutPanel({ onSuccess }: { onSuccess: () => void }) {
  const [products, setProducts] = useState<Product[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [clientName, setClientName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [loading, setLoading] = useState<DirectAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [doneAction, setDoneAction] = useState<DirectAction | null>(null)

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

  const handleGuardar = async () => {
    if (cart.length === 0 || !clientName.trim()) return
    setLoading('guardar')
    setError(null)
    try {
      await createComanda({
        tableNumber: clientName.trim(),
        items: cart.map(i => ({ itemType: 'PRODUCT', productId: i.id, name: i.name, price: i.price, quantity: i.qty })),
      })
      setDoneAction('guardar')
      setTimeout(() => {
        setDoneAction(null)
        setCart([])
        setClientName('')
        setSearch('')
        onSuccess()
      }, 1500)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      setError(err?.response?.data?.message ?? err?.message ?? 'Error al guardar')
    } finally {
      setLoading(null)
    }
  }

  const handleCobrar = async () => {
    if (cart.length === 0) return
    setLoading('cobrar')
    setError(null)
    try {
      const items: DirectCheckoutItem[] = cart.map(i => ({
        productId: i.id,
        name: i.name,
        price: i.price,
        quantity: i.qty,
      }))
      const created = await directCheckout(items, paymentMethod)
      printOrder(created.id)
      setDoneAction('cobrar')
      setTimeout(() => {
        setDoneAction(null)
        setCart([])
        setClientName('')
        setSearch('')
        onSuccess()
      }, 1500)
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

          {/* Guardar pedido */}
          <button
            onClick={handleGuardar}
            disabled={cart.length === 0 || !clientName.trim() || loading !== null}
            className="w-full py-2.5 bg-muted border border-border text-foreground rounded-xl text-[12px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/80 transition-colors flex items-center justify-center gap-2"
          >
            {loading === 'guardar'
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Guardando…</>
              : <>Guardar pedido {clientName.trim() ? `· ${clientName.trim()}` : ''}</>
            }
          </button>

          {/* Cobrar ahora */}
          <button
            onClick={handleCobrar}
            disabled={cart.length === 0 || loading !== null}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-[13px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {loading === 'cobrar'
              ? <><Loader2 className="w-4 h-4 animate-spin" />Procesando…</>
              : <><Check className="w-4 h-4" />Cobrar {fmtComandaMoney(cartTotal)}</>
            }
          </button>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CajaRestaurante() {
  const [tables, setTables] = useState<OpenTable[]>([])
  const [loading, setLoading] = useState(true)
  const [panelMode, setPanelMode] = useState<PanelMode>('empty')
  const [selectedTable, setSelectedTable] = useState<OpenTable | null>(null)

  const loadTables = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getOpenTables()
      setTables(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTables() }, [loadTables])

  const selectTable = (table: OpenTable) => {
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
          <button
            onClick={loadTables}
            disabled={loading}
            title="Actualizar"
            className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
                table={table}
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
        {panelMode === 'table' && selectedTable && (
          <TableCheckoutPanel
            key={selectedTable.id}
            table={selectedTable}
            onSuccess={handleTableSuccess}
          />
        )}
        {panelMode === 'direct' && (
          <DirectCheckoutPanel onSuccess={handleDirectSuccess} />
        )}
      </div>
    </div>
  )
}
