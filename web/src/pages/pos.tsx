import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ChevronLeft, Search, X, Monitor, AlertCircle,
  ShoppingCart, Check, Loader2, ChevronDown, CreditCard,
  Banknote, Landmark, Wrench, Plus, Package, FileText, ChevronUp,
  Wallet, Clock, TrendingUp, ArrowUpCircle, ArrowDownCircle, Pause,
} from 'lucide-react'
import { usePOS, fmt, type CartItem, type Product, type Cliente, type Service, type HoldSale } from '@/hooks/retail/use-pos'
import type { ServiceQuote } from '@/services/retail/cotizaciones-service'
import { PosSidebar, type PanelId } from '@/components/pos/pos-sidebar'
import { openCashSession, type ApiCashSession } from '@/services/core/caja-service'

// ─── Product card ────────────────────────────────────────────────────────────

function ProductCard({ p, inCartQty, onAdd }: { p: Product; inCartQty: number; onAdd: () => void }) {
  const agotado = p.stock === 0
  const lowStock = !agotado && p.stock <= (p.lowStockAlert ?? 5)
  return (
    <button
      onClick={onAdd}
      disabled={agotado}
      className={`bg-card border-[1.5px] rounded-xl p-3.5 text-left relative transition-all
        ${agotado ? 'opacity-50 cursor-not-allowed border-border' : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-primary'}
        ${inCartQty > 0 ? 'border-primary' : 'border-border'}`}
    >
      {inCartQty > 0 && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-extrabold text-primary-foreground">
          {inCartQty}
        </div>
      )}
      {agotado && (
        <div className="absolute top-2 left-2 text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">AGOTADO</div>
      )}
      {lowStock && !agotado && (
        <div className="absolute top-2 left-2 text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded">BAJO</div>
      )}
      <div className="text-xs font-bold text-foreground leading-snug mb-1 mt-3 line-clamp-2">{p.name}</div>
      <div className="text-[10px] text-muted-foreground mb-2 font-mono">{p.sku}</div>
      <div className="text-[15px] font-extrabold text-primary">{fmt(Number(p.price))}</div>
      <div className="text-[10px] text-muted-foreground mt-1">Stock: {p.stock}</div>
    </button>
  )
}

// ─── Service card ─────────────────────────────────────────────────────────────

function ServiceCard({ s, inCartQty, onAdd }: { s: Service; inCartQty: number; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className={`bg-card border-[1.5px] rounded-xl p-3.5 text-left relative transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-primary ${inCartQty > 0 ? 'border-primary' : 'border-border'}`}
    >
      {inCartQty > 0 && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-extrabold text-primary-foreground">
          {inCartQty}
        </div>
      )}
      <div className="absolute top-2 left-2">
        <Wrench className="w-3 h-3 text-primary/60" />
      </div>
      <div className="text-xs font-bold text-foreground leading-snug mb-1 mt-3 line-clamp-2">{s.name}</div>
      {s.estimatedDuration && (
        <div className="text-[10px] text-muted-foreground mb-1">{s.estimatedDuration}</div>
      )}
      <div className="text-[15px] font-extrabold text-primary">{fmt(Number(s.basePrice))}</div>
      {s.hasVariablePrice && (
        <div className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold mt-1 inline-block">PRECIO VARIABLE</div>
      )}
    </button>
  )
}

// ─── Cart item ───────────────────────────────────────────────────────────────

