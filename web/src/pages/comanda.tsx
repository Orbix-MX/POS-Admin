import { useState, useEffect, useCallback } from 'react'
import {
  Search, X, Check, Loader2, Plus, Minus, ShoppingCart,
  ChevronRight, UtensilsCrossed, Clock, ArrowLeft,
} from 'lucide-react'
import { fetchProducts, type Product } from '@/services/retail/product-service'
import { printOrder } from '@/services/core/print-service'
import {
  createComanda, addItemsToComanda, getOpenTables, fmtComandaMoney,
  type OpenTable,
} from '@/services/retail/comanda-service'

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diff < 1) return 'ahora'
  if (diff < 60) return `${diff} min`
  return `${Math.floor(diff / 60)} h`
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
      <div className="text-base font-extrabold text-primary mt-1">{fmtComandaMoney(p.price)}</div>
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
          <div className="text-[11px] text-muted-foreground">{fmtComandaMoney(item.price)} c/u</div>
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
          {fmtComandaMoney(item.price * item.qty)}
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
  order, onContinue, loading,
}: { order: OpenTable; onContinue: () => void; loading: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[15px] font-extrabold text-foreground">Mesa {order.tableNumber}</div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {order.guestCount != null && (
              <span className="text-[11px] text-muted-foreground">
                👤 {order.guestCount} persona{order.guestCount !== 1 ? 's' : ''}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground font-mono">{order.orderNumber}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
          <Clock className="w-3 h-3" />
          {timeAgo(order.createdAt)}
        </div>
      </div>

      {/* Items summary */}
      <div className="flex flex-col gap-1">
        {order.items.slice(0, 4).map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="w-5 h-5 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
              {item.quantity}
            </span>
            <span className="flex-1 text-foreground truncate">{item.name}</span>
            <span className="text-muted-foreground shrink-0">{fmtComandaMoney(item.price)}</span>
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
          Total: {fmtComandaMoney(order.total)}
        </div>
        <button
          onClick={onContinue}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-[12px] font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Agregar productos
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Comanda() {
  const [stage, setStage] = useState<ComandaStage>('login')

  // Login fields
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [loginError, setLoginError]         = useState('')
  const [loginLoading, setLoginLoading]     = useState(false)

  // Open orders
  const [openOrders, setOpenOrders]       = useState<OpenTable[]>([])
  const [newTableInput, setNewTableInput] = useState('')
  const [guestCount, setGuestCount]       = useState('')
  const [tableError, setTableError]       = useState('')

  // Ordering state
  const [activeOrderId, setActiveOrderId]         = useState<string | null>(null)
  const [activeOrder, setActiveOrder]             = useState<OpenTable | null>(null)
  const [activeTable, setActiveTable]             = useState('')
  const [products, setProducts]                   = useState<Product[]>([])
  const [categories, setCategories]               = useState<{ id: string; name: string }[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading]       = useState(false)
  const [search, setSearch]                       = useState('')
  const [cart, setCart]                           = useState<LocalCartItem[]>([])
  const [sending, setSending]                     = useState(false)
  const [sendError, setSendError]                 = useState<string | null>(null)

  // Success
  const [successTable, setSuccessTable] = useState('')

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

  // ── Auto-return after success ────────────────────────────────────────────────

  useEffect(() => {
    if (stage !== 'success') return
    const t = setTimeout(() => {
      setStage('login')
      setEmployeeNumber(''); setLoginError('')
      setOpenOrders([]); setNewTableInput(''); setGuestCount(''); setTableError('')
      setActiveOrderId(null); setActiveOrder(null); setActiveTable('')
      setCart([]); setSendError(null); setSearch(''); setSelectedCategoryId(null)
    }, 2500)
    return () => clearTimeout(t)
  }, [stage])

  // ── Login ────────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!employeeNumber.trim()) {
      setLoginError('Por favor ingresa tu número de empleado.')
      return
    }
    setLoginError('')
    setLoginLoading(true)
    try {
      const all = await getOpenTables()
      const mine = all.filter(
        o => o.employeeNumber?.toLowerCase() === employeeNumber.trim().toLowerCase(),
      )
      setOpenOrders(mine)
      setStage('open-orders')
    } catch {
      setLoginError('Error al cargar pedidos. Intenta de nuevo.')
    } finally {
      setLoginLoading(false)
    }
  }

  // ── Open orders → ordering ────────────────────────────────────────────────────

  const handleContinueOrder = (order: OpenTable) => {
    setActiveOrderId(order.id)
    setActiveOrder(order)
    setActiveTable(order.tableNumber)
    setCart([])
    setSendError(null)
    setSearch('')
    setSelectedCategoryId(null)
    setStage('ordering')
  }

  const handleNewOrder = () => {
    const t = newTableInput.trim()
    const g = parseInt(guestCount, 10)
    if (!t && !g) { setTableError('Ingresa la mesa y el número de personas.'); return }
    if (!t) { setTableError('Ingresa el número o nombre de mesa.'); return }
    if (!guestCount.trim() || isNaN(g) || g < 1) { setTableError('Ingresa el número de personas (mínimo 1).'); return }
    setTableError('')
    setActiveOrderId(null)
    setActiveOrder(null)
    setActiveTable(t)
    setCart([])
    setSendError(null)
    setSearch('')
    setSelectedCategoryId(null)
    setStage('ordering')
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

  const handleSend = async () => {
    if (cart.length === 0) return
    setSending(true); setSendError(null)
    try {
      const items = cart.map(i => ({
        itemType: 'PRODUCT' as const,
        productId: i.id,
        name: i.name,
        quantity: i.qty,
        price: i.price,
        ...(i.comment.trim() && { notes: i.comment.trim() }),
      }))

      let orderId: string
      if (activeOrderId) {
        const updated = await addItemsToComanda(activeOrderId, items)
        orderId = updated.id
      } else {
        const created = await createComanda({
          tableNumber: activeTable,
          employeeNumber: employeeNumber.trim(),
          guestCount: parseInt(guestCount, 10),
          items,
        })
        orderId = created.id
      }
      printOrder(orderId, 'TICKET')
      setSuccessTable(activeTable)
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

  // ══ Stage: login ══════════════════════════════════════════════════════════════

  if (stage === 'login') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen p-6 bg-background">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UtensilsCrossed className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">Captura de Comanda</h1>
            <p className="text-sm text-muted-foreground">Ingresa tus datos para continuar</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[12px] font-semibold text-muted-foreground block mb-1.5">
                Número de empleado
              </label>
              <input
                type="text"
                value={employeeNumber}
                onChange={e => setEmployeeNumber(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
                placeholder="Ej. EMP-001"
                autoFocus
                className="w-full px-4 py-3 border border-border rounded-xl text-[14px] bg-muted text-foreground outline-none focus:border-primary focus:bg-card transition-colors"
              />
            </div>

            {loginError && (
              <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loginLoading || !employeeNumber.trim()}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-[15px] font-bold cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loginLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</>
                : <>Ver mis mesas <ChevronRight className="w-4 h-4" /></>
              }
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══ Stage: open-orders ════════════════════════════════════════════════════════

  if (stage === 'open-orders') {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-background">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-card shrink-0 flex items-center gap-3">
          <button
            onClick={() => setStage('login')}
            className="p-2 rounded-xl hover:bg-muted cursor-pointer border-none bg-transparent transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <div className="text-[15px] font-extrabold text-foreground">
              Empleado {employeeNumber}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {openOrders.length > 0
                ? `${openOrders.length} pedido${openOrders.length !== 1 ? 's' : ''} abierto${openOrders.length !== 1 ? 's' : ''}`
                : 'Sin pedidos abiertos'}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* ── Abrir mesa (arriba del grid) ──────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
            <div className="text-[13px] font-bold text-foreground flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Abrir mesa
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTableInput}
                onChange={e => { setNewTableInput(e.target.value); setTableError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleNewOrder() }}
                placeholder="Mesa / Número…"
                className="flex-1 min-w-0 px-3.5 py-2.5 border border-border rounded-xl text-[13px] bg-muted text-foreground outline-none focus:border-primary focus:bg-card transition-colors"
              />
              <input
                type="number"
                min={1}
                value={guestCount}
                onChange={e => { setGuestCount(e.target.value); setTableError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleNewOrder() }}
                placeholder="Personas *"
                className="w-28 shrink-0 px-3.5 py-2.5 border border-border rounded-xl text-[13px] bg-muted text-foreground outline-none focus:border-primary focus:bg-card transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={handleNewOrder}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-[13px] font-bold cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Abrir
              </button>
            </div>
            {tableError && (
              <div className="text-[12px] text-red-600 -mt-1">{tableError}</div>
            )}
          </div>

          {/* ── Grid de mesas abiertas ─────────────────────────────────────── */}
          {openOrders.length > 0 ? (
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-0.5">
                Mesas abiertas · {openOrders.length}
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {openOrders.map(order => (
                  <OpenOrderCard
                    key={order.id}
                    order={order}
                    onContinue={() => handleContinueOrder(order)}
                    loading={false}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <UtensilsCrossed className="w-10 h-10 text-muted-foreground/30" />
              <div className="text-[13px] font-semibold text-muted-foreground">Sin mesas abiertas</div>
              <div className="text-[11px] text-muted-foreground/60">Abre una mesa para comenzar a tomar pedidos</div>
            </div>
          )}
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
              {activeOrderId ? '¡Productos agregados!' : '¡Comanda enviada!'}
            </h2>
            <p className="text-muted-foreground mt-1 text-base">Mesa {successTable}</p>
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
              Mesa {activeTable} · Empleado {employeeNumber}
              {activeOrderId && <span className="ml-2 text-[11px] font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Agregando a pedido existente</span>}
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
              {activeOrderId ? 'Agregando a pedido' : 'Pedido nuevo'}
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
                {activeOrder.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2 opacity-60">
                    <span className="text-[11px] font-bold text-muted-foreground w-5 text-center shrink-0">
                      {item.quantity}
                    </span>
                    <span className="flex-1 text-[12px] text-foreground truncate">{item.name}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {fmtComandaMoney(item.price)}
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
                  {activeOrderId ? 'Toca un producto para agregarlo' : 'Toca un producto para agregarlo al pedido'}
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
                <span className="text-xl font-extrabold text-foreground">{fmtComandaMoney(cartTotal)}</span>
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
              ) : activeOrderId ? (
                <><Plus className="w-4 h-4" /> Agregar al pedido</>
              ) : (
                <><Check className="w-4 h-4" /> Enviar pedido</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
