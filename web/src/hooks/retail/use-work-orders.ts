import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  fetchWorkOrders, fetchWorkOrder, createWorkOrder, updateWorkOrder,
  assignUser, startAssignment, finishAssignment,
  type WorkOrder, type WorkOrderStatus, type CreateWorkOrderPayload,
} from '@/services/retail/work-orders-service'
import { fetchClientes, type Cliente } from '@/services/core/clientes-service'
import { fetchServices, type Service } from '@/services/retail/services-service'
import { fetchUsuarios, type Usuario } from '@/services/core/users-service'
import { fetchQuote, type ServiceQuoteItem } from '@/services/retail/cotizaciones-service'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

export { fmt }

const BLANK_FORM: CreateWorkOrderPayload & { clienteSearch: string; clienteSelected: Cliente | null; assignedUserId: string } = {
  customerId: '',
  description: '',
  serviceId: undefined,
  dueDate: '',
  notes: '',
  serviceQuoteId: undefined,
  clienteSearch: '',
  clienteSelected: null,
  assignedUserId: '',
}

export type { ServiceQuoteItem }

export function useWorkOrders(initialQuoteId?: string, initialCustomerId?: string) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<WorkOrderStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const perPage = 15

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])

  const [detailOrder, setDetailOrder] = useState<WorkOrder | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ ...BLANK_FORM })
  const [quoteServiceItems, setQuoteServiceItems] = useState<ServiceQuoteItem[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWorkOrders({ limit: 200 })
      setWorkOrders(res.data ?? [])
    } catch {
      setError('Error al cargar órdenes de trabajo')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCatalog = useCallback(async () => {
    const [clts, svcRes, users] = await Promise.all([
      fetchClientes(),
      fetchServices({ isActive: true, limit: 200 }),
      fetchUsuarios(),
    ])
    setClientes(clts)
    setServices(svcRes.data ?? [])
    setUsuarios(users.filter((u) => u.statusRaw === 'ACTIVE'))
  }, [])

  useEffect(() => { load(); loadCatalog() }, [load, loadCatalog])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return workOrders.filter((wo) => {
      if (filterStatus !== 'ALL' && wo.status !== filterStatus) return false
      if (q) {
        const name = `${wo.customer.firstName} ${wo.customer.lastName}`.toLowerCase()
        if (!wo.orderNumber.toLowerCase().includes(q) && !name.includes(q) && !wo.description.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [workOrders, search, filterStatus])

  const pageData = useMemo(() => {
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page])

  const clientesFiltrados = useMemo(() => {
    const q = createForm.clienteSearch.toLowerCase()
    if (!q) return clientes.slice(0, 8)
    return clientes.filter(
      (c) => c.nombre.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    ).slice(0, 8)
  }, [clientes, createForm.clienteSearch])

  const openCreate = useCallback(async (quoteId?: string, customerId?: string) => {
    setQuoteServiceItems([])
    if (quoteId) {
      try {
        const quote = await fetchQuote(quoteId)
        const serviceItems = quote.items.filter((i) => i.itemType === 'SERVICE' && i.serviceId)
        setQuoteServiceItems(serviceItems)
        const c = quote.customer
        const clienteSelected: Cliente = {
          id: c.id,
          nombre: `${c.firstName} ${c.lastName}`.trim(),
          empresa: c.company ?? '',
          email: c.email,
          telefono: c.phone ?? '',
          ciudad: '',
          totalCompras: '',
          pedidos: 0,
          estado: 'Activo',
          desde: '',
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          company: c.company,
        }
        setCreateForm({ ...BLANK_FORM, serviceQuoteId: quoteId, customerId: c.id, clienteSelected })
      } catch {
        setCreateForm({ ...BLANK_FORM, serviceQuoteId: quoteId, customerId: customerId ?? '' })
      }
    } else {
      setCreateForm({ ...BLANK_FORM, customerId: customerId ?? '' })
    }
    setCreateOpen(true)
  }, [])

  const closeCreate = useCallback(() => { setCreateOpen(false); setQuoteServiceItems([]) }, [])

  const openDetail = useCallback(async (id: string) => {
    try {
      const wo = await fetchWorkOrder(id)
      setDetailOrder(wo)
    } catch {
      alert('Error al cargar orden de trabajo')
    }
  }, [])

  const closeDetail = useCallback(() => setDetailOrder(null), [])

  const handleCreate = useCallback(async () => {
    if (!createForm.customerId) { alert('Selecciona un cliente'); return }
    if (!createForm.description.trim()) { alert('La descripción es obligatoria'); return }
    setSaving(true)
    try {
      const payload: CreateWorkOrderPayload = {
        customerId: createForm.customerId,
        description: createForm.description,
        serviceId: createForm.serviceId || undefined,
        dueDate: createForm.dueDate || undefined,
        notes: createForm.notes || undefined,
        serviceQuoteId: createForm.serviceQuoteId || undefined,
      }
      const created = await createWorkOrder(payload)
      if (createForm.assignedUserId) {
        await assignUser(created.id, createForm.assignedUserId)
        const updated = await fetchWorkOrder(created.id)
        setWorkOrders((prev) => [updated, ...prev])
      } else {
        setWorkOrders((prev) => [created, ...prev])
      }
      closeCreate()
    } catch {
      alert('Error al crear orden de trabajo')
    } finally {
      setSaving(false)
    }
  }, [createForm, closeCreate])

  const handleUpdateStatus = useCallback(async (id: string, status: WorkOrderStatus) => {
    try {
      const updated = await updateWorkOrder(id, { status })
      setWorkOrders((prev) => prev.map((wo) => (wo.id === updated.id ? updated : wo)))
      if (detailOrder?.id === id) setDetailOrder(updated)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al actualizar')
    }
  }, [detailOrder])

  const handleAssign = useCallback(async (id: string, userId: string) => {
    try {
      await assignUser(id, userId)
      const updated = await fetchWorkOrder(id)
      setWorkOrders((prev) => prev.map((wo) => (wo.id === updated.id ? updated : wo)))
      if (detailOrder?.id === id) setDetailOrder(updated)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al asignar')
    }
  }, [detailOrder])

  const handleStartAssignment = useCallback(async (workOrderId: string, assignmentId: string) => {
    try {
      const updated = await startAssignment(workOrderId, assignmentId)
      setWorkOrders((prev) => prev.map((wo) => (wo.id === updated.id ? updated : wo)))
      if (detailOrder?.id === workOrderId) setDetailOrder(updated)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al iniciar')
    }
  }, [detailOrder])

  const handleFinishAssignment = useCallback(async (workOrderId: string, assignmentId: string) => {
    try {
      const updated = await finishAssignment(workOrderId, assignmentId)
      setWorkOrders((prev) => prev.map((wo) => (wo.id === updated.id ? updated : wo)))
      if (detailOrder?.id === workOrderId) setDetailOrder(updated)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al terminar')
    }
  }, [detailOrder])

  return {
    workOrders, loading, error,
    search, setSearch,
    filterStatus, setFilterStatus,
    page, setPage, perPage,
    filtered, pageData,
    clientes, services, usuarios, quoteServiceItems, clientesFiltrados,
    detailOrder, openDetail, closeDetail,
    createOpen, createForm, setCreateForm, saving,
    openCreate, closeCreate, handleCreate,
    handleUpdateStatus, handleAssign,
    handleStartAssignment, handleFinishAssignment,
    fmt,
  }
}
