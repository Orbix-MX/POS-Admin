import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  fetchPurchaseOrders,
  fetchPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  sendPurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
  fmtMoney,
  type ApiPurchaseOrder,
  type PurchaseOrderStatus,
  type CreatePurchaseOrderItemInput,
  type ReceiveItemInput,
} from '@/services/retail/compras-service'
import {
  registerPayablePayment,
  type RegisterPaymentInput,
  type SupplierPaymentMethod,
} from '@/services/core/payables-service'

export type { ApiPurchaseOrder, PurchaseOrderStatus }
export type { SupplierPaymentMethod }

export const FILTER_STATUSES: Array<{ key: string; label: string }> = [
  { key: 'Todos',      label: 'Todos'      },
  { key: 'BORRADOR',   label: 'Borrador'   },
  { key: 'ENVIADA',    label: 'Enviada'    },
  { key: 'PARCIAL',    label: 'Parcial'    },
  { key: 'COMPLETADA', label: 'Completada' },
  { key: 'CANCELADA',  label: 'Cancelada'  },
]

export interface OrderFormItem {
  productId: string
  productName: string
  productSku: string
  quantityOrdered: number
  unitCost: number
  tax: number
}

export interface OrderForm {
  supplierId: string
  expectedDate: string
  notes: string
  items: OrderFormItem[]
}

export interface ReceiveForm {
  items: Array<{ productId: string; productName: string; quantityOrdered: number; alreadyReceived: number; quantityReceived: number }>
  notes: string
  branchId: string
}

const EMPTY_ORDER_FORM: OrderForm = {
  supplierId: '',
  expectedDate: '',
  notes: '',
  items: [],
}

const PER_PAGE = 8

