import { useState, useEffect, useCallback } from 'react'
import {
  getStoreOrders,
  getStoreOrderById,
  updateStoreOrderStatus,
  type ApiStoreOrder,
  type StoreOrderStatus,
} from '@/services/core/store-orders-service'

export type { ApiStoreOrder, StoreOrderStatus }

export const STORE_ORDER_FILTER_STATUSES: Array<{ key: string; label: string }> = [
  { key: 'Todos', label: 'Todos' },
  { key: 'PENDING', label: 'Pendiente' },
  { key: 'CONFIRMED', label: 'Confirmado' },
  { key: 'DELIVERED', label: 'Entregado' },
  { key: 'CANCELLED', label: 'Cancelado' },
]

const PER_PAGE = 10

export function useStoreOrders() {
  const [orders, setOrders] = useState<ApiStoreOrder[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [page, setPage] = useState(1)

  const [detailOrder, setDetailOrder] = useState<ApiStoreOrder | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getStoreOrders({
        page,
        limit: PER_PAGE,
        ...(statusFilter !== 'Todos' && { status: statusFilter as StoreOrderStatus }),
      })
      setOrders(res.data)
      setTotal(res.meta.total)
    } catch {
      setError('Error al cargar pedidos')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  const handleChangeStatusFilter = useCallback((key: string) => {
    setStatusFilter(key)
    setPage(1)
  }, [])

  const handleOpenDetail = useCallback(async (order: ApiStoreOrder) => {
    setDetailOpen(true)
    setDetailOrder(order)
    try {
      setDetailOrder(await getStoreOrderById(order.id))
    } catch {
      // se queda con el resumen que ya traía del listado
    }
  }, [])

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false)
    setDetailOrder(null)
  }, [])

  const handleUpdateStatus = useCallback(async (id: string, status: StoreOrderStatus) => {
    setUpdating(true)
    try {
      const updated = await updateStoreOrderStatus(id, status)
      setDetailOrder((prev) => (prev?.id === id ? { ...prev, ...updated } : prev))
      await load()
    } catch {
      alert('No se pudo actualizar el pedido. Revisa el stock disponible e intenta de nuevo.')
    } finally {
      setUpdating(false)
    }
  }, [load])

  return {
    orders, total, loading, error, load,
    statusFilter, handleChangeStatusFilter,
    page, setPage,
    detailOpen, detailOrder, updating,
    handleOpenDetail, handleCloseDetail, handleUpdateStatus,
  }
}
