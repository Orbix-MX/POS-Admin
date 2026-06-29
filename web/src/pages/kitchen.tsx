import { RefreshCw, ChefHat, Play, CheckCheck, X, Clock, Loader2, Truck, AlertTriangle, FlaskConical, Layers, User, CheckSquare } from 'lucide-react'
import { useKitchen, elapsedMinutes, priorityLevel } from '@/hooks/use-kitchen'
import type { KitchenOrder, KitchenOrderItem, KitchenProduct, KitchenRound, KitchenRoundStatus } from '@/services/retail/kitchen-service'

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

function orderLabel(o: KitchenOrder): string {
  return o.table?.name ?? o.reference ?? '—'
}

function waiterLabel(o: KitchenOrder): string {
  return o.waiter ? `${o.waiter.firstName} ${o.waiter.lastName}`.trim() : '—'
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
          <span className="text-[13px] font-semibold text-zinc-100 leading-tight">{item.productName}</span>
        </div>
        <span className="text-[12px] font-bold text-amber-400 shrink-0">{item.quantity}×</span>
      </div>

      {/* Modifier / comment */}
      {item.notes && (
        <div className="text-[11px] text-amber-300 font-medium px-1">
          ⚠ {item.notes}
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
  onStart:              (o: KitchenOrder) => void
  onReady:              (o: KitchenOrder) => void
  onDeliver:            (o: KitchenOrder) => void
  onOpen:               (o: KitchenOrder) => void
  onUpdateRoundStatus:  (orderId: string, roundId: string, status: KitchenRoundStatus) => void
  busy:                 boolean
  busyRound:            Record<string, boolean>
}

function KitchenCard({ order, actions }: { order: KitchenOrder; actions: CardActions }) {
  const mins = elapsedMinutes(order.openedAt)
  const prio = priorityLevel(mins)

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
      {/* Mesa / referencia */}
      <div className="px-3.5 pt-3 pb-2 border-b border-zinc-800/60">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-[24px] font-black text-zinc-50 leading-none tracking-tight truncate">
              {orderLabel(order)}
            </div>
            <div className="flex items-center gap-1 mt-1.5 text-[11px] text-zinc-500">
              <User className="w-3 h-3" />
              <span className="truncate">{waiterLabel(order)}</span>
            </div>
          </div>
          {/* Elapsed time */}
          <div className={`flex flex-col items-end gap-0.5 ${PRIORITY_BADGE_BG[prio]} px-2 py-1.5 rounded-lg shrink-0`}>
            <div className={`font-mono font-bold text-[22px] leading-none ${PRIORITY_TIMER[prio]}`}>
              {fmtElapsed(order.openedAt)}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-zinc-500 uppercase tracking-wider">
              <Clock className="w-2.5 h-2.5" />
              {fmtTime(order.openedAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Rounds — compact preview */}
      <div className="px-3.5 py-2.5 space-y-2 border-b border-zinc-800/60">
        {order.rounds.length === 0 && (
          <div className="text-[11px] text-zinc-600 italic">Sin rondas</div>
        )}
        {order.rounds.map(round => {
          const done = round.status === 'DONE'
          const previewItems = round.items.slice(0, 3)
          const extra = round.items.length - previewItems.length
          const statusDot = done ? 'bg-emerald-500' : round.status === 'IN_PREPARATION' ? 'bg-amber-400 animate-pulse' : 'bg-zinc-500'
          return (
            <div key={round.id} className={done ? 'opacity-40' : ''}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                  Ronda {round.roundNumber}
                  {done && ' · Preparada'}
                  {round.status === 'IN_PREPARATION' && ' · En preparación'}
                </span>
              </div>
              {previewItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-[12px] pl-3">
                  <span className={`font-bold tabular-nums w-5 text-right ${done ? 'text-zinc-600' : 'text-amber-500'}`}>{item.quantity}×</span>
                  <span className={`truncate ${done ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>{item.productName}</span>
                  {!done && item.product?.type === 'RECIPE' && <FlaskConical className="w-3 h-3 text-violet-500 shrink-0" />}
                  {!done && item.product?.type === 'COMBO'  && <Layers       className="w-3 h-3 text-blue-400 shrink-0" />}
                </div>
              ))}
              {extra > 0 && (
                <div className={`text-[10px] pl-8 ${done ? 'text-zinc-700' : 'text-zinc-600'}`}>+{extra} más…</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div
        className="px-3 pb-3 pt-2.5 flex gap-2"
        onClick={e => e.stopPropagation()}
      >
        {order.status === 'SENT_TO_KITCHEN' && (
          <ActionBtn color="emerald" icon={<Play className="w-3.5 h-3.5" />} label="Iniciar"
            onClick={() => actions.onStart(order)} busy={actions.busy} />
        )}
        {order.status === 'IN_PREPARATION' && (
          <ActionBtn color="emerald" icon={<CheckCheck className="w-3.5 h-3.5" />} label="Listo"
            onClick={() => actions.onReady(order)} busy={actions.busy} />
        )}
        {order.status === 'READY' && (
          <ActionBtn color="blue" icon={<Truck className="w-3.5 h-3.5" />} label="Enviar a caja"
            onClick={() => actions.onDeliver(order)} busy={actions.busy} />
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
  SENT_TO_KITCHEN: { label: 'En cola',    dot: 'bg-zinc-400',    emptyMsg: 'Sin órdenes en cola' },
  IN_PREPARATION:  { label: 'Preparando', dot: 'bg-amber-400',   emptyMsg: 'Nada en preparación' },
  READY:           { label: 'Listas',     dot: 'bg-emerald-400', emptyMsg: 'Sin órdenes listas' },
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
            actions={actions}
          />
        ))
      )}
    </div>
  )
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

const ROUND_STATUS_META: Record<KitchenRoundStatus, { label: string; dot: string; bg: string; border: string; text: string }> = {
  SENT:           { label: 'Pendiente',       dot: 'bg-zinc-500',                    bg: 'bg-zinc-800/60',    border: 'border-zinc-700',    text: 'text-zinc-400' },
  IN_PREPARATION: { label: 'En preparación',  dot: 'bg-amber-400 animate-pulse',     bg: 'bg-amber-950/30',   border: 'border-amber-800/60', text: 'text-amber-400' },
  DONE:           { label: 'Preparada',        dot: 'bg-emerald-500',                 bg: 'bg-emerald-950/20', border: 'border-emerald-900/50', text: 'text-emerald-500' },
}

function RoundSection({
  round, orderId, onUpdateStatus, busy,
}: {
  round: KitchenRound
  orderId: string
  onUpdateStatus: (orderId: string, roundId: string, status: KitchenRoundStatus) => void
  busy: boolean
}) {
  const meta = ROUND_STATUS_META[round.status]
  const totalItems = round.items.reduce((s, i) => s + i.quantity, 0)
  const isDone = round.status === 'DONE'

  return (
    <div className={`border ${meta.border} rounded-xl overflow-hidden ${isDone ? 'opacity-60' : ''}`}>
      {/* Round header */}
      <div className={`flex items-center justify-between px-3.5 py-2 ${meta.bg} border-b ${meta.border}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
          <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">
            Ronda {round.roundNumber}
          </span>
          <span className="text-[10px] text-zinc-600">{fmtTime(round.sentAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold ${meta.text}`}>{meta.label}</span>
          <span className="text-[10px] text-zinc-600">· {totalItems} pieza{totalItems !== 1 ? 's' : ''}</span>
          {!isDone && (
            <button
              onClick={() => onUpdateStatus(
                orderId,
                round.id,
                round.status === 'SENT' ? 'IN_PREPARATION' : 'DONE',
              )}
              disabled={busy}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                ${round.status === 'SENT'
                  ? 'border-amber-700/50 bg-amber-950/50 text-amber-400 hover:bg-amber-900/40'
                  : 'border-emerald-700/50 bg-emerald-950/50 text-emerald-400 hover:bg-emerald-900/40'
                }`}
            >
              {busy
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : round.status === 'SENT'
                  ? <Play className="w-3 h-3" />
                  : <CheckSquare className="w-3 h-3" />
              }
              {round.status === 'SENT' ? 'Iniciar' : 'Lista'}
            </button>
          )}
          {isDone && <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
        </div>
      </div>

      {/* Items */}
      <div className={`px-3.5 py-3 space-y-2 ${isDone ? 'opacity-70' : ''}`}>
        {round.items.map(item => (
          <OrderItemDetail key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

function DetailModal({
  order, onClose, actions,
}: {
  order: KitchenOrder
  onClose: () => void
  actions: Omit<CardActions, 'onOpen' | 'busy'> & { busy: boolean }
}) {
  const mins = elapsedMinutes(order.openedAt)
  const prio = priorityLevel(mins)
  const totalItems = order.rounds.reduce((s, r) => s + r.items.length, 0)
  const pendingRounds = order.rounds.filter(r => r.status !== 'DONE').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className={`px-5 py-4 border-b border-zinc-800 border-l-4 ${PRIORITY_BORDER[prio]} rounded-tl-2xl`}>
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[28px] font-black text-zinc-50 leading-none truncate">
                  {orderLabel(order)}
                </span>
                <div className={`${PRIORITY_BADGE_BG[prio]} px-2.5 py-1.5 rounded-lg shrink-0`}>
                  <span className={`font-mono font-bold text-[20px] leading-none ${PRIORITY_TIMER[prio]}`}>
                    {fmtElapsed(order.openedAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{waiterLabel(order)}</span>
                </div>
                <span>·</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{fmtTime(order.openedAt)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Rounds */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">
            {totalItems} {totalItems === 1 ? 'producto' : 'productos'} · {pendingRounds} pendiente{pendingRounds !== 1 ? 's' : ''} de {order.rounds.length}
          </div>
          {order.rounds.length === 0 ? (
            <div className="text-[12px] text-zinc-600 italic text-center py-4">
              Sin rondas enviadas.
            </div>
          ) : (
            order.rounds.map(round => (
              <RoundSection
                key={round.id}
                round={round}
                orderId={order.id}
                onUpdateStatus={actions.onUpdateRoundStatus}
                busy={!!actions.busyRound[round.id]}
              />
            ))
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 pt-3 border-t border-zinc-800 flex gap-2" onClick={e => e.stopPropagation()}>
          {order.status === 'SENT_TO_KITCHEN' && (
            <ModalBtn color="emerald" icon={<Play className="w-4 h-4" />} label="Iniciar"
              onClick={() => actions.onStart(order)} busy={actions.busy} />
          )}
          {order.status === 'IN_PREPARATION' && (
            <ModalBtn color="emerald" icon={<CheckCheck className="w-4 h-4" />} label="Listo"
              onClick={() => actions.onReady(order)} busy={actions.busy} />
          )}
          {order.status === 'READY' && (
            <ModalBtn color="blue" icon={<Truck className="w-4 h-4" />} label="Enviar a caja"
              onClick={() => actions.onDeliver(order)} busy={actions.busy} />
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Kitchen() {
  const {
    columns, loading, error, lastRefresh, updating, updatingRound,
    selectedOrder, setSelectedOrder,
    handleStart, handleReady, handleDeliver, handleUpdateRoundStatus,
    refresh,
  } = useKitchen()

  const totalActive = columns.SENT_TO_KITCHEN.length + columns.IN_PREPARATION.length + columns.READY.length

  const cardActions: CardActions = {
    onStart:             handleStart,
    onReady:             handleReady,
    onDeliver:           handleDeliver,
    onOpen:              setSelectedOrder,
    onUpdateRoundStatus: handleUpdateRoundStatus,
    busy:                false,
    busyRound:           updatingRound,
  }

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
            <span><span className="text-zinc-300 font-semibold">{columns.SENT_TO_KITCHEN.length}</span> en cola</span>
            <span><span className="text-amber-400 font-semibold">{columns.IN_PREPARATION.length}</span> preparando</span>
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
          <div className="grid grid-cols-3 gap-3 items-start">
            {(['SENT_TO_KITCHEN', 'IN_PREPARATION', 'READY'] as const).map(status => (
              <KitchenColumn
                key={status}
                status={status}
                orders={columns[status]}
                actions={cardActions}
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
            onStart:             (o) => { handleStart(o);   setSelectedOrder(null) },
            onReady:             (o) => { handleReady(o);   setSelectedOrder(null) },
            onDeliver:           (o) => { handleDeliver(o); setSelectedOrder(null) },
            onUpdateRoundStatus: handleUpdateRoundStatus,
            busy:                !!updating[selectedOrder.id],
            busyRound:           updatingRound,
          }}
        />
      )}
    </div>
  )
}
