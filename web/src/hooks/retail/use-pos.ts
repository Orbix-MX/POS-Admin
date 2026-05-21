import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useERPStore } from '@/store/erp-store'
import { fetchProducts, type Product } from '@/services/retail/product-service'
import { fetchCliente, fetchClientes, type Cliente } from '@/services/core/clientes-service'
import { fetchServices, type Service } from '@/services/retail/services-service'
import { createOrder, updateOrderStatus, addOrderPayment } from '@/services/retail/ventas-service'
import { fetchQuote, fetchQuotesByCustomer, createQuote, type ServiceQuote } from '@/services/retail/cotizaciones-service'
import { fetchActiveCashSession, type ApiCashSession } from '@/services/core/caja-service'
import { fetchSettings } from '@/services/core/configuracion-service'

export type { Product, Cliente, Service }

export type POSStage = 'cart' | 'checkout' | 'pending_card' | 'success'

export interface HoldSale {
  id: string
  label: string
  createdAt: string
  carrito: CartItem[]
  cliente: Cliente | null
  total: number
  orderId?: string
  orderNumber?: string
  paidAmount?: number
}

export type CartItemType = 'PRODUCT' | 'SERVICE'

export interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  qty: number
  type: CartItemType
  serviceId?: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

export { fmt }

export function usePOS() {
  const { setPosOpen, pendingQuoteId, setPendingQuoteId } = useERPStore()

  // ---- catalog ----
  const [products, setProducts]   = useState<Product[]>([])
  const [clientes, setClientes]   = useState<Cliente[]>([])
  const [services, setServices]   = useState<Service[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogTab, setCatalogTab] = useState<'products' | 'services'>('products')
  const [serviceSearch, setServiceSearch] = useState('')
  // manual service capture
  const [manualServiceOpen, setManualServiceOpen] = useState(false)
  const [manualService, setManualService] = useState({ name: '', price: '' })

  // ---- product filter ----
  const [search, setSearch]       = useState('')
  const searchRef                 = useRef<HTMLInputElement>(null)

  // ---- cart ----
  const [carrito, setCarrito]     = useState<CartItem[]>([])
  const [stockWarning, setStockWarning] = useState<string | null>(null)
  const stockWarnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashStockWarning = useCallback((msg: string) => {
    setStockWarning(msg)
    if (stockWarnTimer.current) clearTimeout(stockWarnTimer.current)
    stockWarnTimer.current = setTimeout(() => setStockWarning(null), 2500)
  }, [])

  // ---- customer ----
  const [cliente, setCliente]     = useState<Cliente | null>(null)
  const [showClienteDD, setShowClienteDD] = useState(false)
  const [clienteSearch, setClienteSearch] = useState('')

  // ---- checkout ----
  const [stage, setStage]         = useState<POSStage>('cart')
  const [efectivo, setEfectivo]   = useState('')
  const [efectivoUsd, setEfectivoUsd] = useState('')
  const [tarjeta, setTarjeta]     = useState('')
  const [exchangeRate, setExchangeRate] = useState(1)
  const [cashChangeCurrency, setCashChangeCurrency] = useState<'MXN' | 'USD'>('MXN')
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // ---- pending card ----
  const [pendingOrderId, setPendingOrderId]         = useState<string | null>(null)
  const [pendingOrderNumber, setPendingOrderNumber] = useState<string | null>(null)
  const [confirming, setConfirming]                 = useState(false)

  // ---- success ----
  const [successNumber, setSuccessNumber] = useState<string | null>(null)

  // ---- loaded quote ----
  const [loadedQuoteId, setLoadedQuoteId] = useState<string | null>(null)
  const [loadedQuoteNumber, setLoadedQuoteNumber] = useState<string | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)

  // ---- cliente quotes panel ----
  const [clienteQuotes, setClienteQuotes] = useState<ServiceQuote[]>([])
  const [clienteQuotesLoading, setClienteQuotesLoading] = useState(false)
  const [quotePanelOpen, setQuotePanelOpen] = useState(false)

  // ---- save as quote ----
  const [savingQuote, setSavingQuote] = useState(false)
  const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null)

  // ---- active cash session (gate) ----
  const [activeCashSession, setActiveCashSession] = useState<ApiCashSession | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)

  // ---- hold sales ----
  const [holdSales, setHoldSales] = useState<HoldSale[]>(() => {
    try { return JSON.parse(localStorage.getItem('pos_hold_sales') ?? '[]') }
    catch { return [] }
  })

  // ---- layaway settlement ----
  const [layawayOrderId, setLayawayOrderId] = useState<string | null>(null)
  const [layawayOrderNumber, setLayawayOrderNumber] = useState<string | null>(null)
  const [layawayPaidAmount, setLayawayPaidAmount] = useState(0)

  // ---- load quote into cart ----
  const loadQuoteIntoCart = useCallback(async (quoteId: string) => {
    setQuoteLoading(true)
    try {
      const quote = await fetchQuote(quoteId)
      if (quote.status !== 'APPROVED') return

      const quoteCliente = await fetchCliente(quote.customerId)

      const items: CartItem[] = quote.items.map((item) => {
        const isProduct = item.itemType === 'PRODUCT'
        if (isProduct && item.productId) {
          return {
            id: item.productId,
            name: item.description,
            sku: item.sku ?? item.product?.sku ?? '',
            price: Number(item.unitPrice),
            stock: 9999,
            qty: item.quantity,
            type: 'PRODUCT' as const,
          }
        }
        const cartId = item.serviceId ? `svc-${item.serviceId}` : `manual-svc-${item.id}`
        return {
          id: cartId,
          name: item.description,
          sku: 'SVC',
          price: Number(item.unitPrice),
          stock: 9999,
          qty: item.quantity,
          type: 'SERVICE' as const,
          ...(item.serviceId ? { serviceId: item.serviceId } : {}),
        }
      })

      setCarrito(items)
      setCliente(quoteCliente)
      setLoadedQuoteId(quoteId)
      setLoadedQuoteNumber(quote.quoteNumber)
      setQuotePanelOpen(false)
    } catch {
      // silently ignore — user can still use POS normally
    } finally {
      setQuoteLoading(false)
    }
  }, [])

  // ---- save cart as quote ----
  const saveAsQuote = useCallback(async () => {
    if (!cliente) return
    if (carrito.length === 0) return
    setSavingQuote(true)
    setSavedQuoteNumber(null)
    try {
      const quote = await createQuote({
        customerId: cliente.id,
        items: carrito.map((i) => {
          if (i.type === 'PRODUCT') {
            return { itemType: 'PRODUCT' as const, productId: i.id, sku: i.sku, description: i.name, quantity: i.qty, unitPrice: i.price }
          }
          return { itemType: 'SERVICE' as const, serviceId: i.serviceId, description: i.name, quantity: i.qty, unitPrice: i.price }
        }),
      })
      setSavedQuoteNumber(quote.quoteNumber)
      // Refresh cliente quotes panel
      const updated = await fetchQuotesByCustomer(cliente.id)
      setClienteQuotes(updated)
    } catch {
      alert('Error al guardar cotización')
    } finally {
      setSavingQuote(false)
    }
  }, [cliente, carrito])

  // React when a pending quote is set in the store
  useEffect(() => {
    if (pendingQuoteId) {
      setPendingQuoteId(null)
      loadQuoteIntoCart(pendingQuoteId)
    }
  }, [pendingQuoteId, setPendingQuoteId, loadQuoteIntoCart])

  // ---- load cliente quotes when cliente changes ----
  useEffect(() => {
    if (!cliente?.id) {
      setClienteQuotes([])
      setQuotePanelOpen(false)
      return
    }
    setClienteQuotesLoading(true)
    fetchQuotesByCustomer(cliente.id)
      .then((quotes) => setClienteQuotes(quotes))
      .catch(() => setClienteQuotes([]))
      .finally(() => setClienteQuotesLoading(false))
  }, [cliente?.id])

  // ---- load TC from active cash session + cashChangeCurrency from settings ----
  useEffect(() => {
    fetchActiveCashSession()
      .then(session => {
        setActiveCashSession(session)
        setSessionChecked(true)
        if (session) setExchangeRate(Number(session.exchangeRateUsdMxn) || 1)
      })
      .catch(() => { setActiveCashSession(null); setSessionChecked(true) })
    fetchSettings()
      .then(s => {
        if (s.cashChangeCurrency === 'MXN' || s.cashChangeCurrency === 'USD') {
          setCashChangeCurrency(s.cashChangeCurrency)
        }
      })
      .catch(() => {})
  }, [])

  const refreshSession = useCallback(async () => {
    try {
      const session = await fetchActiveCashSession()
      setActiveCashSession(session)
      if (session) setExchangeRate(Number(session.exchangeRateUsdMxn) || 1)
    } catch {
      setActiveCashSession(null)
    }
  }, [])

  // ---- load catalog ----
  useEffect(() => {
    setCatalogLoading(true)
    Promise.all([fetchProducts(), fetchClientes(), fetchServices({ isActive: true, limit: 200 })])
      .then(([prodRes, clts, svcRes]) => {
        setProducts(prodRes.data ?? [])
        setClientes(clts)
        setServices(svcRes.data ?? [])
      })
      .catch(() => {})
      .finally(() => setCatalogLoading(false))
  }, [])

  // ---- filtered products ----
  const productosFiltrados = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p => {
      if (p.status !== 'ACTIVE') return false
      return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    })
  }, [search, products])

  // ---- filtered services ----
  const serviciosFiltrados = useMemo(() => {
    const q = serviceSearch.toLowerCase()
    return services.filter(s =>
      !q || s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q),
    )
  }, [serviceSearch, services])

  // ---- filtered customers ----
  const clientesFiltrados = useMemo(() => {
    const q = clienteSearch.toLowerCase()
    return !q ? clientes : clientes.filter(c =>
      c.nombre.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    )
  }, [clienteSearch, clientes])

  // ---- totals ----
  const totals = useMemo(() => {
    let subtotal = 0
    let itemCount = 0
    for (const i of carrito) {
      subtotal += i.price * i.qty
      itemCount += i.qty
    }
    return { subtotal, total: subtotal, itemCount }
  }, [carrito])

  // ---- credit eligibility ----
  const creditBlockReason = useMemo((): string | null => {
    if (!cliente) return 'Selecciona un cliente para usar crédito'
    if (cliente.estado !== 'Activo') return 'Cliente inactivo — sin crédito disponible'
    if (!cliente.hasCredit) return 'El cliente no tiene crédito habilitado'
    if (!cliente.creditDays || cliente.creditDays < 1) return 'El cliente no tiene días de crédito configurados'
    return null
  }, [cliente])

  const clienteCanCredit = creditBlockReason === null

  // ---- checkout computed ----
  const checkoutVals = useMemo(() => {
    const total       = totals.total
    const ef          = Math.max(0, parseFloat(efectivo) || 0)
    const efUsd       = Math.max(0, parseFloat(efectivoUsd) || 0)
    const efUsdEnMxn  = Math.round(efUsd * exchangeRate * 100) / 100
    const tar         = Math.max(0, parseFloat(tarjeta)  || 0)

    // Apply card first, then MXN, then USD toward the remaining
    const remainingAfterCard = Math.max(0, total - tar)
    const mxnApplied  = Math.min(ef, remainingAfterCard)
    const remainingAfterMxn = Math.max(0, remainingAfterCard - mxnApplied)
    const usdApplied  = remainingAfterMxn > 0 ? Math.min(efUsd, remainingAfterMxn / exchangeRate) : 0

    // Unified change: excess cash in MXN → convert to cashChangeCurrency
    const totalCashPaidMxn = ef + efUsdEnMxn
    const changeRawMxn = Math.max(0, Math.round((totalCashPaidMxn - remainingAfterCard) * 100) / 100)
    const cambio = cashChangeCurrency === 'USD'
      ? Math.round(changeRawMxn / exchangeRate * 100) / 100
      : changeRawMxn

    const totalCovered = ef + efUsdEnMxn + tar
    const rawCredito  = Math.max(0, total - totalCovered)
    const credito     = clienteCanCredit ? rawCredito : 0
    const hasCard     = tar > 0
    const hasCredit   = credito > 0
    const creditBlocked = rawCredito > 0 && !clienteCanCredit
    return {
      total, ef, efUsd, efUsdEnMxn, tar, totalCovered,
      mxnApplied, usdApplied,
      cambio, cashChangeCurrency,
      credito, rawCredito,
      hasCard, hasCredit, creditBlocked,
    }
  }, [totals.total, efectivo, efectivoUsd, tarjeta, exchangeRate, cashChangeCurrency, clienteCanCredit])

  // ---- cart actions ----
  const addToCart = useCallback((p: Product) => {
    if (!p.id) return
    const existing = carrito.find(i => i.id === p.id && i.type === 'PRODUCT')
    if (existing) {
      if (existing.qty >= p.stock) {
        flashStockWarning(`Stock máximo de "${p.name}" alcanzado (${p.stock} disponibles)`)
        return
      }
      setCarrito(prev => prev.map(i => i.id === p.id && i.type === 'PRODUCT' ? { ...i, qty: i.qty + 1 } : i))
      return
    }
    if (p.stock <= 0) {
      flashStockWarning(`"${p.name}" sin stock disponible`)
      return
    }
    setCarrito(prev => [...prev, { id: p.id!, name: p.name, sku: p.sku, price: Number(p.price), stock: p.stock, qty: 1, type: 'PRODUCT' as const }])
  }, [carrito, flashStockWarning])

  const addServiceToCart = useCallback((s: Service, customPrice?: number) => {
    const price = customPrice ?? Number(s.basePrice)
    const cartId = `svc-${s.id}`
    setCarrito(prev => {
      const existing = prev.find(i => i.id === cartId && i.type === 'SERVICE')
      if (existing) {
        return prev.map(i => i.id === cartId && i.type === 'SERVICE' ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { id: cartId, name: s.name, sku: 'SVC', price, stock: 9999, qty: 1, type: 'SERVICE' as const, serviceId: s.id }]
    })
  }, [])

  const addManualService = useCallback(() => {
    const name = manualService.name.trim()
    const price = parseFloat(manualService.price) || 0
    if (!name || price < 0) return
    const cartId = `manual-svc-${Date.now()}`
    setCarrito(prev => [
      ...prev,
      { id: cartId, name, sku: 'SVC', price, stock: 9999, qty: 1, type: 'SERVICE' as const },
    ])
    setManualService({ name: '', price: '' })
    setManualServiceOpen(false)
  }, [manualService])

  const updateQty = useCallback((id: string, delta: number) => {
    const item = carrito.find(i => i.id === id)
    if (item && delta > 0 && item.type === 'PRODUCT' && item.qty + delta > item.stock) {
      flashStockWarning(`Stock máximo de "${item.name}" alcanzado (${item.stock} disponibles)`)
    }
    setCarrito(prev => prev.map(i =>
      i.id === id ? { ...i, qty: Math.max(1, Math.min(i.qty + delta, i.stock)) } : i
    ))
  }, [carrito, flashStockWarning])

  const removeItem = useCallback((id: string) => {
    setCarrito(prev => prev.filter(i => i.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    setCarrito([])
    setCliente(null)
    setEfectivo('')
    setEfectivoUsd('')
    setTarjeta('')
    setCheckoutError(null)
    setStage('cart')
    setLoadedQuoteId(null)
    setLoadedQuoteNumber(null)
    setSavedQuoteNumber(null)
    setLayawayOrderId(null)
    setLayawayOrderNumber(null)
    setLayawayPaidAmount(0)
  }, [])

  // ---- customer ----
  const selectCliente = useCallback((c: Cliente) => {
    setCliente(c)
    setShowClienteDD(false)
    setClienteSearch('')
  }, [])

  const clearCliente = useCallback(() => {
    setCliente(null)
    if (checkoutVals.rawCredito > 0) {
      setTarjeta('')
      setEfectivo('')
    }
  }, [checkoutVals.rawCredito])

  // ---- open checkout ----
  const openCheckout = useCallback(() => {
    if (carrito.length === 0) return
    setCheckoutError(null)
    setEfectivo('')
    setEfectivoUsd('')
    setTarjeta('')
    setStage('checkout')
  }, [carrito.length])

  const backToCart = useCallback(() => {
    setStage('cart')
    setCheckoutError(null)
  }, [])

  // ---- submit order ----
  const handleConfirmarPago = useCallback(async () => {
    const {
      total, ef, efUsd, tar, credito, hasCard, hasCredit, creditBlocked, rawCredito,
      mxnApplied, usdApplied, cambio, cashChangeCurrency,
    } = checkoutVals

    if (carrito.length === 0) { setCheckoutError('Agrega productos al carrito'); return }
    if (isNaN(ef) || isNaN(tar) || ef < 0 || tar < 0 || efUsd < 0) { setCheckoutError('Montos inválidos'); return }
    if (tar > total + 0.01) { setCheckoutError('El monto con tarjeta excede el total de la venta'); return }
    if (ef === 0 && efUsd === 0 && tar === 0 && !clienteCanCredit) { setCheckoutError('Ingresa el monto recibido para continuar'); return }
    if (creditBlocked) {
      setCheckoutError(creditBlockReason ?? 'Crédito no disponible para este cliente')
      return
    }
    if (rawCredito > 0 && !clienteCanCredit) {
      setCheckoutError('Monto insuficiente — agrega efectivo o tarjeta para completar el pago')
      return
    }

    // Build payment splits — amountReceived = full received; change handled at order level
    const payments: Array<{ method: string; currency: 'MXN' | 'USD'; amount: number; amountReceived?: number }> = []
    const r = (n: number) => Math.round(n * 100) / 100
    if (mxnApplied > 0) payments.push({
      method: 'CASH', currency: 'MXN',
      amount: r(mxnApplied),
      amountReceived: r(ef),
    })
    if (usdApplied > 0) payments.push({
      method: 'CASH', currency: 'USD',
      amount: r(usdApplied),
      amountReceived: r(efUsd),
    })
    if (tar > 0)     payments.push({ method: 'CARD',    currency: 'MXN', amount: r(tar) })
    if (credito > 0) payments.push({ method: 'CREDITO', currency: 'MXN', amount: r(credito) })

    const primaryMethod = payments[0]?.method ?? 'CASH'
    const allCash = !hasCard && !hasCredit
    const paymentStatus = allCash ? 'PAID' : 'PENDING'
    const orderStatus   = allCash ? 'CONFIRMED' : 'PENDING'

    const creditDaysVal = cliente?.creditDays ?? 30
    const dueDate = hasCredit
      ? new Date(Date.now() + creditDaysVal * 24 * 60 * 60 * 1000).toISOString()
      : undefined

    const hasCash = mxnApplied > 0 || usdApplied > 0

    setSubmitting(true)
    setCheckoutError(null)
    try {
      let order
      if (layawayOrderId) {
        // Settle existing layaway order
        order = await addOrderPayment(layawayOrderId, {
          payments,
          ...(hasCash && cambio > 0 && { changeAmount: r(cambio), changeCurrency: cashChangeCurrency }),
          paymentConcept: 'BALANCE_PAYMENT',
        })
      } else {
        order = await createOrder({
          customerId:    cliente?.id,
          items: carrito.map(i => {
            if (i.type === 'SERVICE') {
              return { itemType: 'SERVICE' as const, serviceId: i.serviceId, name: i.name, quantity: i.qty, price: i.price }
            }
            return { productId: i.id, quantity: i.qty, price: i.price }
          }),
          paymentMethod: primaryMethod,
          payments:      payments.length > 1 || (payments.length === 1 && payments[0].amountReceived != null) ? payments : undefined,
          paymentStatus,
          status:        orderStatus,
          dueDate,
          ...(hasCash && cambio > 0 && { changeAmount: r(cambio), changeCurrency: cashChangeCurrency }),
          ...(loadedQuoteId ? { sourceQuoteId: loadedQuoteId } : {}),
        })
      }

      if (hasCard) {
        setPendingOrderId(order.id)
        setPendingOrderNumber(order.orderNumber)
        setStage('pending_card')
      } else {
        setSuccessNumber(order.orderNumber)
        setStage('success')
        setTimeout(() => {
          clearCart()
          setStage('cart')
          setSuccessNumber(null)
        }, 2500)
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setCheckoutError(err?.response?.data?.message ?? 'Error al procesar la venta')
    } finally {
      setSubmitting(false)
    }
  }, [checkoutVals, carrito, cliente, clienteCanCredit, creditBlockReason, clearCart, loadedQuoteId, layawayOrderId])

  // ---- confirm card ----
  const handleConfirmarTarjeta = useCallback(async () => {
    if (!pendingOrderId) return
    setConfirming(true)
    try {
      await updateOrderStatus(pendingOrderId, 'CONFIRMED')
      setSuccessNumber(pendingOrderNumber)
      setPendingOrderId(null)
      setPendingOrderNumber(null)
      setStage('success')
      setTimeout(() => {
        clearCart()
        setStage('cart')
        setSuccessNumber(null)
      }, 2500)
    } catch {
      alert('Error al confirmar pago con tarjeta')
    } finally {
      setConfirming(false)
    }
  }, [pendingOrderId, pendingOrderNumber, clearCart])

  const cancelPendingCard = useCallback(() => {
    setPendingOrderId(null)
    setPendingOrderNumber(null)
    clearCart()
    setStage('cart')
  }, [clearCart])

  const holdCurrentCart = useCallback((label?: string) => {
    if (carrito.length === 0) return
    const sale: HoldSale = {
      id: `hold-${Date.now()}`,
      label: label ?? `Mesa ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: new Date().toISOString(),
      carrito: [...carrito],
      cliente: cliente ? { ...cliente } : null,
      total: totals.total,
    }
    const updated = [...holdSales, sale]
    setHoldSales(updated)
    localStorage.setItem('pos_hold_sales', JSON.stringify(updated))
    clearCart()
  }, [carrito, cliente, totals.total, holdSales, clearCart])

  const holdCurrentCartWithDeposit = useCallback(async (
    label: string | undefined,
    depositAmount: number,
    depositMethod: string,
  ): Promise<void> => {
    if (carrito.length === 0) return
    const order = await createOrder({
      customerId: cliente?.id,
      items: carrito.map(i => {
        if (i.type === 'SERVICE') {
          return { itemType: 'SERVICE' as const, serviceId: i.serviceId, name: i.name, quantity: i.qty, price: i.price }
        }
        return { productId: i.id, quantity: i.qty, price: i.price }
      }),
      paymentMethod: depositMethod,
      payments: [{ method: depositMethod, amount: depositAmount, currency: 'MXN' }],
      isLayaway: true,
    })
    const sale: HoldSale = {
      id: `hold-${Date.now()}`,
      label: label ?? `Mesa ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paidAmount: depositAmount,
      createdAt: new Date().toISOString(),
      carrito: [...carrito],
      cliente: cliente ? { ...cliente } : null,
      total: totals.total,
    }
    const updated = [...holdSales, sale]
    setHoldSales(updated)
    localStorage.setItem('pos_hold_sales', JSON.stringify(updated))
    clearCart()
  }, [carrito, cliente, totals.total, holdSales, clearCart])

  const resumeHoldSale = useCallback((id: string) => {
    const hold = holdSales.find(h => h.id === id)
    if (!hold) return
    setCarrito(hold.carrito)
    if (hold.cliente) setCliente(hold.cliente)
    if (hold.orderId) {
      setLayawayOrderId(hold.orderId)
      setLayawayOrderNumber(hold.orderNumber ?? null)
      setLayawayPaidAmount(hold.paidAmount ?? 0)
    }
    const updated = holdSales.filter(h => h.id !== id)
    setHoldSales(updated)
    localStorage.setItem('pos_hold_sales', JSON.stringify(updated))
  }, [holdSales])

  const discardHoldSale = useCallback((id: string) => {
    const updated = holdSales.filter(h => h.id !== id)
    setHoldSales(updated)
    localStorage.setItem('pos_hold_sales', JSON.stringify(updated))
  }, [holdSales])

  return {
    // store
    setPosOpen,
    // cash session gate
    activeCashSession, sessionChecked, refreshSession,
    // catalog
    catalogLoading,
    products,
    services,
    // filters
    search, setSearch, searchRef,
    productosFiltrados,
    catalogTab, setCatalogTab,
    serviceSearch, setServiceSearch,
    serviciosFiltrados,
    // cart
    carrito, totals, stockWarning,
    addToCart, addServiceToCart, addManualService, updateQty, removeItem, clearCart,
    // manual service
    manualServiceOpen, setManualServiceOpen,
    manualService, setManualService,
    // customer
    cliente, showClienteDD, setShowClienteDD,
    clienteSearch, setClienteSearch,
    clientesFiltrados, clienteCanCredit, creditBlockReason,
    selectCliente, clearCliente,
    // checkout
    stage,
    efectivo, setEfectivo,
    efectivoUsd, setEfectivoUsd,
    tarjeta, setTarjeta,
    exchangeRate,
    cashChangeCurrency,
    checkoutVals,
    submitting, checkoutError,
    openCheckout, backToCart,
    handleConfirmarPago,
    // pending card
    pendingOrderNumber, confirming,
    handleConfirmarTarjeta, cancelPendingCard,
    // success
    successNumber,
    // loaded quote
    loadedQuoteId, loadedQuoteNumber, quoteLoading,
    // cliente quotes panel
    clienteQuotes, clienteQuotesLoading, quotePanelOpen, setQuotePanelOpen,
    loadQuoteIntoCart,
    // save as quote
    saveAsQuote, savingQuote, savedQuoteNumber, setSavedQuoteNumber,
    // hold sales
    holdSales, holdCurrentCart, holdCurrentCartWithDeposit, resumeHoldSale, discardHoldSale,
    // layaway
    layawayOrderId, layawayOrderNumber, layawayPaidAmount,
  }
}
