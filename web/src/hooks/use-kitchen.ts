import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  getKitchenOrders,
  updateKitchenStatus,
  type KitchenOrder,
  type KitchenOrderStatus,
} from '@/services/retail/kitchen-service'

const POLL_INTERVAL_MS = 15_000

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // AudioContext unavailable or blocked
  }
}

export function elapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
}

export function priorityLevel(minutes: number): 'normal' | 'warning' | 'critical' {
  if (minutes >= 30) return 'critical'
  if (minutes >= 15) return 'warning'
  return 'normal'
}

export function useKitchen() {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null)
  const [rejectTarget, setRejectTarget] = useState<KitchenOrder | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [rejectError, setRejectError] = useState('')
  const knownIds = useRef<Set<string>>(new Set())
  const [tick, setTick] = useState(0)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getKitchenOrders()
      const incoming = new Set(data.map(o => o.id))
      const isFirstLoad = knownIds.current.size === 0
      if (!isFirstLoad) {
        const hasNew = data.some(o => !knownIds.current.has(o.id))
        if (hasNew) beep()
      }
      knownIds.current = incoming
      setOrders(data)
      setLastRefresh(new Date())
      setError(null)
    } catch (e: unknown) {
      // Silent polling failures don't override UI — only first-load errors show
      if (!silent) {
        const status = (e as { response?: { status?: number } })?.response?.status
        if (status === 403) {
          setError('Sin permiso para ver órdenes de cocina')
        } else if (status !== undefined) {
          setError('Error al cargar órdenes de cocina')
        }
        // Network errors on first load: leave orders empty, no error banner
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(() => load(true), POLL_INTERVAL_MS)
    return () => clearInterval(iv)
  }, [load])

  // Tick every minute to refresh elapsed times
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(iv)
  }, [])
  void tick

  const columns = useMemo(() => ({
    PENDING:    orders.filter(o => o.kitchenStatus === 'PENDING'),
    IN_PROGRESS:orders.filter(o => o.kitchenStatus === 'IN_PROGRESS'),
    PAUSED:     orders.filter(o => o.kitchenStatus === 'PAUSED'),
    READY:      orders.filter(o => o.kitchenStatus === 'READY'),
  }), [orders])

  const applyStatus = useCallback(async (
    order: KitchenOrder,
    status: KitchenOrderStatus,
    comment?: string,
  ) => {
    setUpdating(p => ({ ...p, [order.id]: true }))
    try {
      const updated = await updateKitchenStatus(order.id, status, comment)
      setOrders(prev => {
        const filtered = prev.filter(o => o.id !== updated.id)
        const active: KitchenOrderStatus[] = ['PENDING', 'IN_PROGRESS', 'PAUSED', 'READY']
        return active.includes(updated.kitchenStatus)
          ? [...filtered, updated]
          : filtered
      })
      if (selectedOrder?.id === order.id) {
        const active: KitchenOrderStatus[] = ['PENDING', 'IN_PROGRESS', 'PAUSED', 'READY']
        setSelectedOrder(active.includes(updated.kitchenStatus) ? updated : null)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al actualizar estado'
      setError(msg)
    } finally {
      setUpdating(p => ({ ...p, [order.id]: false }))
    }
  }, [selectedOrder])

  const handleStart    = useCallback((o: KitchenOrder) => applyStatus(o, 'IN_PROGRESS'), [applyStatus])
  const handlePause    = useCallback((o: KitchenOrder) => applyStatus(o, 'PAUSED'), [applyStatus])
  const handleResume   = useCallback((o: KitchenOrder) => applyStatus(o, 'IN_PROGRESS'), [applyStatus])
  const handleReady    = useCallback((o: KitchenOrder) => applyStatus(o, 'READY'), [applyStatus])
  const handleDeliver  = useCallback((o: KitchenOrder) => applyStatus(o, 'DELIVERED'), [applyStatus])

  const openReject = useCallback((o: KitchenOrder) => {
    setRejectTarget(o)
    setRejectComment('')
    setRejectError('')
  }, [])

  const confirmReject = useCallback(async () => {
    if (!rejectTarget) return
    if (!rejectComment.trim()) { setRejectError('El comentario es obligatorio'); return }
    await applyStatus(rejectTarget, 'REJECTED', rejectComment.trim())
    setRejectTarget(null)
    setRejectComment('')
    setRejectError('')
  }, [rejectTarget, rejectComment, applyStatus])

  const cancelReject = useCallback(() => {
    setRejectTarget(null)
    setRejectComment('')
    setRejectError('')
  }, [])

  return {
    orders, columns, loading, error, lastRefresh, updating,
    selectedOrder, setSelectedOrder,
    rejectTarget, rejectComment, setRejectComment, rejectError,
    handleStart, handlePause, handleResume, handleReady, handleDeliver,
    openReject, confirmReject, cancelReject,
    refresh: () => load(),
  }
}