function CartRow({ item, onPlus, onMinus, onRemove }: {
  item: CartItem
  onPlus: () => void
  onMinus: () => void
  onRemove: () => void
}) {
  const isService = item.type === 'SERVICE'
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b border-border hover:bg-muted/40 transition-colors ${isService ? 'bg-primary/5' : ''}`}>
      {isService && <Wrench className="w-3 h-3 text-primary shrink-0" />}
      {!isService && <Package className="w-3 h-3 text-muted-foreground shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-foreground truncate">{item.name}</div>
        <div className="text-[10px] text-muted-foreground">{fmt(item.price)} c/u</div>
      </div>
      <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
        <button onClick={onMinus} className="w-[26px] h-[26px] border-none bg-muted cursor-pointer text-sm text-muted-foreground flex items-center justify-center hover:bg-muted/80">−</button>
        <span className="w-7 text-center text-xs font-bold text-foreground">{item.qty}</span>
        <button onClick={onPlus}  className="w-[26px] h-[26px] border-none bg-muted cursor-pointer text-sm text-muted-foreground flex items-center justify-center hover:bg-muted/80">+</button>
      </div>
      <div className="text-xs font-extrabold text-foreground w-[58px] text-right shrink-0">
        {fmt(item.price * item.qty)}
      </div>
      <button onClick={onRemove} className="w-6 h-6 border-none bg-red-100 rounded flex items-center justify-center cursor-pointer text-red-600 shrink-0 hover:bg-red-200">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Customer dropdown ───────────────────────────────────────────────────────

function ClienteDropdown({
  cliente, showDD, clienteSearch, filtrados,
  onToggle, onSearch, onSelect, onClear,
}: {
  cliente: Cliente | null
  showDD: boolean
  clienteSearch: string
  filtrados: Cliente[]
  onToggle: () => void
  onSearch: (v: string) => void
  onSelect: (c: Cliente) => void
  onClear: () => void
}) {
  return (
    <div className="relative">
      <button onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-muted cursor-pointer text-xs">
        <span className={`flex-1 text-left truncate ${cliente ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
          {cliente ? cliente.nombre : 'Seleccionar cliente (opcional)…'}
        </span>
        {cliente && (
          <span onMouseDown={e => { e.stopPropagation(); onClear() }}
            className="text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="w-3 h-3" />
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
      </button>
      {showDD && (
        <div className="absolute top-full mt-1.5 left-0 right-0 bg-card border border-border rounded-[10px] z-100 shadow-lg overflow-hidden">
          <div className="px-2.5 py-2 border-b border-border">
            <input
              value={clienteSearch}
              onChange={e => onSearch(e.target.value)}
              placeholder="Buscar cliente…"
              autoFocus
              className="w-full border-none bg-transparent outline-none text-xs text-foreground"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtrados.length === 0 ? (
              <div className="px-3.5 py-3 text-xs text-muted-foreground">Sin resultados</div>
            ) : filtrados.slice(0, 8).map(c => (
              <button key={c.id} onClick={() => onSelect(c)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-transparent border-none cursor-pointer text-left hover:bg-muted">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  {c.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{c.nombre}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{c.email}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Checkout panel ──────────────────────────────────────────────────────────

function CheckoutPanel({
  carrito, totals, checkoutVals, exchangeRate,
  cliente, clienteCanCredit, creditBlockReason,
  efectivo, setEfectivo,
  efectivoUsd, setEfectivoUsd,
  tarjeta, setTarjeta,
  checkoutError, submitting,
  layawayOrderNumber, layawayPaidAmount,
  onBack, onConfirm,
}: {
  carrito: CartItem[]
  totals: { subtotal: number; total: number; itemCount: number }
  checkoutVals: {
    total: number; ef: number; efUsd: number; efUsdEnMxn: number; tar: number
    mxnApplied: number; usdApplied: number
    cambio: number; cashChangeCurrency: 'MXN' | 'USD'
    credito: number; rawCredito: number
    hasCard: boolean; hasCredit: boolean; creditBlocked: boolean
  }
  exchangeRate: number
  cliente: Cliente | null
  clienteCanCredit: boolean
  creditBlockReason: string | null
  efectivo: string
  setEfectivo: (v: string) => void
  efectivoUsd: string
  setEfectivoUsd: (v: string) => void
  tarjeta: string
  setTarjeta: (v: string) => void
  checkoutError: string | null
  submitting: boolean
  layawayOrderNumber: string | null
  layawayPaidAmount: number
  onBack: () => void
  onConfirm: () => void
}) {
  const { total, ef, efUsd, efUsdEnMxn, credito, rawCredito, cambio, cashChangeCurrency, hasCard, creditBlocked, mxnApplied, usdApplied } = checkoutVals
  const isBlocked = creditBlocked
  const isLayaway = !!layawayOrderNumber

  return (
    <div className="flex flex-col h-full">
      {/* Layaway banner */}
      {isLayaway && (
        <div className="px-4 py-2.5 bg-purple-50 border-b border-purple-200 shrink-0">
          <div className="text-[11px] font-bold text-purple-700">Liquidando apartado {layawayOrderNumber}</div>
          <div className="flex gap-3 mt-0.5">
            <span className="text-[10px] text-green-600 font-semibold">Anticipo: {fmt(layawayPaidAmount)}</span>
            <span className="text-[10px] text-purple-600 font-semibold">Saldo: {fmt(total - layawayPaidAmount)}</span>
          </div>
        </div>
      )}
      {/* header */}
      <div className="px-4 py-3.5 border-b border-border shrink-0 flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-extrabold text-foreground">Resumen de Cobro</span>
        <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          TC: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(exchangeRate)}/USD
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* item summary */}
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Artículos ({totals.itemCount})
          </div>
          <div className="flex flex-col gap-1">
            {carrito.map(i => (
              <div key={i.id} className="flex justify-between text-xs">
                <span className="text-muted-foreground truncate max-w-[140px]">{i.name} ×{i.qty}</span>
                <span className="font-semibold text-foreground shrink-0">{fmt(i.price * i.qty)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* client */}
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cliente</div>
          <div className="text-xs text-foreground font-semibold">
            {cliente ? cliente.nombre : 'Mostrador (sin cliente)'}
          </div>
          {cliente && clienteCanCredit && (
            <div className="text-[10px] text-blue-600 mt-0.5">
              Crédito habilitado · {cliente.creditDays} días
            </div>
          )}
        </div>

        {/* payment inputs */}
        <div className="px-4 py-3 flex flex-col gap-3">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Métodos de pago</div>

          {/* MXN cash */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
              <Banknote className="w-3.5 h-3.5" /> Efectivo MXN
            </label>
            <input
              type="number" min={0} step={0.01}
              value={efectivo}
              onChange={e => setEfectivo(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-muted outline-none focus:border-primary focus:bg-card"
            />
          </div>

          {/* USD cash */}
          <div>
            <label className="text-[11px] font-semibold text-amber-600 flex items-center gap-1.5 mb-1">
              <Banknote className="w-3.5 h-3.5" /> Efectivo USD
              {efUsdEnMxn > 0 && (
                <span className="text-[10px] text-muted-foreground font-normal">
                  = {fmt(efUsdEnMxn)}
                </span>
              )}
            </label>
            <input
              type="number" min={0} step={0.01}
              value={efectivoUsd}
              onChange={e => setEfectivoUsd(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg text-[13px] text-foreground bg-muted outline-none focus:border-amber-500 focus:bg-card"
            />
          </div>

          {/* Card */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
              <CreditCard className="w-3.5 h-3.5" /> Tarjeta
            </label>
            <input
              type="number" min={0} step={0.01}
              value={tarjeta}
              onChange={e => setTarjeta(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-muted outline-none focus:border-primary focus:bg-card"
            />
          </div>

          {/* Credit — allowed */}
          {credito > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-blue-50 border-blue-200">
              <div className="flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[11px] font-semibold text-blue-700">Crédito (CxC)</span>
              </div>
              <span className="text-sm font-bold text-blue-700">{fmt(credito)}</span>
            </div>
          )}

          {/* Credit — blocked */}
          {rawCredito > 0 && isBlocked && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border bg-red-50 border-red-200">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] font-semibold text-red-700">
                  Faltan {fmt(rawCredito)} — crédito no disponible
                </div>
                <div className="text-[10px] text-red-600 mt-0.5">{creditBlockReason}</div>
              </div>
            </div>
          )}

          {/* Change summary */}
          {(mxnApplied > 0 || usdApplied > 0) && (
            <div className="flex flex-col gap-1 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-[10px] font-bold text-green-700 uppercase tracking-wide">
                Cambio en {cashChangeCurrency}
              </div>
              {mxnApplied > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-green-700">Ef. MXN recibido</span>
                  <span className="text-xs font-bold text-green-800">{fmt(ef)}</span>
                </div>
              )}
              {usdApplied > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-amber-700">Ef. USD recibido</span>
                  <span className="text-xs font-bold text-amber-800">${efUsd.toFixed(2)} USD</span>
                </div>
              )}
              <div className="h-px bg-green-200 my-0.5" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-green-700">
                  {cambio > 0 ? 'Cambio a entregar' : 'Sin cambio'}
                </span>
                <span className="text-sm font-extrabold text-green-700">
                  {cashChangeCurrency === 'USD'
                    ? `$${cambio.toFixed(2)} USD`
                    : fmt(cambio)
                  }
                </span>
              </div>
            </div>
          )}

          {hasCard && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              La venta quedará pendiente hasta confirmar el pago con tarjeta
            </div>
          )}
        </div>
      </div>

      {/* totals + actions */}
      <div className="border-t border-border px-4 py-3.5 shrink-0">
        <div className="flex flex-col gap-1.5 mb-3.5 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{fmt(totals.subtotal)}</span>
          </div>
          <div className="h-px bg-border my-1" />
          <div className="flex justify-between font-extrabold text-base">
            <span className="text-foreground">Total</span>
            <span className="text-primary">{fmt(total)}</span>
          </div>
        </div>

        {checkoutError && (
          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {checkoutError}
          </div>
        )}

        <button
          onClick={onConfirm}
          disabled={submitting || isBlocked}
          className="w-full py-3 bg-primary text-primary-foreground rounded-[9px] text-[13px] font-extrabold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
            : hasCard
              ? <><CreditCard className="w-4 h-4" /> Registrar y esperar tarjeta</>
              : <><Check className="w-4 h-4" /> Confirmar cobro — {fmt(total)}</>
          }
        </button>
      </div>
    </div>
  )
}

// ─── Pending card screen ─────────────────────────────────────────────────────

function PendingCardScreen({
  orderNumber, checkoutVals, confirming,
  onConfirm, onCancel,
}: {
  orderNumber: string | null
  checkoutVals: { tar: number }
  confirming: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-6">
      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
        <CreditCard className="w-8 h-8 text-amber-600" />
      </div>
      <div className="text-center">
        <div className="font-extrabold text-foreground text-base mb-1">Pendiente de tarjeta</div>
        <div className="text-xs text-muted-foreground">
          Orden <span className="font-mono font-semibold">{orderNumber}</span>
        </div>
        <div className="text-2xl font-extrabold text-amber-600 mt-3">{fmt(checkoutVals.tar)}</div>
        <div className="text-xs text-muted-foreground">por cobrar con tarjeta</div>
      </div>
      <div className="w-full flex flex-col gap-2">
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="w-full py-3 bg-green-600 text-white rounded-[9px] text-[13px] font-extrabold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
        >
          {confirming
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando…</>
            : <><Check className="w-4 h-4" /> Confirmar pago recibido</>
          }
        </button>
        <button
          onClick={onCancel}
          className="w-full py-2 border border-border rounded-[9px] text-xs font-semibold cursor-pointer text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancelar y nueva venta
        </button>
      </div>
    </div>
  )
}

// ─── Success toast ───────────────────────────────────────────────────────────

function SuccessToast({ orderNumber }: { orderNumber: string | null }) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-green-600 text-white rounded-xl px-7 py-4 shadow-2xl z-400 flex items-center gap-3 text-sm font-bold">
      <Check className="w-5 h-5" />
      Venta registrada · {orderNumber}
    </div>
  )
}

function StockWarningToast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-amber-500 text-white rounded-xl px-6 py-3.5 shadow-2xl z-400 flex items-center gap-2.5 text-sm font-semibold">
      <AlertCircle className="w-5 h-5 shrink-0" />
      {message}
    </div>
  )
}

// ─── Quote Panel ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', SENT: 'Enviada', APPROVED: 'Aprobada',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
}

function QuotePanel({
  quotes, loading, open, onToggle, onLoad,
}: {
  quotes: ServiceQuote[]
  loading: boolean
  open: boolean
  onToggle: () => void
  onLoad: (id: string) => void
}) {
  return (
    <div className="border-t border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 cursor-pointer border-none text-left transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-bold text-foreground">
            Cotizaciones del cliente
            {quotes.length > 0 && <span className="ml-1.5 text-primary">({quotes.length})</span>}
          </span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="max-h-52 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-4 gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Cargando…
            </div>
          ) : quotes.length === 0 ? (
            <div className="px-4 py-4 text-center text-[11px] text-muted-foreground">
              Sin cotizaciones activas
            </div>
          ) : (
            quotes.map((q) => (
              <div key={q.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-border hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-foreground truncate">{q.quoteNumber}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[q.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{fmt(Number(q.total))}</span>
                  </div>
                </div>
                {q.status === 'APPROVED' && (
                  <button
                    onClick={() => onLoad(q.id)}
                    className="shrink-0 px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-[10px] font-bold cursor-pointer border-none hover:opacity-90"
                  >
                    Cargar
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Bottom bar ──────────────────────────────────────────────────────────────

function PosBottomBar({
  activeCashSession,
  cliente,
  carrito,
  cartTotal,
  holdSales,
  onOpenPanel,
}: {
  activeCashSession: ApiCashSession | null
  cliente: Cliente | null
  carrito: CartItem[]
  cartTotal: number
  holdSales: HoldSale[]
  onOpenPanel: (id: PanelId) => void
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(t)
  }, [])

  const sessionOpen = activeCashSession !== null
  const salesCount = activeCashSession?.movements.filter(m => m.type === 'SALE').length ?? 0
  const itemCount = carrito.reduce((s, i) => s + i.qty, 0)

  return (
    <div className="h-[52px] shrink-0 bg-card border-t border-border flex items-center px-4 gap-3 z-10">
      {/* Reloj */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
        <Clock className="w-3 h-3" />
        {now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
      </div>

      <div className="w-px h-5 bg-border shrink-0" />

      {/* Estado de caja */}
      <button
        onClick={() => onOpenPanel('caja')}
        title="Estado de caja"
        className="flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0"
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${sessionOpen ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className={`text-[11px] font-semibold ${sessionOpen ? 'text-green-600' : 'text-red-500'}`}>
          {sessionOpen ? 'Caja abierta' : 'Sin caja'}
        </span>
      </button>

      <div className="w-px h-5 bg-border shrink-0" />

      {/* Ventas del día */}
      <button
        onClick={() => onOpenPanel('ventas')}
        title="Ventas del día"
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0 transition-colors"
      >
        <TrendingUp className="w-3 h-3 shrink-0" />
        <span>{salesCount} {salesCount === 1 ? 'venta' : 'ventas'}</span>
      </button>

      {/* Cliente seleccionado */}
      {cliente && (
        <>
          <div className="w-px h-5 bg-border shrink-0" />
          <div className="flex items-center gap-1.5 text-[11px] text-blue-600 min-w-0 max-w-[130px]">
            <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-bold shrink-0">
              {cliente.nombre.charAt(0).toUpperCase()}
            </div>
            <span className="truncate font-medium">{cliente.nombre}</span>
          </div>
        </>
      )}

      {/* Resumen carrito */}
      {carrito.length > 0 && (
        <>
          <div className="w-px h-5 bg-border shrink-0" />
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground shrink-0">
            <ShoppingCart className="w-3 h-3 text-muted-foreground" />
            {itemCount} · {fmt(cartTotal)}
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Acciones rápidas */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onOpenPanel('apartados')}
          disabled={carrito.length === 0}
          title={`Apartar carrito${holdSales.length > 0 ? ` (${holdSales.length} guardados)` : ''}`}
          className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border-none bg-transparent cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Pause className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">Apartar</span>
          {holdSales.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary rounded-full text-[8px] font-bold text-primary-foreground flex items-center justify-center">
              {holdSales.length}
            </span>
          )}
        </button>
        <button
          onClick={() => onOpenPanel('ventas')}
          title="Ventas del día"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border-none bg-transparent cursor-pointer transition-colors"
        >
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">Ventas</span>
        </button>
        <button
          onClick={() => onOpenPanel('ingreso')}
          title="Ingreso de efectivo"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-none bg-transparent cursor-pointer transition-colors"
        >
          <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">Ingreso</span>
        </button>
        <button
          onClick={() => onOpenPanel('egreso')}
          title="Egreso / retiro de efectivo"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 border-none bg-transparent cursor-pointer transition-colors"
        >
          <ArrowDownCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">Egreso</span>
        </button>
      </div>
    </div>
  )
}

// ─── Cash gate overlay ───────────────────────────────────────────────────────

function CashGate({ onOpened }: { onOpened: (session: ApiCashSession) => void }) {
  const [form, setForm] = useState({ exchangeRateUsdMxn: '', openingAmount: '', openingAmountUsd: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpen = async () => {
    const rate = parseFloat(form.exchangeRateUsdMxn)
    if (!rate || rate <= 0) { setError('El tipo de cambio es requerido'); return }
    setSubmitting(true); setError(null)
    try {
      const session = await openCashSession({
        exchangeRateUsdMxn: rate,
        openingAmount: parseFloat(form.openingAmount) || 0,
        openingAmountUsd: parseFloat(form.openingAmountUsd) || undefined,
        notes: form.notes.trim() || undefined,
      })
      onOpened(session)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Error al abrir caja. Verifica que tengas el permiso necesario.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-300 bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Wallet className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-extrabold text-foreground">Punto de Venta</h1>
          <p className="text-sm text-muted-foreground mt-1">Abre la caja para comenzar a vender</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-[12px] text-amber-700 font-medium">No hay sesión de caja activa</span>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Tipo de cambio USD/MXN *</label>
            <input
              type="number" min={0.01} step="0.01"
              value={form.exchangeRateUsdMxn}
              onChange={e => setForm(p => ({ ...p, exchangeRateUsdMxn: e.target.value }))}
              placeholder="17.50"
              autoFocus
              className="w-full mt-1 px-3 py-2.5 border border-border rounded-xl text-[13px] text-foreground bg-muted outline-none focus:border-primary focus:bg-card"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Fondo inicial MXN</label>
              <input
                type="number" min={0} step="0.01"
                value={form.openingAmount}
                onChange={e => setForm(p => ({ ...p, openingAmount: e.target.value }))}
                placeholder="0.00"
                className="w-full mt-1 px-3 py-2.5 border border-border rounded-xl text-[13px] text-foreground bg-muted outline-none focus:border-primary focus:bg-card"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-amber-600">Fondo inicial USD</label>
              <input
                type="number" min={0} step="0.01"
                value={form.openingAmountUsd}
                onChange={e => setForm(p => ({ ...p, openingAmountUsd: e.target.value }))}
                placeholder="0.00"
                className="w-full mt-1 px-3 py-2.5 border border-amber-300 rounded-xl text-[13px] text-foreground bg-muted outline-none focus:border-amber-500 focus:bg-card"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Notas (opcional)</label>
            <input
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Turno matutino…"
              className="w-full mt-1 px-3 py-2.5 border border-border rounded-xl text-[13px] text-foreground bg-muted outline-none focus:border-primary focus:bg-card"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{error}
            </div>
          )}

          <button
            onClick={handleOpen}
            disabled={submitting}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-[13px] font-extrabold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Abriendo caja…</>
              : <><Check className="w-4 h-4" /> Abrir caja</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main POS ────────────────────────────────────────────────────────────────

export function POS() {
  const {
    setPosOpen,
    activeCashSession, sessionChecked, refreshSession,
    catalogLoading,
    search, setSearch, searchRef,
    productosFiltrados,
    catalogTab, setCatalogTab,
    serviceSearch, setServiceSearch,
    serviciosFiltrados,
    carrito, totals, stockWarning,
    addToCart, addServiceToCart, addManualService, updateQty, removeItem, clearCart,
    manualServiceOpen, setManualServiceOpen,
    manualService, setManualService,
    cliente, showClienteDD, setShowClienteDD,
    clienteSearch, setClienteSearch,
    clientesFiltrados, clienteCanCredit, creditBlockReason,
    selectCliente, clearCliente,
    stage,
    efectivo, setEfectivo,
    efectivoUsd, setEfectivoUsd,
    exchangeRate,
    tarjeta, setTarjeta,
    checkoutVals,
    submitting, checkoutError,
    openCheckout, backToCart,
    handleConfirmarPago,
    pendingOrderNumber, confirming,
    handleConfirmarTarjeta, cancelPendingCard,
    successNumber,
    loadedQuoteId, loadedQuoteNumber, quoteLoading,
    clienteQuotes, clienteQuotesLoading, quotePanelOpen, setQuotePanelOpen,
    loadQuoteIntoCart,
    saveAsQuote, savingQuote, savedQuoteNumber, setSavedQuoteNumber,
    holdSales, holdCurrentCart, holdCurrentCartWithDeposit, resumeHoldSale, discardHoldSale,
    layawayOrderId, layawayOrderNumber, layawayPaidAmount,
  } = usePOS()

  const [activeSidebarPanel, setActiveSidebarPanel] = useState<PanelId | null>(null)
  const openSidebarPanel = useCallback((id: PanelId) => setActiveSidebarPanel(id), [])

  // focus search on mount
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const hasFocused = useRef(false)
  useEffect(() => {
    if (!hasFocused.current && searchRef.current) {
      searchRef.current.focus()
      hasFocused.current = true
    }
  }, [searchRef])

  const now = new Date()
  const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  // Cash gate: block POS until a session is open
  if (!sessionChecked) {
    return (
      <div className="fixed inset-0 z-200 bg-background flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (!activeCashSession) {
    return <CashGate onOpened={(session) => { refreshSession(); void session }} />
  }

  return (
    <div className="fixed inset-0 z-200 bg-background flex flex-col">
      {/* ── Topbar ── */}
      <div className="h-[52px] bg-card border-b border-border flex items-center px-5 gap-4 shrink-0">
        <button onClick={() => pathname === '/pos' ? navigate('/dashboard') : setPosOpen(false)}
          className="flex items-center gap-1.5 bg-transparent border border-border rounded-lg px-3 py-1 cursor-pointer text-xs text-muted-foreground font-medium hover:border-primary hover:text-primary transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Volver al ERP
        </button>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <Monitor className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-extrabold text-foreground">Punto de Venta</span>
          <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">POS</span>
        </div>
        <div className="flex-1 flex items-center gap-2 bg-muted rounded-lg px-3.5 py-1.5 max-w-[340px] ml-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={catalogTab === 'products' ? 'Buscar producto o SKU…' : 'Buscar servicio…'}
            className="border-none bg-transparent outline-none text-[13px] text-foreground w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="bg-transparent border-none cursor-pointer text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="ml-auto text-xs text-muted-foreground">{dateStr} · {timeStr}</div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* SIDEBAR — Operational tools */}
        <PosSidebar
          carrito={carrito}
          cliente={cliente}
          cartTotal={totals.total}
          holdSales={holdSales}
          onHoldCart={holdCurrentCart}
          onHoldCartWithDeposit={holdCurrentCartWithDeposit}
          onResumeHoldSale={resumeHoldSale}
          onDiscardHoldSale={discardHoldSale}
          onSelectCliente={selectCliente}
          onSessionChange={refreshSession}
          controlledPanel={activeSidebarPanel}
          onPanelChange={setActiveSidebarPanel}
        />

        {/* LEFT — Products / Services */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
          {/* Catalog tabs */}
          <div className="flex items-center gap-1 px-4 pt-3 pb-0 shrink-0 border-b border-border">
            <button
              onClick={() => setCatalogTab('products')}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold border-b-2 transition-colors cursor-pointer bg-transparent ${catalogTab === 'products' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Package className="w-3.5 h-3.5" /> Productos
            </button>
            <button
              onClick={() => setCatalogTab('services')}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold border-b-2 transition-colors cursor-pointer bg-transparent ${catalogTab === 'services' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Wrench className="w-3.5 h-3.5" /> Servicios
            </button>
            {catalogTab === 'services' && (
              <button
                onClick={() => setManualServiceOpen(true)}
                className="ml-auto flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 text-primary rounded-lg text-[11px] font-bold cursor-pointer border-none mb-1"
              >
                <Plus className="w-3 h-3" /> Manual
              </button>
            )}
          </div>

          {/* Manual service input */}
          {manualServiceOpen && (
            <div className="px-4 py-3 bg-primary/5 border-b border-border shrink-0 space-y-2">
              <div className="text-[11px] font-bold text-primary mb-1">Agregar servicio manual</div>
              <div className="flex gap-2">
                <input
                  value={manualService.name}
                  onChange={(e) => setManualService({ ...manualService, name: e.target.value })}
                  placeholder="Nombre del servicio *"
                  autoFocus
                  className="flex-1 px-2.5 py-1.5 border border-border rounded-lg text-[12px] text-foreground bg-card outline-none focus:border-primary"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualService.price}
                  onChange={(e) => setManualService({ ...manualService, price: e.target.value })}
                  placeholder="Precio"
                  className="w-28 px-2.5 py-1.5 border border-border rounded-lg text-[12px] text-foreground bg-card outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setManualServiceOpen(false)} className="px-3 py-1.5 border border-border rounded-lg text-[11px] text-muted-foreground cursor-pointer bg-card hover:bg-muted">Cancelar</button>
                <button onClick={addManualService} disabled={!manualService.name.trim()} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50">
                  Agregar al carrito
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4">
            {catalogLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Cargando catálogo…</span>
              </div>
            ) : catalogTab === 'products' ? (
              productosFiltrados.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-sm font-semibold text-foreground mb-1">Sin resultados</div>
                  <div className="text-xs text-muted-foreground">Intenta con otro término</div>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                  {productosFiltrados.map(p => (
                    <ProductCard
                      key={p.id}
                      p={p}
                      inCartQty={carrito.find(i => i.id === p.id && i.type === 'PRODUCT')?.qty ?? 0}
                      onAdd={() => addToCart(p)}
                    />
                  ))}
                </div>
              )
            ) : (
              <>
                <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 mb-3">
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Buscar servicio…"
                    className="border-none bg-transparent outline-none text-[13px] text-foreground w-full"
                  />
                </div>
                {serviciosFiltrados.length === 0 ? (
                  <div className="text-center py-16">
                    <Wrench className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-foreground mb-1">Sin servicios</div>
                    <div className="text-xs text-muted-foreground">Agrega servicios desde el catálogo o usa "Manual"</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                    {serviciosFiltrados.map(s => (
                      <ServiceCard
                        key={s.id}
                        s={s}
                        inCartQty={carrito.find(i => i.id === `svc-${s.id}` && i.type === 'SERVICE')?.qty ?? 0}
                        onAdd={() => addServiceToCart(s)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT — Cart / Checkout / Pending */}
        <div className="w-[340px] shrink-0 flex flex-col bg-card overflow-hidden">

          {stage === 'pending_card' ? (
            <PendingCardScreen
              orderNumber={pendingOrderNumber}
              checkoutVals={checkoutVals}
              confirming={confirming}
              onConfirm={handleConfirmarTarjeta}
              onCancel={cancelPendingCard}
            />
          ) : stage === 'checkout' ? (
            <CheckoutPanel
              carrito={carrito}
              totals={totals}
              checkoutVals={checkoutVals}
              cliente={cliente}
              clienteCanCredit={clienteCanCredit}
              creditBlockReason={creditBlockReason}
              efectivo={efectivo}
              setEfectivo={setEfectivo}
              efectivoUsd={efectivoUsd}
              setEfectivoUsd={setEfectivoUsd}
              exchangeRate={exchangeRate}
              tarjeta={tarjeta}
              setTarjeta={setTarjeta}
              checkoutError={checkoutError}
              submitting={submitting}
              layawayOrderNumber={layawayOrderNumber}
              layawayPaidAmount={layawayPaidAmount}
              onBack={backToCart}
              onConfirm={handleConfirmarPago}
            />
          ) : (
            /* CART VIEW */
            <>
              {/* cart header */}
              <div className="px-4 py-4 border-b border-border shrink-0">
                {quoteLoading && (
                  <div className="flex items-center gap-1.5 text-[11px] text-primary font-semibold mb-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Cargando cotización…
                  </div>
                )}
                {loadedQuoteId && !quoteLoading && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-[11px] font-semibold text-primary mb-2">
                    <FileText className="w-3 h-3 shrink-0" />
                    <span className="flex-1 truncate">Cotización: {loadedQuoteNumber}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-extrabold text-foreground">Orden de Venta</span>
                  {carrito.length > 0 && (
                    <button onClick={clearCart}
                      className="text-[11px] font-semibold text-red-600 bg-red-100 border-none rounded-md px-2.5 py-1 cursor-pointer hover:bg-red-200 transition-colors">
                      Limpiar
                    </button>
                  )}
                </div>
                <ClienteDropdown
                  cliente={cliente}
                  showDD={showClienteDD}
                  clienteSearch={clienteSearch}
                  filtrados={clientesFiltrados}
                  onToggle={() => setShowClienteDD(!showClienteDD)}
                  onSearch={setClienteSearch}
                  onSelect={selectCliente}
                  onClear={clearCliente}
                />
              </div>
              {cliente && (
                <QuotePanel
                  quotes={clienteQuotes}
                  loading={clienteQuotesLoading}
                  open={quotePanelOpen}
                  onToggle={() => setQuotePanelOpen(!quotePanelOpen)}
                  onLoad={loadQuoteIntoCart}
                />
              )}

              {/* cart items */}
              <div className="flex-1 overflow-y-auto py-1">
                {carrito.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2.5 p-5">
                    <ShoppingCart className="w-10 h-10 text-muted-foreground/30" />
                    <div className="text-[13px] text-muted-foreground text-center">
                      Agrega productos o servicios al carrito
                    </div>
                  </div>
                ) : (
                  carrito.map(item => (
                    <CartRow
                      key={item.id}
                      item={item}
                      onPlus={() => updateQty(item.id, 1)}
                      onMinus={() => { if (item.qty === 1) removeItem(item.id); else updateQty(item.id, -1) }}
                      onRemove={() => removeItem(item.id)}
                    />
                  ))
                )}
              </div>

              {/* cart footer */}
              <div className="border-t border-border px-4 py-3.5 shrink-0">
                <div className="flex flex-col gap-1.5 mb-3.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold text-foreground">{fmt(totals.subtotal)}</span>
                  </div>
                  <div className="h-px bg-border my-1" />
                  <div className="flex justify-between">
                    <span className="text-sm font-extrabold text-foreground">Total</span>
                    <span className="text-base font-extrabold text-primary">{fmt(totals.total)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right flex items-center justify-end gap-2">
                    {carrito.filter(i => i.type === 'PRODUCT').length > 0 && (
                      <span className="flex items-center gap-0.5"><Package className="w-2.5 h-2.5" /> {carrito.filter(i => i.type === 'PRODUCT').reduce((s, i) => s + i.qty, 0)} prod.</span>
                    )}
                    {carrito.filter(i => i.type === 'SERVICE').length > 0 && (
                      <span className="flex items-center gap-0.5 text-primary"><Wrench className="w-2.5 h-2.5" /> {carrito.filter(i => i.type === 'SERVICE').reduce((s, i) => s + i.qty, 0)} svc.</span>
                    )}
                  </div>
                </div>

                {savedQuoteNumber && (
                  <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg mb-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-green-700 font-semibold">
                      <Check className="w-3 h-3" /> Cotización {savedQuoteNumber} guardada
                    </div>
                    <button onClick={() => setSavedQuoteNumber(null)} className="text-green-600 border-none bg-transparent cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={saveAsQuote}
                    disabled={carrito.length === 0 || !cliente || savingQuote}
                    className="flex-1 py-2 border border-border rounded-[9px] bg-card text-[11px] font-bold cursor-pointer text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {savingQuote
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Guardando…</>
                      : <><FileText className="w-3 h-3" /> Guardar cotización</>
                    }
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={clearCart}
                    disabled={carrito.length === 0}
                    className="flex-1 py-2.5 border-[1.5px] border-border rounded-[9px] bg-card text-[13px] font-bold cursor-pointer text-muted-foreground hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={openCheckout}
                    disabled={carrito.length === 0}
                    className="flex-2 py-2.5 border-none rounded-[9px] text-[13px] font-bold cursor-pointer transition-all disabled:bg-border disabled:text-muted-foreground disabled:cursor-not-allowed bg-primary text-primary-foreground hover:opacity-90"
                  >
                    {carrito.length === 0 ? 'Cobrar' : `Cobrar ${fmt(totals.total)}`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <PosBottomBar
        activeCashSession={activeCashSession}
        cliente={cliente}
        carrito={carrito}
        cartTotal={totals.total}
        holdSales={holdSales}
        onOpenPanel={openSidebarPanel}
      />

      {/* success toast */}
      {stage === 'success' && <SuccessToast orderNumber={successNumber} />}

      {/* stock warning toast */}
      {stockWarning && <StockWarningToast message={stockWarning} />}
    </div>
  )
}
