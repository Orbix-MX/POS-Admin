import { RefreshCw, ChefHat, Play, Pause, CheckCheck, X, Clock, Loader2, Truck, RotateCcw, AlertTriangle, FlaskConical, Layers, User } from 'lucide-react'
import { useKitchen, elapsedMinutes, priorityLevel } from '@/hooks/use-kitchen'
import type { KitchenOrder, KitchenOrderItem, KitchenProduct } from '@/services/retail/kitchen-service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtElapsed(createdAt: string): string {
  const mins = elapsedMinutes(createdAt)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

const PRIORITY_BORDER: Record<string, string> = {
  normal: 'border-l-emerald-500',
  warning: 'border-l-amber-400',
  critical: 'border-l-red-500',
}
const PRIORITY_TIMER: Record<string, string> = {
  normal: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
}
const PRIORITY_BADGE_BG: Record<string, string> = {
  normal: 'bg-emerald-950/60',
  warning: 'bg-amber-950/60',
  critical: 'bg-red-950/60',
}

// ─── Recipe ingredients ───────────────────────────────────────────────────────

function RecipeIngredients({ recipe }: { recipe: NonNullable<KitchenProduct['recipe']> }) {
  return (
    <div className="mt-1.5 pl-3 border-l border-zinc-700 space-y-0.5">
      {recipe.items.map(item => (
        <div key={item.id} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
          <span className="font-medium text-zinc-300">{item.supply.name}</span>
          <span className="text-zinc-500">·</span>
          <span>
            {Number(item.quantity).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
            {' '}{item.measurementUnit?.symbol ?? item.unit}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Order item detail ────────────────────────────────────────────────────────

function OrderItemDetail({ item }: { item: KitchenOrderItem }) {
  const product = item.product
  const isRecipe = product?.type === 'RECIPE'
  const isCombo = product?.type === 'COMBO'

  return (
    <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5 space-y-1.5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isRecipe && <FlaskConical className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />}
          {isCombo  && <Layers       className="w-3.5 h-3.5 text-blue-400   shrink-0 mt-0.5" />}
          <span className="text-[13px] font-semibold text-zinc-100 leading-tight">{item.name}</span>
        </div>
        <span className="text-[12px] font-bold text-amber-400 shrink-0">{item.quantity}×</span>
      </div>

      {/* Modifier / comment */}
      {item.description && (
        <div className="text-[11px] text-amber-300 font-medium px-1">
          ⚠ {item.description}
        </div>
      )}

      {/* Recipe ingredients */}
      {isRecipe && product?.recipe && (
        <RecipeIngredients recipe={product.recipe} />
      )}

      {/* Combo children */}
      {isCombo && product?.comboItems && product.comboItems.length > 0 && (
        <div className="mt-1.5 pl-3 border-l border-zinc-700 space-y-2">
          {product.comboItems.map(ci => (
            <div key={ci.id}>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                <span className="text-zinc-300 font-medium">{ci.child.name}</span>
                {ci.quantity > 1 && (
                  <span className="text-zinc-500">× {ci.quantity}</span>
                )}
                {ci.child.type === 'RECIPE' && (
                  <FlaskConical className="w-2.5 h-2.5 text-violet-500" />
                )}
              </div>
              {ci.child.type === 'RECIPE' && ci.child.recipe && (
                <div className="ml-3">
                  <RecipeIngredients recipe={ci.child.recipe} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Kitchen card ─────────────────────────────────────────────────────────────

type CardActions = {
  onStart:   (o: KitchenOrder) => void
  onPause:   (o: KitchenOrder) => void
  onResume:  (o: KitchenOrder) => void
  onReady:   (o: KitchenOrder) => void
  onDeliver: (o: KitchenOrder) => void
  onReject:  (o: KitchenOrder) => void
  onOpen:    (o: KitchenOrder) => void
  busy:      boolean
}

function KitchenCard({ order, actions }: { order: KitchenOrder; actions: CardActions }) {
  const mins    = elapsedMinutes(order.createdAt)
  const prio    = priorityLevel(mins)
  const waiter  = order.createdBy
    ? `${order.createdBy.firstName} ${order.createdBy.lastName}`
    : order.employeeNumber ?? '—'

  return (
    <div
      onClick={() => actions.onOpen(order)}
      className={`
        relative bg-zinc-900 rounded-xl border border-zinc-800/60
        border-l-4 ${PRIORITY_BORDER[prio]}
        cursor-pointer group transition-all
        hover:border-zinc-700/60 hover:bg-zinc-850
        ${prio === 'critical' ? 'animate-pulse-slow' : ''}
      `}
    >
      {/* Mesa + folio */}
      <div className="px-3.5 pt-3 pb-2 border-b border-zinc-800/60">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[28px] font-black text-zinc-50 leading-none tracking-tight">
              {order.tableNumber ?? '—'}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase tracking-wider">
              {order.orderNumber}
            </div>
          </div>
          {/* Elapsed time */}
          <div className={`flex flex-col items-end gap-0.5 ${PRIORITY_BADGE_BG[prio]} px-2 py-1.5 rounded-lg`}>
            <div className={`font-mono font-bold text-[22px] leading-none ${PRIORITY_TIMER[prio]}`}>
              {fmtElapsed(order.createdAt)}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-zinc-500 uppercase tracking-wider">
              <Clock className="w-2.5 h-2.5" />
              {fmtTime(order.createdAt)}
            </div>
          </div>
        </div>

        {/* Waiter */}
        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-zinc-500">
          <User className="w-3 h-3" />
          <span>{waiter}</span>
        </div>
      </div>

      {/* Items */}
      <div className="px-3.5 py-2.5 space-y-0.5 border-b border-zinc-800/60">
        {order.items.slice(0, 5).map(item => (
          <div key={item.id} className="flex items-center gap-2 text-[12px]">
            <span className="text-amber-500 font-bold tabular-nums w-5 text-right">{item.quantity}×</span>
            <span className="text-zinc-200 truncate">{item.name}</span>
            {item.product?.type === 'RECIPE' && <FlaskConical className="w-3 h-3 text-violet-500 shrink-0" />}
            {item.product?.type === 'COMBO'  && <Layers       className="w-3 h-3 text-blue-400 shrink-0" />}
          </div>
        ))}
        {order.items.length > 5 && (
          <div className="text-[10px] text-zinc-600 pl-7">
            +{order.items.length - 5} más…
          </div>
        )}
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="px-3.5 py-2 border-b border-zinc-800/60 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-[11px] text-amber-300">{order.notes}</span>
        </div>
      )}

      {/* Actions */}
      <div
        className="px-3 pb-3 pt-2.5 flex gap-2"
        onClick={e => e.stopPropagation()}
      >
        {order.kitchenStatus === 'PENDING' && (
          <>
            <ActionBtn color="emerald" icon={<Play className="w-3.5 h-3.5" />} label="Iniciar"
              onClick={() => actions.onStart(order)} busy={actions.busy} />
            <ActionBtn color="red" icon={<X className="w-3.5 h-3.5" />} label="Rechazar"
              onClick={() => actions.onReject(order)} busy={actions.busy} compact />
          </>
        )}
        {order.kitchenStatus === 'IN_PROGRESS' && (
          <>
            <ActionBtn color="amber" icon={<Pause className="w-3.5 h-3.5" />} label="Pausar"
              onClick={() => actions.onPause(order)} busy={actions.busy} />
            <ActionBtn color="emerald" icon={<CheckCheck className="w-3.5 h-3.5" />} label="Listo"
              onClick={() => actions.onReady(order)} busy={actions.busy} />
            <ActionBtn color="red" icon={<X className="w-3.5 h-3.5" />} label=""
              onClick={() => actions.onReject(order)} busy={actions.busy} compact />
          </>
        )}
        {order.kitchenStatus === 'PAUSED' && (
          <>
            <ActionBtn color="amber" icon={<RotateCcw className="w-3.5 h-3.5" />} label="Reanudar"
              onClick={() => actions.onResume(order)} busy={actions.busy} />
            <ActionBtn color="red" icon={<X className="w-3.5 h-3.5" />} label="Rechazar"
              onClick={() => actions.onReject(order)} busy={actions.busy} compact />
          </>
        )}
        {order.kitchenStatus === 'READY' && (
          <>
            <ActionBtn color="blue" icon={<Truck className="w-3.5 h-3.5" />} label="Entregar"
              onClick={() => actions.onDeliver(order)} busy={actions.busy} />
            <ActionBtn color="zinc" icon={<RotateCcw className="w-3.5 h-3.5" />} label=""
              onClick={() => actions.onResume(order)} busy={actions.busy} compact />
          </>
        )}
      </div>
    </div>
  )
}

function ActionBtn({
  color, icon, label, onClick, busy, compact,
}: {
  color: 'emerald' | 'amber' | 'red' | 'blue' | 'zinc'
  icon: React.ReactNode
  label: string
  onClick: () => void
  busy: boolean
  compact?: boolean
}) {
  const palette: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/30',
    amber:   'bg-amber-500/15   text-amber-400   hover:bg-amber-500/25   border-amber-500/30',
    red:     'bg-red-500/15     text-red-400     hover:bg-red-500/25     border-red-500/30',
    blue:    'bg-blue-500/15    text-blue-400    hover:bg-blue-500/25    border-blue-500/30',
    zinc:    'bg-zinc-700/40    text-zinc-400    hover:bg-zinc-700/60    border-zinc-600/40',
  }
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`
        flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-semibold
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${compact ? 'w-9 shrink-0' : 'flex-1'}
        ${palette[color]}
      `}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {!compact && label}
    </button>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

const COLUMN_META: Record<string, { label: string; dot: string; emptyMsg: string }> = {
  PENDING:     { label: 'Pendientes', dot: 'bg-zinc-400',    emptyMsg: 'Sin órdenes pendientes' },
  IN_PROGRESS: { label: 'Preparando', dot: 'bg-amber-400',   emptyMsg: 'Nada en preparación' },
  PAUSED:      { label: 'Pausadas',   dot: 'bg-orange-400',  emptyMsg: 'Sin pausas activas' },
  READY:       { label: 'Listas',     dot: 'bg-emerald-400', emptyMsg: 'Sin órdenes listas' },
}

function KitchenColumn({
  status, orders, actions,
}: {
  status: string
  orders: KitchenOrder[]
  actions: CardActions
}) {
  const meta = COLUMN_META[status]
  return (
    <div className="flex flex-col gap-2 min-w-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-1 py-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
            {meta.label}
          </span>
        </div>
        {orders.length > 0 && (
          <span className="text-[10px] font-bold text-zinc-600 bg-zinc-800 rounded-full px-2 py-0.5 tabular-nums">
            {orders.length}
          </span>
        )}
      </div>

      {/* Cards */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 rounded-xl border border-dashed border-zinc-800">
          <ChefHat className="w-6 h-6 text-zinc-700" />
          <span className="text-[11px] text-zinc-600">{meta.emptyMsg}</span>
        </div>
      ) : (
        orders.map(order => (
          <KitchenCard
            key={order.id}
            order={order}
            actions={{ ...actions, busy: !!actions.busy }}
          />
        ))
      )}
    </div>
  )
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DetailModal({
  order, onClose, actions,
}: {
  order: KitchenOrder
  onClose: () => void
  actions: Omit<CardActions, 'onOpen' | 'busy'> & { busy: boolean }
}) {
  const mins   = elapsedMinutes(order.createdAt)
  const prio   = priorityLevel(mins)
  const waiter = order.createdBy
    ? `${order.createdBy.firstName} ${order.createdBy.lastName}`
    : order.employeeNumber ?? '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className={`px-5 py-4 border-b border-zinc-800 border-l-4 ${PRIORITY_BORDER[prio]} rounded-tl-2xl`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[32px] font-black text-zinc-50 leading-none">
                  {order.tableNumber ?? '—'}
                </span>
                <div className={`${PRIORITY_BADGE_BG[prio]} px-2.5 py-1.5 rounded-lg`}>
                  <span className={`font-mono font-bold text-[20px] leading-none ${PRIORITY_TIMER[prio]}`}>
                    {fmtElapsed(order.createdAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500">
                <span className="font-mono">{order.orderNumber}</span>
                <span>·</span>
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{waiter}</span>
                </div>
                <span>·</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{fmtTime(order.createdAt)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {order.notes && (
            <div className="mt-2.5 flex items-start gap-2 bg-amber-950/40 border border-amber-900/40 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-[12px] text-amber-300">{order.notes}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">
            {order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}
          </div>
          {order.items.map(item => (
            <OrderItemDetail key={item.id} item={item} />
          ))}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 pt-3 border-t border-zinc-800 flex gap-2" onClick={e => e.stopPropagation()}>
          {order.kitchenStatus === 'PENDING' && (
            <>
              <ModalBtn color="emerald" icon={<Play className="w-4 h-4" />} label="Iniciar"
                onClick={() => actions.onStart(order)} busy={actions.busy} />
              <ModalBtn color="red" icon={<X className="w-4 h-4" />} label="Rechazar"
                onClick={() => actions.onReject(order)} busy={actions.busy} />
            </>
          )}
          {order.kitchenStatus === 'IN_PROGRESS' && (
            <>
              <ModalBtn color="amber"   icon={<Pause     className="w-4 h-4" />} label="Pausar"   onClick={() => actions.onPause(order)}   busy={actions.busy} />
              <ModalBtn color="emerald" icon={<CheckCheck className="w-4 h-4" />} label="Listo"    onClick={() => actions.onReady(order)}   busy={actions.busy} />
              <ModalBtn color="red"     icon={<X          className="w-4 h-4" />} label="Rechazar" onClick={() => actions.onReject(order)}  busy={actions.busy} />
            </>
          )}
          {order.kitchenStatus === 'PAUSED' && (
            <>
              <ModalBtn color="amber" icon={<RotateCcw className="w-4 h-4" />} label="Reanudar"
                onClick={() => actions.onResume(order)} busy={actions.busy} />
              <ModalBtn color="red" icon={<X className="w-4 h-4" />} label="Rechazar"
                onClick={() => actions.onReject(order)} busy={actions.busy} />
            </>
          )}
          {order.kitchenStatus === 'READY' && (
            <>
              <ModalBtn color="blue" icon={<Truck className="w-4 h-4" />} label="Marcar entregada"
                onClick={() => actions.onDeliver(order)} busy={actions.busy} />
              <ModalBtn color="zinc" icon={<RotateCcw className="w-4 h-4" />} label="Regresar a cocina"
                onClick={() => actions.onResume(order)} busy={actions.busy} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ModalBtn({
  color, icon, label, onClick, busy,
}: {
  color: 'emerald' | 'amber' | 'red' | 'blue' | 'zinc'
  icon: React.ReactNode
  label: string
  onClick: () => void
  busy: boolean
}) {
  const palette: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/30',
    amber:   'bg-amber-500/15   text-amber-400   hover:bg-amber-500/25   border-amber-500/30',
    red:     'bg-red-500/15     text-red-400     hover:bg-red-500/25     border-red-500/30',
    blue:    'bg-blue-500/15    text-blue-400    hover:bg-blue-500/25    border-blue-500/30',
    zinc:    'bg-zinc-700/40    text-zinc-400    hover:bg-zinc-700/60    border-zinc-600/40',
  }
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`
        flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border
        text-[13px] font-semibold transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${palette[color]}
      `}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  )
}

// ─── Reject modal ─────────────────────────────────────────────────────────────

function RejectModal({
  order, comment, onCommentChange, error, onConfirm, onCancel, busy,
}: {
  order: KitchenOrder
  comment: string
  onCommentChange: (v: string) => void
  error: string
  onConfirm: () => void
  onCancel: () => void
  busy: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-zinc-950 border border-red-900/60 rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-red-400 mb-1">
            <X className="w-4 h-4" />
            <span className="font-bold text-[14px]">Rechazar orden</span>
          </div>
          <p className="text-[12px] text-zinc-400">
            Mesa {order.tableNumber} · {order.orderNumber}
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Motivo de rechazo *
            </label>
            {/* Quick reason chips */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {['Falta ingrediente', 'Cocina saturada', 'Producto agotado', 'Error en pedido'].map(r => (
                <button
                  key={r}
                  onClick={() => onCommentChange(r)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors
                    ${comment === r
                      ? 'bg-red-500/20 border-red-500/50 text-red-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={e => onCommentChange(e.target.value)}
              placeholder="Describe el motivo del rechazo…"
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[12px] text-zinc-200
                placeholder:text-zinc-600 outline-none focus:border-red-700 resize-none"
            />
            {error && (
              <p className="text-[11px] text-red-400 mt-1">{error}</p>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-[13px] font-semibold
              hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400
              text-[13px] font-semibold hover:bg-red-500/25 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Rechazar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Kitchen() {
  const {
    columns, loading, error, lastRefresh, updating,
    selectedOrder, setSelectedOrder,
    rejectTarget, rejectComment, setRejectComment, rejectError,
    handleStart, handlePause, handleResume, handleReady, handleDeliver,
    openReject, confirmReject, cancelReject,
    refresh,
  } = useKitchen()

  const totalActive = columns.PENDING.length + columns.IN_PROGRESS.length + columns.PAUSED.length + columns.READY.length

  const actions = (order: KitchenOrder): CardActions => ({
    onStart:   handleStart,
    onPause:   handlePause,
    onResume:  handleResume,
    onReady:   handleReady,
    onDeliver: handleDeliver,
    onReject:  openReject,
    onOpen:    setSelectedOrder,
    busy:      !!updating[order.id],
  })

  return (
    <div className="h-screen bg-[#0c0a09] flex flex-col overflow-hidden">
      {/* KDS header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <ChefHat className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-zinc-100 leading-tight">Cocina</div>
            <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
              Kitchen Display System
            </div>
          </div>
          {totalActive > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-bold text-amber-400">{totalActive} activas</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-zinc-500">
            <span><span className="text-zinc-300 font-semibold">{columns.PENDING.length}</span> pendientes</span>
            <span><span className="text-amber-400 font-semibold">{columns.IN_PROGRESS.length}</span> preparando</span>
            <span><span className="text-orange-400 font-semibold">{columns.PAUSED.length}</span> pausadas</span>
            <span><span className="text-emerald-400 font-semibold">{columns.READY.length}</span> listas</span>
          </div>

          {lastRefresh && (
            <div className="text-[10px] text-zinc-600 font-mono">
              {fmtTime(lastRefresh.toISOString())}
            </div>
          )}

          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800
              text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 text-[11px] font-semibold transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 bg-red-950/50 border border-red-900/60 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-[12px] text-red-400">{error}</span>
        </div>
      )}

      {/* Loading — first load only, no orders yet */}
      {loading && totalActive === 0 && !error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <span className="text-[12px] text-zinc-500">Cargando órdenes…</span>
          </div>
        </div>
      )}

      {/* Kanban board — always show after first load (empty columns = valid state) */}
      {(!loading || totalActive > 0) && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-4 gap-3 items-start">
            {(['PENDING', 'IN_PROGRESS', 'PAUSED', 'READY'] as const).map(status => (
              <KitchenColumn
                key={status}
                status={status}
                orders={columns[status]}
                actions={{
                  onStart:   handleStart,
                  onPause:   handlePause,
                  onResume:  handleResume,
                  onReady:   handleReady,
                  onDeliver: handleDeliver,
                  onReject:  openReject,
                  onOpen:    setSelectedOrder,
                  busy:      false,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedOrder && (
        <DetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          actions={{
            onStart:   (o) => { handleStart(o);   setSelectedOrder(null) },
            onPause:   (o) => { handlePause(o);   setSelectedOrder(null) },
            onResume:  (o) => { handleResume(o);  setSelectedOrder(null) },
            onReady:   (o) => { handleReady(o);   setSelectedOrder(null) },
            onDeliver: (o) => { handleDeliver(o); setSelectedOrder(null) },
            onReject:  (o) => { setSelectedOrder(null); openReject(o) },
            busy: !!updating[selectedOrder.id],
          }}
        />
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          order={rejectTarget}
          comment={rejectComment}
          onCommentChange={setRejectComment}
          error={rejectError}
          onConfirm={confirmReject}
          onCancel={cancelReject}
          busy={!!updating[rejectTarget.id]}
        />
      )}
    </div>
  )
}
