import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  fetchPayables,
  fetchPayable,
  registerPayablePayment,
  fetchPayablesStats,
  type ApiAccountPayable,
  type AccountPayableStatus,
  type SupplierPaymentMethod,
  type RegisterPaymentInput,
} from '@/services/core/payables-service'

export type { ApiAccountPayable, AccountPayableStatus, SupplierPaymentMethod, RegisterPaymentInput }

export const STATUS_FILTERS: Array<{ key: AccountPayableStatus | 'Todos'; label: string }> = [
  { key: 'Todos',     label: 'Todos'    },
  { key: 'PENDIENTE', label: 'Pendiente' },
  { key: 'PARCIAL',   label: 'Parcial'  },
  { key: 'PAGADO',    label: 'Pagado'   },
]

interface PayablesStats {
  pendiente: { count: number; balance: number }
  parcial:   { count: number; balance: number }
  pagado:    { count: number; total: number }
}

const PER_PAGE = 8

export function useCxp() {
  const [payables, setPayables]       = useState<ApiAccountPayable[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<AccountPayableStatus | 'Todos'>('Todos')
  const [page, setPage]               = useState(1)
  const [stats, setStats]             = useState<PayablesStats | null>(null)

  const [detailPayable, setDetailPayable]   = useState<ApiAccountPayable | null>(null)
  const [detailOpen, setDetailOpen]         = useState(false)
  const [detailLoading, setDetailLoading]   = useState(false)

  const [paymentOpen, setPaymentOpen]     = useState(false)
  const [paymentId, setPaymentId]         = useState<string | null>(null)
  const [paymentBalance, setPaymentBalance] = useState(0)
  const [paymentForm, setPaymentForm] = useState<RegisterPaymentInput & { _method: SupplierPaymentMethod }>({
    amount: 0, paymentMethod: 'CASH', _method: 'CASH', reference: '',
  })
  const [paying, setPaying]           = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const loadPayables = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, statsRes] = await Promise.all([
        fetchPayables({ limit: 100, page: 1 }),
        fetchPayablesStats(),
      ])
      setPayables(res.data)
      setStats(statsRes)
    } catch {
      setError('Error al cargar cuentas por pagar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPayables() }, [loadPayables])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return payables.filter(p => {
      const matchSearch = !q
        || (p.supplier?.name.toLowerCase().includes(q) ?? false)
        || (p.purchaseOrder?.orderNumber.toLowerCase().includes(q) ?? false)
      const matchStatus = statusFilter === 'Todos' || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [search, statusFilter, payables])

  const pageData = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [page, filtered]
  )

  const handleOpenDetail = useCallback(async (payable: ApiAccountPayable) => {
    setDetailPayable(payable)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const full = await fetchPayable(payable.id)
      setDetailPayable(full)
    } catch {
      // show what we have
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false)
    setDetailPayable(null)
  }, [])

  const handleOpenPayment = useCallback((payable: ApiAccountPayable) => {
    setPaymentId(payable.id)
    setPaymentBalance(parseFloat(String(payable.balance)))
    setPaymentForm({ amount: 0, paymentMethod: 'CASH', _method: 'CASH', reference: '' })
    setPaymentError(null)
    setPaymentOpen(true)
  }, [])

  const handleClosePayment = useCallback(() => {
    setPaymentOpen(false)
    setPaymentId(null)
    setPaymentError(null)
  }, [])

  const handlePay = useCallback(async () => {
    if (!paymentId) return
    if (!paymentForm.amount || paymentForm.amount <= 0) {
      setPaymentError('El monto debe ser mayor a 0')
      return
    }
    if (paymentForm.amount > paymentBalance) {
      setPaymentError(`El monto no puede exceder el saldo ($${paymentBalance.toFixed(2)})`)
      return
    }
    setPaying(true)
    setPaymentError(null)
    try {
      const input: RegisterPaymentInput = {
        amount: paymentForm.amount,
        paymentMethod: paymentForm.paymentMethod,
        reference: paymentForm.reference || undefined,
      }
      await registerPayablePayment(paymentId, input)
      await loadPayables()
      if (detailPayable?.id === paymentId) {
        const full = await fetchPayable(paymentId)
        setDetailPayable(full)
      }
      handleClosePayment()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setPaymentError(msg ?? 'Error al registrar el pago')
    } finally {
      setPaying(false)
    }
  }, [paymentId, paymentForm, paymentBalance, loadPayables, handleClosePayment, detailPayable])

  return {
    payables, loading, error, loadPayables,
    search, setSearch,
    statusFilter, setStatusFilter,
    page, setPage,
    filtered, pageData, stats,
    detailOpen, detailPayable, detailLoading,
    handleOpenDetail, handleCloseDetail,
    paymentOpen, paymentId, paymentBalance, paymentForm, setPaymentForm,
    paying, paymentError,
    handleOpenPayment, handleClosePayment, handlePay,
  }
}
