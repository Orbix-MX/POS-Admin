import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  fetchQuotes, fetchQuote, createQuote, updateQuote, approveQuote,
  type ServiceQuote, type QuoteStatus, type CreateQuotePayload, type CreateQuoteItemPayload,
} from '@/services/retail/cotizaciones-service'
import { fetchServices, type Service } from '@/services/retail/services-service'
import { fetchClientes, type Cliente } from '@/services/core/clientes-service'
import { useERPStore } from '@/store/erp-store'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

export { fmt }

const BLANK_ITEM: CreateQuoteItemPayload = { description: '', quantity: 1, unitPrice: 0 }

export function useCotizaciones() {
  const { setPosOpen, setPendingQuoteId } = useERPStore()
  const [quotes, setQuotes] = useState<ServiceQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<QuoteStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const perPage = 15

  // Catalog data
  const [services, setServices] = useState<Service[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])

  // Detail modal
  const [detailQuote, setDetailQuote] = useState<ServiceQuote | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<{
    customerId: string
    items: CreateQuoteItemPayload[]
    estimatedDeliveryDate: string
    notes: string
    clienteSearch: string
    clienteSelected: Cliente | null
  }>({
    customerId: '',
    items: [{ ...BLANK_ITEM }],
    estimatedDeliveryDate: '',
    notes: '',
    clienteSearch: '',
    clienteSelected: null,
  })
  const [saving, setSaving] = useState(false)


  const loadCatalog = useCallback(async () => {
    const [svcRes, clts] = await Promise.all([
      fetchServices({ isActive: true, limit: 200 }),
      fetchClientes(),
    ])
    setServices(svcRes.data ?? [])
    setClientes(clts)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchQuotes({ limit: 200 })
      setQuotes(res.data ?? [])
    } catch {
      setError('Error al cargar cotizaciones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    loadCatalog()
  }, [load, loadCatalog])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return quotes.filter((qt) => {
      if (filterStatus !== 'ALL' && qt.status !== filterStatus) return false
      if (q) {
        const name = `${qt.customer.firstName} ${qt.customer.lastName}`.toLowerCase()
        if (!qt.quoteNumber.toLowerCase().includes(q) && !name.includes(q)) return false
      }
      return true
    })
  }, [quotes, search, filterStatus])

  const pageData = useMemo(() => {
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page])

  const openDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const q = await fetchQuote(id)
      setDetailQuote(q)
    } catch {
      alert('Error al cargar cotización')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const closeDetail = useCallback(() => setDetailQuote(null), [])

  const clientesFiltrados = useMemo(() => {
    const q = createForm.clienteSearch.toLowerCase()
    if (!q) return clientes.slice(0, 8)
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    ).slice(0, 8)
  }, [clientes, createForm.clienteSearch])

  const openCreate = useCallback(() => {
    setCreateForm({
      customerId: '',
      items: [{ ...BLANK_ITEM }],
      estimatedDeliveryDate: '',
      notes: '',
      clienteSearch: '',
      clienteSelected: null,
    })
    setCreateOpen(true)
  }, [])

  const closeCreate = useCallback(() => setCreateOpen(false), [])

  const addItem = useCallback(() => {
    setCreateForm((p) => ({ ...p, items: [...p.items, { ...BLANK_ITEM }] }))
  }, [])

  const removeItem = useCallback((idx: number) => {
    setCreateForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))
  }, [])

  const updateItem = useCallback((idx: number, patch: Partial<CreateQuoteItemPayload>) => {
    setCreateForm((p) => ({
      ...p,
      items: p.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }))
  }, [])

  const selectServiceForItem = useCallback((idx: number, svc: Service) => {
    setCreateForm((p) => ({
      ...p,
      items: p.items.map((it, i) =>
        i === idx
          ? { ...it, serviceId: svc.id, description: svc.name, unitPrice: Number(svc.basePrice) }
          : it,
      ),
    }))
  }, [])

  const createSubtotal = useMemo(
    () => createForm.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    [createForm.items],
  )

  const handleCreate = useCallback(async () => {
    if (!createForm.customerId) { alert('Selecciona un cliente'); return }
    if (createForm.items.some((i) => !i.description.trim() || i.quantity < 1 || i.unitPrice < 0)) {
      alert('Verifica los items — descripción, cantidad > 0 y precio >= 0')
      return
    }
    setSaving(true)
    try {
      const payload: CreateQuotePayload = {
        customerId: createForm.customerId,
        items: createForm.items,
        estimatedDeliveryDate: createForm.estimatedDeliveryDate || undefined,
        notes: createForm.notes || undefined,
      }
      const created = await createQuote(payload)
      setQuotes((prev) => [created, ...prev])
      closeCreate()
    } catch {
      alert('Error al crear cotización')
    } finally {
      setSaving(false)
    }
  }, [createForm, closeCreate])

  const handleApprove = useCallback(async (id: string) => {
    try {
      const updated = await approveQuote(id)
      setQuotes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
      if (detailQuote?.id === id) setDetailQuote(updated)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al aprobar')
    }
  }, [detailQuote])

  const handleUpdateStatus = useCallback(async (id: string, status: string) => {
    try {
      const updated = await updateQuote(id, { status })
      setQuotes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
      if (detailQuote?.id === id) setDetailQuote(updated)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al actualizar')
    }
  }, [detailQuote])

  const openInPOS = useCallback((id: string) => {
    setPendingQuoteId(id)
    setPosOpen(true)
  }, [setPendingQuoteId, setPosOpen])

  return {
    quotes, loading, error,
    search, setSearch,
    filterStatus, setFilterStatus,
    page, setPage, perPage,
    filtered, pageData,
    services, clientes,
    // detail
    detailQuote, detailLoading, openDetail, closeDetail,
    // create
    createOpen, createForm, setCreateForm, saving, createSubtotal,
    clientesFiltrados,
    openCreate, closeCreate, addItem, removeItem, updateItem, selectServiceForItem, handleCreate,
    // status actions
    handleApprove, handleUpdateStatus,
    // open in POS
    openInPOS,
    fmt,
  }
}
