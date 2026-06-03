import { useState, useEffect, useCallback } from 'react'
import { Search, X, Check, Loader2, Plus, Minus, ShoppingCart, ChevronRight } from 'lucide-react'
import { fetchProducts, type Product } from '@/services/retail/product-service'
import { createComanda, fmtComandaMoney } from '@/services/retail/comanda-service'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalCartItem {
  id: string
  name: string
  sku: string
  price: number
  qty: number
}

type ComandaStage = 'login' | 'ordering' | 'success'

// ─── Product Card ─────────────────────────────────────────────────────────────

function ComandaProductCard({ p, inCartQty, onAdd }: { p: Product; inCartQty: number; onAdd: () => void }) {
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

function CartItemRow({ item, onPlus, onMinus }: { item: LocalCartItem; onPlus: () => void; onMinus: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-foreground truncate">{item.name}</div>
        <div className="text-[11px] text-muted-foreground">{fmtComandaMoney(item.price)} c/u</div>
      </div>
      <div className="flex items-center border border-border rounded-xl overflow-hidden shrink-0">
        <button
          onClick={onMinus}
          className="w-8 h-8 border-none bg-muted cursor-pointer text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="w-8 text-center text-sm font-bold text-foreground">{item.qty}</span>
        <button
          onClick={onPlus}
          className="w-8 h-8 border-none bg-muted cursor-pointer text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="text-sm font-extrabold text-foreground w-[70px] text-right shrink-0">
        {fmtComandaMoney(item.price * item.qty)}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Comanda() {
  const [stage, setStage] = useState<ComandaStage>('login')

  // login fields
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [loginError, setLoginError] = useState('')

  // ordering state
  const [products, setProducts] = useState<Product[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<LocalCartItem[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // success state
  const [successTable, setSuccessTable] = useState('')

  // Load products when entering ordering stage
  const loadProducts = useCallback(async () => {
    setCatalogLoading(true)
    try {
      const res = await fetchProducts()
      const list = res.data ?? []
      setProducts(list.filter(p => p.status === 'ACTIVE'))
    } catch {
      // silent — products simply won't show
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    if (stage === 'ordering') {
      loadProducts()
    }
  }, [stage, loadProducts])

  // Auto-return to login after success
  useEffect(() => {
    if (stage === 'success') {
      const t = setTimeout(() => {
        setStage('login')
        setEmployeeNumber('')
        setTableNumber('')
        setLoginError('')
        setCart([])
        setSendError(null)
        setSearch('')
      }, 2500)
      return () => clearTimeout(t)
    }
  }, [stage])

  const handleLogin = () => {
    if (!employeeNumber.trim() || !tableNumber.trim()) {
      setLoginError('Por favor ingresa el número de empleado y el número de mesa.')
      return
    }
    setLoginError('')
    setCart([])
    setSendError(null)
    setSearch('')
    setStage('ordering')
  }

  const handleAddToCart = (p: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === p.id)
      if (existing) {
        return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { id: p.id!, name: p.name, sku: p.sku, price: Number(p.price), qty: 1 }]
    })
  }

  const handleCartPlus = (id: string) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i))
  }

  const handleCartMinus = (id: string) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id)
      if (!item) return prev
      if (item.qty <= 1) return prev.filter(i => i.id !== id)
      return prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i)
    })
  }

  const cartTotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0)

  const handleSend = async () => {
    if (cart.length === 0) return
    setSending(true)
    setSendError(null)
    try {
      await createComanda({
        tableNumber: tableNumber.trim(),
        employeeNumber: employeeNumber.trim(),
        items: cart.map(i => ({
          itemType: 'PRODUCT',
          productId: i.id,
          name: i.name,
          quantity: i.qty,
          price: i.price,
        })),
      })
      setSuccessTable(tableNumber.trim())
      setStage('success')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      const msg = err?.response?.data?.message ?? err?.message ?? 'Error al enviar la comanda'
      setSendError(msg)
    } finally {
      setSending(false)
    }
  }

  const filteredProducts = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  )

  // ── Login Stage ──────────────────────────────────────────────────────────────
  if (stage === 'login') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-120px)] p-6">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">Captura de Comanda</h1>
            <p className="text-sm text-muted-foreground">Ingresa los datos para continuar</p>
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

            <div>
              <label className="text-[12px] font-semibold text-muted-foreground block mb-1.5">
                Mesa número
              </label>
              <input
                type="text"
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
                placeholder="Ej. 5"
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
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-[15px] font-bold cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Success Stage ────────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-120px)] p-6">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-foreground">¡Comanda enviada!</h2>
            <p className="text-muted-foreground mt-1 text-base">Mesa {successTable}</p>
          </div>
          <p className="text-sm text-muted-foreground">Regresando en unos segundos…</p>
        </div>
      </div>
    )
  }

  // ── Ordering Stage ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold text-foreground truncate">
              Mesa {tableNumber} · Empleado {employeeNumber}
            </div>
            <div className="text-[11px] text-muted-foreground">{cart.length} producto{cart.length !== 1 ? 's' : ''} en pedido</div>
          </div>
        </div>
        <button
          onClick={() => setStage('login')}
          className="p-2 rounded-xl hover:bg-muted cursor-pointer border-none bg-transparent transition-colors shrink-0"
          title="Cancelar y volver"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Body: catalog + cart */}
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
                <button
                  onClick={() => setSearch('')}
                  className="border-none bg-transparent cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {catalogLoading ? (
              <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Cargando productos…</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                <Search className="w-8 h-8 opacity-30" />
                <span className="text-sm">{search ? 'Sin resultados para la búsqueda' : 'No hay productos disponibles'}</span>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
                {filteredProducts.map(p => (
                  <ComandaProductCard
                    key={p.id}
                    p={p}
                    inCartQty={cart.find(i => i.id === p.id)?.qty ?? 0}
                    onAdd={() => handleAddToCart(p)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart panel */}
        <div className="w-[300px] shrink-0 border-l border-border flex flex-col bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <div className="text-[13px] font-extrabold text-foreground flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Pedido
            </div>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 gap-2 text-muted-foreground">
                <ShoppingCart className="w-8 h-8 opacity-25" />
                <span className="text-xs text-center px-4">Toca un producto para agregarlo al pedido</span>
              </div>
            ) : (
              cart.map(item => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onPlus={() => handleCartPlus(item.id)}
                  onMinus={() => handleCartMinus(item.id)}
                />
              ))
            )}
          </div>

          {/* Total + send */}
          <div className="border-t border-border px-4 py-4 shrink-0 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-muted-foreground">Total</span>
              <span className="text-xl font-extrabold text-foreground">{fmtComandaMoney(cartTotal)}</span>
            </div>

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
                <><Loader2 className="w-4 h-4 animate-spin" />Enviando…</>
              ) : (
                <><Check className="w-4 h-4" />Enviar pedido</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
