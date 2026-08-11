import { useState, useEffect, useCallback } from 'react'
import {
  fetchActiveCashSession,
  fetchCashSessions,
  fetchCashSession,
  openCashSession,
  closeCashSession,
  withdrawCash,
  type ApiCashSession,
  type OpenSessionInput,
  type CloseSessionInput,
} from '@/services/core/caja-service'

export type { ApiCashSession }

const PER_PAGE = 8

export function useCaja() {
  // ---- active session ----
  const [activeSession, setActiveSession] = useState<ApiCashSession | null>(null)
  const [activeLoading, setActiveLoading] = useState(true)
  const [activeError, setActiveError] = useState<string | null>(null)

  // ---- history ----
  const [sessions, setSessions] = useState<ApiCashSession[]>([])
  const [sessionsTotal, setSessionsTotal] = useState(0)
  const [sessionsPage, setSessionsPage] = useState(1)
  const [historyLoading, setHistoryLoading] = useState(false)

  // ---- selected session detail ----
  const [detailSession, setDetailSession] = useState<ApiCashSession | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // ---- open modal ----
  const [openModalVisible, setOpenModalVisible] = useState(false)
  const [openForm, setOpenForm] = useState<OpenSessionInput>({ exchangeRateUsdMxn: 0, openingAmount: 0, openingAmountUsd: 0, notes: '' })
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  // ---- close modal ----
  const [closeModalVisible, setCloseModalVisible] = useState(false)
  const [withdrawVisible, setWithdrawVisible] = useState(false)
  const [withdrawForm, setWithdrawForm] = useState<{ amount: number; reason: string }>({ amount: 0, reason: '' })
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  const [closeForm, setCloseForm] = useState<CloseSessionInput>({ cashCounted: 0, cashCountedUsd: 0, differenceReason: '', notes: '' })
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  // ---- load active session ----
  const loadActive = useCallback(async () => {
    setActiveLoading(true)
    setActiveError(null)
    try {
      const session = await fetchActiveCashSession()
      setActiveSession(session)
    } catch {
      setActiveError('Error al cargar sesión activa')
    } finally {
      setActiveLoading(false)
    }
  }, [])

  // ---- load history ----
  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true)
    try {
      const res = await fetchCashSessions({ page, limit: PER_PAGE })
      setSessions(res.data)
      setSessionsTotal(res.meta.total)
      setSessionsPage(page)
    } catch {
      // silent
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadActive()
    loadHistory(1)
  }, [loadActive, loadHistory])

  // ---- open session ----
  const handleOpenSession = useCallback(async () => {
    if (!openForm.exchangeRateUsdMxn || openForm.exchangeRateUsdMxn <= 0) { setOpenError('El tipo de cambio USD/MXN es requerido y debe ser mayor a cero'); return }
    if (openForm.openingAmount < 0) { setOpenError('El fondo inicial no puede ser negativo'); return }
    setOpening(true)
    setOpenError(null)
    try {
      const session = await openCashSession(openForm)
      setActiveSession(session)
      setOpenModalVisible(false)
      setOpenForm({ exchangeRateUsdMxn: 0, openingAmount: 0, openingAmountUsd: 0, notes: '' })
      loadHistory(1)
    } catch (e: any) {
      setOpenError(e?.response?.data?.message ?? 'Error al abrir sesión')
    } finally {
      setOpening(false)
    }
  }, [openForm, loadHistory])

  // ---- open close modal (reload active session for fresh summary) ----
  const handleOpenCloseModal = useCallback(async () => {
    setCloseModalVisible(true)
    try {
      const session = await fetchActiveCashSession()
      if (session) setActiveSession(session)
    } catch {
      // keep stale data
    }
  }, [])

  // ---- close session ----
  const handleCloseSession = useCallback(async () => {
    if (!activeSession) return
    if (closeForm.cashCounted < 0) { setCloseError('El efectivo MXN contado no puede ser negativo'); return }
    if ((closeForm.cashCountedUsd ?? 0) < 0) { setCloseError('El efectivo USD contado no puede ser negativo'); return }
    setClosing(true)
    setCloseError(null)
    try {
      await closeCashSession(activeSession.id, closeForm)
      setActiveSession(null)
      setCloseModalVisible(false)
      setCloseForm({ cashCounted: 0, cashCountedUsd: 0, differenceReason: '', notes: '' })
      loadHistory(1)
    } catch (e: any) {
      setCloseError(e?.response?.data?.message ?? 'Error al cerrar sesión')
    } finally {
      setClosing(false)
    }
  }, [activeSession, closeForm, loadHistory])

  /** Retiro de efectivo del cajón: baja el esperado y recarga la sesión. */
  const handleWithdraw = useCallback(async () => {
    setWithdrawError(null)
    if (withdrawForm.amount <= 0) { setWithdrawError('El monto debe ser mayor a 0'); return }
    if (!withdrawForm.reason.trim()) { setWithdrawError('El motivo es obligatorio'); return }
    setWithdrawing(true)
    try {
      await withdrawCash({ amount: withdrawForm.amount, reason: withdrawForm.reason })
      setWithdrawVisible(false)
      setWithdrawForm({ amount: 0, reason: '' })
      await loadActive()
    } catch (e: any) {
      setWithdrawError(e?.response?.data?.message ?? 'Error al retirar efectivo')
    } finally {
      setWithdrawing(false)
    }
  }, [withdrawForm, loadActive])

  // ---- detail ----
  const handleOpenDetail = useCallback(async (session: ApiCashSession) => {
    setDetailSession(session)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const full = await fetchCashSession(session.id)
      setDetailSession(full)
    } catch {
      // show what we have
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false)
    setDetailSession(null)
  }, [])

  return {
    // active
    activeSession, activeLoading, activeError, loadActive,
    // history
    sessions, sessionsTotal, sessionsPage, historyLoading,
    loadHistory, setSessionsPage: (p: number) => loadHistory(p),
    // detail
    detailSession, detailOpen, detailLoading,
    handleOpenDetail, handleCloseDetail,
    // open modal
    openModalVisible, setOpenModalVisible,
    openForm, setOpenForm,
    opening, openError,
    handleOpenSession,
    // close modal
    closeModalVisible, setCloseModalVisible, handleOpenCloseModal,
    closeForm, setCloseForm,
    closing, closeError,
    handleCloseSession,
    // withdraw
    withdrawVisible, setWithdrawVisible,
    withdrawForm, setWithdrawForm,
    withdrawing, withdrawError,
    handleWithdraw,
  }
}