export function useCompras() {
  // ---- list state ----
  const [orders, setOrders] = useState<ApiPurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [page, setPage] = useState(1)

  // ---- create/edit modal ----
  const [createOpen, setCreateOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<ApiPurchaseOrder | null>(null)
  const [orderForm, setOrderForm] = useState<OrderForm>(EMPTY_ORDER_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ---- detail modal ----
  const [detailOrder, setDetailOrder] = useState<ApiPurchaseOrder | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // ---- receive modal ----
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveOrderId, setReceiveOrderId] = useState<string | null>(null)
  const [receiveForm, setReceiveForm] = useState<ReceiveForm>({ items: [], notes: '', branchId: '' })
  const [receiving, setReceiving] = useState(false)
  const [receiveError, setReceiveError] = useState<string | null>(null)

  // ---- payment modal ----
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAccountPayableId, setPaymentAccountPayableId] = useState<string | null>(null)
  const [paymentBalance, setPaymentBalance] = useState(0)
  const [paymentForm, setPaymentForm] = useState<RegisterPaymentInput & { _method: SupplierPaymentMethod }>({
    amount: 0,
    paymentMethod: 'CASH',
    _method: 'CASH',
    reference: '',
    notes: '',
  })
  const [paying, setPaying] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // ---- load orders ----
  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchPurchaseOrders({ limit: 100, page: 1 })
      setOrders(res.data)
    } catch {
      setError('Error al cargar órdenes de compra')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  // ---- filtering & pagination ----
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return orders.filter(o => {
      const matchSearch = !q
        || o.orderNumber.toLowerCase().includes(q)
        || o.supplier.name.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'Todos' || o.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [search, statusFilter, orders])

  const pageData = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [page, filtered]
  )

  // ---- stats (single pass) ----
  const stats = useMemo(() => {
    let totalGasto = 0, completadas = 0, enviadas = 0, borradores = 0
    for (const o of orders) {
      if (o.status === 'COMPLETADA') { totalGasto += parseFloat(String(o.total)); completadas++ }
      else if (o.status === 'ENVIADA' || o.status === 'PARCIAL') enviadas++
      else if (o.status === 'BORRADOR') borradores++
    }
    return {
      totalGasto: fmtMoney(totalGasto),
      completadas,
      enviadas,
      borradores,
      total: orders.length,
    }
  }, [orders])

  // ---- open create ----
  const handleOpenCreate = useCallback(() => {
    setOrderForm(EMPTY_ORDER_FORM)
    setFormError(null)
    setEditingOrder(null)
    setCreateOpen(true)
  }, [])

  // ---- open edit ----
  const handleOpenEdit = useCallback((order: ApiPurchaseOrder) => {
    setEditingOrder(order)
    setOrderForm({
      supplierId: order.supplierId,
      expectedDate: order.expectedDate ? order.expectedDate.split('T')[0] : '',
      notes: order.notes ?? '',
      items: order.items.map(i => ({
        productId: i.productId,
        productName: i.product.name,
        productSku: i.product.sku,
        quantityOrdered: i.quantityOrdered,
        unitCost: parseFloat(String(i.unitCost)),
        tax: parseFloat(String(i.tax)),
      })),
    })
    setFormError(null)
    setCreateOpen(true)
  }, [])

  const handleCloseCreate = useCallback(() => {
    setCreateOpen(false)
    setEditingOrder(null)
    setOrderForm(EMPTY_ORDER_FORM)
    setFormError(null)
  }, [])

  // ---- save order ----
  const handleSaveOrder = useCallback(async () => {
    if (!orderForm.supplierId) { setFormError('Selecciona un proveedor'); return }
    if (orderForm.items.length === 0) { setFormError('Agrega al menos un producto'); return }
    for (const i of orderForm.items) {
      if (i.quantityOrdered < 1) { setFormError(`Cantidad inválida para ${i.productName}`); return }
      if (i.unitCost < 0) { setFormError(`Costo inválido para ${i.productName}`); return }
    }
    setSaving(true)
    setFormError(null)
    try {
      const items: CreatePurchaseOrderItemInput[] = orderForm.items.map(i => ({
        productId: i.productId,
        quantityOrdered: i.quantityOrdered,
        unitCost: i.unitCost,
        tax: i.tax,
      }))
      if (editingOrder) {
        await updatePurchaseOrder(editingOrder.id, {
          supplierId: orderForm.supplierId,
          expectedDate: orderForm.expectedDate || undefined,
          notes: orderForm.notes || undefined,
          items,
        })
      } else {
        await createPurchaseOrder({
          supplierId: orderForm.supplierId,
          expectedDate: orderForm.expectedDate || undefined,
          notes: orderForm.notes || undefined,
          items,
        })
      }
      await loadOrders()
      handleCloseCreate()
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? 'Error al guardar la orden')
    } finally {
      setSaving(false)
    }
  }, [orderForm, editingOrder, loadOrders, handleCloseCreate])

  // ---- detail ----
  const handleOpenDetail = useCallback(async (order: ApiPurchaseOrder) => {
    setDetailOrder(order)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const full = await fetchPurchaseOrder(order.id)
      setDetailOrder(full)
    } catch {
      // show what we have
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false)
    setDetailOrder(null)
  }, [])

  // ---- send order ----
  const handleSend = useCallback(async (id: string) => {
    try {
      await sendPurchaseOrder(id)
      await loadOrders()
      if (detailOrder?.id === id) {
        const full = await fetchPurchaseOrder(id)
        setDetailOrder(full)
      }
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al enviar la orden')
    }
  }, [loadOrders, detailOrder])

  // ---- cancel order ----
  const handleCancel = useCallback(async (id: string) => {
    if (!confirm('¿Cancelar esta orden de compra?')) return
    try {
      await cancelPurchaseOrder(id)
      await loadOrders()
      if (detailOrder?.id === id) {
        const full = await fetchPurchaseOrder(id)
        setDetailOrder(full)
      }
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al cancelar la orden')
    }
  }, [loadOrders, detailOrder])

  // ---- open receive modal ----
  const handleOpenReceive = useCallback((order: ApiPurchaseOrder) => {
    const alreadyReceived: Record<string, number> = {}
    for (const r of order.receipts ?? []) {
      for (const ri of r.items) {
        alreadyReceived[ri.productId] = (alreadyReceived[ri.productId] ?? 0) + ri.quantityReceived
      }
    }
    setReceiveForm({
      items: order.items.map(i => ({
        productId: i.productId,
        productName: i.product.name,
        quantityOrdered: i.quantityOrdered,
        alreadyReceived: alreadyReceived[i.productId] ?? 0,
        quantityReceived: 0,
      })),
      notes: '',
      branchId: '',
    })
    setReceiveOrderId(order.id)
    setReceiveError(null)
    setReceiveOpen(true)
  }, [])

  const handleCloseReceive = useCallback(() => {
    setReceiveOpen(false)
    setReceiveOrderId(null)
    setReceiveError(null)
  }, [])

  const handleReceive = useCallback(async () => {
    if (!receiveOrderId) return
    const toReceive = receiveForm.items.filter(i => i.quantityReceived > 0)
    if (toReceive.length === 0) { setReceiveError('Ingresa al menos una cantidad mayor a 0'); return }
    for (const i of receiveForm.items) {
      const remaining = i.quantityOrdered - i.alreadyReceived
      if (i.quantityReceived > remaining) {
        setReceiveError(`${i.productName}: máximo ${remaining} por recibir`)
        return
      }
    }
    setReceiving(true)
    setReceiveError(null)
    try {
      const items: ReceiveItemInput[] = receiveForm.items.map(i => ({
        productId: i.productId,
        quantityReceived: i.quantityReceived,
      }))
      await receivePurchaseOrder(receiveOrderId, {
        items,
        notes: receiveForm.notes || undefined,
        branchId: receiveForm.branchId || undefined,
      })
      await loadOrders()
      handleCloseReceive()
      if (detailOrder?.id === receiveOrderId) {
        const full = await fetchPurchaseOrder(receiveOrderId)
        setDetailOrder(full)
      }
    } catch (e: any) {
      setReceiveError(e?.response?.data?.message ?? 'Error al registrar recepción')
    } finally {
      setReceiving(false)
    }
  }, [receiveOrderId, receiveForm, loadOrders, handleCloseReceive, detailOrder])

  // ---- payment handlers ----
  const handleOpenPayment = useCallback((accountPayableId: string, balance: number) => {
    setPaymentAccountPayableId(accountPayableId)
    setPaymentBalance(balance)
    setPaymentForm({ amount: 0, paymentMethod: 'CASH', _method: 'CASH', reference: '', notes: '' })
    setPaymentError(null)
    setPaymentOpen(true)
  }, [])

  const handleClosePayment = useCallback(() => {
    setPaymentOpen(false)
    setPaymentAccountPayableId(null)
    setPaymentError(null)
  }, [])

  const handlePay = useCallback(async () => {
    if (!paymentAccountPayableId) return
    if (!paymentForm.amount || paymentForm.amount <= 0) { setPaymentError('El monto debe ser mayor a 0'); return }
    if (paymentForm.amount > paymentBalance) { setPaymentError(`El monto no puede exceder el saldo ($${paymentBalance})`); return }
    setPaying(true)
    setPaymentError(null)
    try {
      const input: RegisterPaymentInput = {
        amount: paymentForm.amount,
        paymentMethod: paymentForm.paymentMethod,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      }
      await registerPayablePayment(paymentAccountPayableId, input)
      await loadOrders()
      handleClosePayment()
      if (detailOrder) {
        const full = await fetchPurchaseOrder(detailOrder.id)
        setDetailOrder(full)
      }
    } catch (e: any) {
      setPaymentError(e?.response?.data?.message ?? 'Error al registrar el pago')
    } finally {
      setPaying(false)
    }
  }, [paymentAccountPayableId, paymentForm, paymentBalance, loadOrders, handleClosePayment, detailOrder])

  return {
    // list
    orders, loading, error, loadOrders,
    search, setSearch,
    statusFilter, setStatusFilter,
    page, setPage,
    filtered, pageData, stats,
    // create/edit
    createOpen, editingOrder, orderForm, setOrderForm,
    saving, formError,
    handleOpenCreate, handleOpenEdit, handleCloseCreate, handleSaveOrder,
    // detail
    detailOpen, detailOrder, detailLoading,
    handleOpenDetail, handleCloseDetail,
    // actions
    handleSend, handleCancel,
    // receive
    receiveOpen, receiveForm, setReceiveForm, receiving, receiveError,
    handleOpenReceive, handleCloseReceive, handleReceive,
    // payment
    paymentOpen, paymentAccountPayableId, paymentBalance, paymentForm, setPaymentForm,
    paying, paymentError,
    handleOpenPayment, handleClosePayment, handlePay,
  }
}
