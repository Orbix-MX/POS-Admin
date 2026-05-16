import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  getCxCList,
  getCxCStats,
  registerCxCPayment,
  fmtMoney,
  fmtDate,
  cxcCustomerName,
  type ApiCxC,
  type CxCStatus,
  type CxCStats,
  type CxCListResponse,
} from '@/services/core/cxc-service'

export type { ApiCxC, CxCStatus, CxCStats }
export { fmtMoney, fmtDate, cxcCustomerName }

export const CXC_FILTER_STATUSES: Array<{ key: string; label: string }> = [
  { key: 'Todos',     label: 'Todos'     },
  { key: 'PENDIENTE', label: 'Pendiente' },
  { key: 'PARCIAL',   label: 'Parcial'   },
  { key: 'VENCIDO',   label: 'Vencido'   },
  { key: 'PAGADO',    label: 'Pagado'    },
]

export interface PaymentForm {
  amount: string
  paymentMethod: string
  reference: string
  notes: string
}

const EMPTY_PAYMENT_FORM: PaymentForm = {
  amount: '',
  paymentMethod: 'CASH',
  reference: '',
  notes: '',
}

const PER_PAGE = 8

export function useCxC() {
  const [records, setRecords]         = useState<ApiCxC[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [stats, setStats]             = useState<CxCStats | null>(null)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [page, setPage]               = useState(1)

  // detail drawer
  const [detailCxC, setDetailCxC]   = useState<ApiCxC | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // payment modal
  const [payOpen, setPayOpen]           = useState(false)
  const [payTargetId, setPayTargetId]   = useState<string | null>(null)
  const [payTargetBalance, setPayTargetBalance] = useState(0)
  const [payForm, setPayForm]           = useState<PaymentForm>(EMPTY_PAYMENT_FORM)
  const [paying, setPaying]             = useState(false)
  const [payError, setPayError]         = useState<string | null>(null)

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, statsRes]: [CxCListResponse, CxCStats] = await Promise.all([
        getCxCList({ limit: 100, page: 1 }),
        getCxCStats(),
      ])
      setRecords(res.data)
      setStats(statsRes)
    } catch {
      setError('Error al cargar cuentas por cobrar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadRecords() }, [loadRecords])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r => {
      const name = cxcCustomerName(r.customer).toLowerCase()
      const matchSearch = !q
        || r.order.orderNumber.toLowerCase().includes(q)
        || name.includes(q)
      const matchStatus = statusFilter === 'Todos' || r.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [search, statusFilter, records])

  const pageData = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [page, filtered]
  )

  const handleOpenDetail = useCallback((cxc: ApiCxC) => {
    setDetailCxC(cxc)
    setDetailOpen(true)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false)
    setDetailCxC(null)
  }, [])

  const handleOpenPay = useCallback((cxc: ApiCxC) => {
    setPayTargetId(cxc.id)
    setPayTargetBalance(Number(cxc.balance))
    setPayForm(EMPTY_PAYMENT_FORM)
    setPayError(null)
    setPayOpen(true)
  }, [])

  const handleClosePay = useCallback(() => {
    setPayOpen(false)
    setPayTargetId(null)
    setPayError(null)
  }, [])

  const handleRegisterPayment = useCallback(async () => {
    if (!payTargetId) return
    const amount = parseFloat(payForm.amount)
    if (isNaN(amount) || amount <= 0) { setPayError('Ingresa un monto válido'); return }
    if (amount > payTargetBalance) { setPayError(`Máximo: ${fmtMoney(payTargetBalance)}`); return }
    if (!payForm.paymentMethod) { setPayError('Selecciona método de pago'); return }

    setPaying(true)
    setPayError(null)
    try {
      await registerCxCPayment(payTargetId, {
        amount,
        paymentMethod: payForm.paymentMethod,
        reference: payForm.reference || undefined,
        notes: payForm.notes || undefined,
      })
      await loadRecords()
      handleClosePay()
      if (detailCxC?.id === payTargetId) {
        const updated = records.find(r => r.id === payTargetId)
        if (updated) setDetailCxC(updated)
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setPayError(err?.response?.data?.message ?? 'Error al registrar pago')
    } finally {
      setPaying(false)
    }
  }, [payTargetId, payForm, payTargetBalance, loadRecords, handleClosePay, detailCxC, records])

  return {
    records, loading, error, stats, loadRecords,
    search, setSearch,
    statusFilter, setStatusFilter,
    page, setPage,
    filtered, pageData,
    detailOpen, detailCxC,
    handleOpenDetail, handleCloseDetail,
    payOpen, payForm, setPayForm, paying, payError, payTargetBalance,
    handleOpenPay, handleClosePay, handleRegisterPayment,
  }
}
