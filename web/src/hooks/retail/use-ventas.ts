import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  getOrders,
  updateOrderStatus,
  fmtMoney,
  fmtDate,
  customerName,
  type ApiOrder,
  type OrderOriginType,
  type OrderStatus,
  type ListResponse,
} from '@/services/retail/ventas-service'
import { useTenantFeatures } from '@/hooks/use-tenant-features'

export type { ApiOrder, OrderStatus, OrderOriginType }
export { fmtMoney, fmtDate, customerName }

export const ORDER_FILTER_STATUSES: Array<{ key: string; label: string }> = [
  { key: 'Todos',       label: 'Todos'       },
  { key: 'PENDING',     label: 'Pendiente'   },
  { key: 'CONFIRMED',   label: 'Confirmada'  },
  { key: 'PROCESSING',  label: 'Procesando'  },
  { key: 'DELIVERED',   label: 'Entregada'   },
  { key: 'CANCELLED',   label: 'Cancelada'   },
]

export const ORDER_ORIGIN_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'Todos',               label: 'Todos'       },
  { key: 'RETAIL_POS',         label: 'POS'         },
  { key: 'RESTAURANT_COMANDA', label: 'Restaurante' },
]

const PER_PAGE = 8

export function useVentas() {
  const { hasVertical } = useTenantFeatures()
  const isRestaurant = hasVertical('RESTAURANT')
  const isRetail     = hasVertical('RETAIL')
  const isMixed      = !isRestaurant && !isRetail

  // showOrigin: true when tenant has restaurant OR is mixed (multi-vertical)
  const showOriginColumn  = isRestaurant || isMixed
  const showOriginFilters = isRestaurant || isMixed

  const [orders, setOrders]             = useState<ApiOrder[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  // Default origin filter: RESTAURANT when restaurant-only tenant, else Todos
  const [originFilter, setOriginFilter] = useState<string>(
    isRestaurant && !isMixed ? 'RESTAURANT_COMANDA' : 'Todos'
  )
  const [page, setPage] = useState(1)

  // detail drawer
  const [detailOrder, setDetailOrder] = useState<ApiOrder | null>(null)
  const [detailOpen, setDetailOpen]   = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res: ListResponse<ApiOrder> = await getOrders({ limit: 100, page: 1 })
      setOrders(res.data)
    } catch {
      setError('Error al cargar ventas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    // For pure retail: ignore origin filter, always match
    const effectiveOriginFilter = isRetail && !isMixed ? 'Todos' : originFilter
    return orders.filter(o => {
      const name = customerName(o.customer).toLowerCase()
      const matchSearch = !q
        || o.orderNumber.toLowerCase().includes(q)
        || name.includes(q)
      const matchStatus = statusFilter === 'Todos' || o.status === statusFilter
      const matchOrigin = effectiveOriginFilter === 'Todos'
        || o.orderOrigin === effectiveOriginFilter
        || (effectiveOriginFilter === 'RETAIL_POS' && o.orderOrigin == null && o.tableNumber == null)
        || (effectiveOriginFilter === 'RESTAURANT_COMANDA' && o.orderOrigin == null && o.tableNumber != null)
      return matchSearch && matchStatus && matchOrigin
    })
  }, [search, statusFilter, originFilter, orders, isRetail, isMixed])

  const pageData = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [page, filtered]
  )

  const stats = useMemo(() => {
    let totalRevenue = 0
    let pagadas = 0, pendientes = 0, canceladas = 0
    let retail = 0, restaurant = 0
    for (const o of orders) {
      if (o.paymentStatus === 'PAID') { totalRevenue += Number(o.total); pagadas++ }
      else if (o.status === 'CANCELLED') canceladas++
      else pendientes++
      const isRest = o.orderOrigin === 'RESTAURANT_COMANDA'
        || (o.orderOrigin == null && o.tableNumber != null)
      if (isRest) restaurant++; else retail++
    }
    return {
      total: orders.length,
      totalRevenue: fmtMoney(totalRevenue),
      pagadas,
      pendientes,
      canceladas,
      retail,
      restaurant,
    }
  }, [orders])

  const handleOpenDetail = useCallback((order: ApiOrder) => {
    setDetailOrder(order)
    setDetailOpen(true)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false)
    setDetailOrder(null)
  }, [])

  const handleUpdateStatus = useCallback(async (id: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(id, status)
      await loadOrders()
      if (detailOrder?.id === id) {
        const updated = orders.find(o => o.id === id)
        if (updated) setDetailOrder({ ...updated, status })
      }
    } catch {
      alert('Error al actualizar estado')
    }
  }, [loadOrders, detailOrder, orders])

  return {
    orders, loading, error, loadOrders,
    search, setSearch,
    statusFilter, setStatusFilter,
    originFilter, setOriginFilter,
    page, setPage,
    filtered, pageData, stats,
    detailOpen, detailOrder,
    handleOpenDetail, handleCloseDetail,
    handleUpdateStatus,
    // vertical context
    showOriginColumn,
    showOriginFilters,
    isRestaurant,
    isRetail,
  }
}
