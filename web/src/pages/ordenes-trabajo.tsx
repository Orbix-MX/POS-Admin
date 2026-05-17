import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Wrench, Plus, Search, ChevronRight, X, User, Calendar,
  Clock, CheckCircle, PlayCircle, PauseCircle, XCircle, FileText,
} from 'lucide-react'
import { useWorkOrders, fmt } from '@/hooks/retail/use-work-orders'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import type { WorkOrder, WorkOrderStatus } from '@/services/retail/work-orders-service'
import type { Cliente } from '@/services/core/clientes-service'
import type { Service } from '@/services/retail/services-service'
import type { CreateWorkOrderPayload } from '@/services/retail/work-orders-service'
import type { Usuario } from '@/services/core/users-service'
import type { ServiceQuoteItem } from '@/hooks/retail/use-work-orders'

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En proceso',
  PAUSED: 'Pausada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
}

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  PAUSED: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const STATUS_ICON: Record<WorkOrderStatus, typeof Wrench> = {
  PENDING: Clock,
  IN_PROGRESS: PlayCircle,
  PAUSED: PauseCircle,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({
  open, form, setForm, saving, services, usuarios, quoteServiceItems, clientesFiltrados, onClose, onSave,
}: {
  open: boolean
  form: CreateWorkOrderPayload & { clienteSearch: string; clienteSelected: Cliente | null; assignedUserId: string }
  setForm: (f: any) => void
  saving: boolean
  services: Service[]
  usuarios: Usuario[]
  quoteServiceItems: ServiceQuoteItem[]
  clientesFiltrados: Cliente[]
  onClose: () => void
  onSave: () => void
}) {
  const [showClienteDD, setShowClienteDD] = useState(false)

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-bold text-foreground">Nueva Orden de Trabajo</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Customer */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Cliente *</label>
          <div className="relative">
            <button
              onClick={() => setShowClienteDD(!showClienteDD)}
              className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-muted cursor-pointer text-xs text-left"
            >
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={`flex-1 ${form.clienteSelected ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                {form.clienteSelected ? `${form.clienteSelected.nombre} — ${form.clienteSelected.email}` : 'Seleccionar cliente…'}
              </span>
            </button>
            {showClienteDD && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl z-50 shadow-lg overflow-hidden">
                <div className="px-2.5 py-2 border-b border-border">
                  <input
                    value={form.clienteSearch}
                    onChange={(e) => setForm((p: any) => ({ ...p, clienteSearch: e.target.value }))}
                    placeholder="Buscar…"
                    autoFocus
                    className="w-full border-none bg-transparent outline-none text-xs text-foreground"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {clientesFiltrados.map((c) => (
                    <button key={c.id} onClick={() => {
                      setForm((p: any) => ({ ...p, customerId: c.id, clienteSelected: c, clienteSearch: '' }))
                      setShowClienteDD(false)
                    }} className="w-full text-left px-3.5 py-2.5 hover:bg-muted bg-transparent border-none cursor-pointer text-[12px] text-foreground">
                      <div className="font-semibold">{c.nombre}</div>
                      <div className="text-[10px] text-muted-foreground">{c.email}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Descripción del trabajo *</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p: any) => ({ ...p, description: e.target.value }))}
            placeholder="Describe el trabajo a realizar…"
            rows={3}
            className="w-full px-2.5 py-2 border border-border rounded-lg text-[12px] text-foreground bg-background outline-none focus:border-primary resize-none"
          />
        </div>

        {/* Service + Due date */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            {quoteServiceItems.length > 0 ? (
              <>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Servicio de la cotización</label>
                <select
                  value={form.serviceId ?? ''}
                  onChange={(e) => setForm((p: any) => ({ ...p, serviceId: e.target.value || undefined }))}
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[12px] text-foreground bg-card outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">— Sin servicio —</option>
                  {quoteServiceItems.map((item) => (
                    <option key={item.serviceId!} value={item.serviceId!}>
                      {item.service?.name ?? item.description}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Servicio del catálogo (opcional)</label>
                <select
                  value={form.serviceId ?? ''}
                  onChange={(e) => setForm((p: any) => ({ ...p, serviceId: e.target.value || undefined }))}
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[12px] text-foreground bg-card outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">— Sin servicio —</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Fecha compromiso</label>
            <input
              type="date"
              value={form.dueDate ?? ''}
              onChange={(e) => setForm((p: any) => ({ ...p, dueDate: e.target.value }))}
              className="w-full px-2.5 py-2 border border-border rounded-lg text-[12px] text-foreground bg-background outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Notas</label>
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => setForm((p: any) => ({ ...p, notes: e.target.value }))}
            placeholder="Observaciones…"
            rows={3}
            className="w-full px-2.5 py-2 border border-border rounded-lg text-[12px] text-foreground bg-background outline-none focus:border-primary resize-none"
          />
        </div>

        {/* Assign technician */}
        {usuarios.length > 0 && (
          <div className="mb-5">
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Asignar técnico (opcional)</label>
            <select
              value={form.assignedUserId}
              onChange={(e) => setForm((p: any) => ({ ...p, assignedUserId: e.target.value }))}
              className="w-full px-2.5 py-2 border border-border rounded-lg text-[12px] text-foreground bg-card outline-none focus:border-primary cursor-pointer"
            >
              <option value="">— Sin asignar —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground bg-card hover:bg-muted cursor-pointer">
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50">
            {saving ? 'Creando…' : 'Crear Orden'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  order, onClose, onUpdateStatus, onStartAssignment, onFinishAssignment,
}: {
  order: WorkOrder
  onClose: () => void
  onUpdateStatus: (id: string, status: WorkOrderStatus) => void
  onStartAssignment: (workOrderId: string, assignmentId: string) => void
  onFinishAssignment: (workOrderId: string, assignmentId: string) => void
}) {
  const StatusIcon = STATUS_ICON[order.status]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[15px] font-bold text-foreground">{order.orderNumber}</div>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
              <StatusIcon className="w-3 h-3" />
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Customer */}
        <div className="bg-muted/40 rounded-xl p-3.5 mb-4 space-y-1">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
            <User className="w-3.5 h-3.5 text-primary" />
            {order.customer.firstName} {order.customer.lastName}
          </div>
          <div className="text-[11px] text-muted-foreground">{order.customer.email}</div>
          {order.customer.phone && (
            <div className="text-[11px] text-muted-foreground">{order.customer.phone}</div>
          )}
        </div>

        {/* Description */}
        <div className="mb-4">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Trabajo</div>
          <p className="text-[13px] text-foreground">{order.description}</p>
          {order.service && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              <Wrench className="w-3 h-3" /> {order.service.name}
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="flex gap-4 mb-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Creada: {new Date(order.createdAt).toLocaleDateString('es-MX')}
          </div>
          {order.dueDate && (
            <div className="flex items-center gap-1 text-amber-600 font-semibold">
              <Clock className="w-3 h-3" />
              Compromiso: {new Date(order.dueDate).toLocaleDateString('es-MX')}
            </div>
          )}
        </div>

        {/* Quote link */}
        {order.quoteLink && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <div className="text-[11px]">
              <span className="text-blue-700 font-semibold">Cotización: </span>
              <span className="text-blue-600">{order.quoteLink.serviceQuote.quoteNumber}</span>
              <span className="text-blue-400 ml-1">— {fmt(Number(order.quoteLink.serviceQuote.total))}</span>
            </div>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <div className="text-[11px] text-amber-800">{order.notes}</div>
          </div>
        )}

        {/* Assignments */}
        <div className="mb-4">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
            Técnicos asignados ({order.assignments.length})
          </div>
          {order.assignments.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic">Sin técnicos asignados</div>
          ) : (
            <div className="space-y-2">
              {order.assignments.map((a) => (
                <div key={a.id} className="border border-border rounded-xl p-3 bg-muted/20">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[12px] font-semibold text-foreground">
                      {a.user.firstName} {a.user.lastName}
                    </div>
                    <div className="flex gap-1.5">
                      {!a.startedAt && (
                        <button
                          onClick={() => onStartAssignment(order.id, a.id)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold cursor-pointer border-none flex items-center gap-1"
                        >
                          <PlayCircle className="w-3 h-3" /> Iniciar
                        </button>
                      )}
                      {a.startedAt && !a.finishedAt && (
                        <button
                          onClick={() => onFinishAssignment(order.id, a.id)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-[10px] font-bold cursor-pointer border-none flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" /> Terminar
                        </button>
                      )}
                      {a.finishedAt && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold">Finalizado</span>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex gap-3">
                    {a.startedAt && <span>Inicio: {new Date(a.startedAt).toLocaleString('es-MX')}</span>}
                    {a.finishedAt && <span>Fin: {new Date(a.finishedAt).toLocaleString('es-MX')}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Created by */}
        {order.createdBy && (
          <div className="text-[10px] text-muted-foreground mb-4">
            Creada por: <span className="font-semibold">{order.createdBy.firstName} {order.createdBy.lastName}</span>
          </div>
        )}

        {/* Status actions */}
        {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
          <div className="flex gap-2 flex-wrap border-t border-border pt-3">
            {order.status === 'PENDING' && (
              <button
                onClick={() => onUpdateStatus(order.id, 'IN_PROGRESS')}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1.5">
                <PlayCircle className="w-3.5 h-3.5" /> Iniciar orden
              </button>
            )}
            {order.status === 'IN_PROGRESS' && (
              <button
                onClick={() => onUpdateStatus(order.id, 'PAUSED')}
                className="flex-1 px-3 py-2 border border-orange-300 text-orange-600 rounded-lg text-[11px] font-semibold cursor-pointer bg-card hover:bg-orange-50 flex items-center justify-center gap-1.5">
                <PauseCircle className="w-3.5 h-3.5" /> Pausar
              </button>
            )}
            {order.status === 'PAUSED' && (
              <button
                onClick={() => onUpdateStatus(order.id, 'IN_PROGRESS')}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1.5">
                <PlayCircle className="w-3.5 h-3.5" /> Reanudar
              </button>
            )}
            {(order.status === 'IN_PROGRESS' || order.status === 'PAUSED') && (
              <button
                onClick={() => onUpdateStatus(order.id, 'COMPLETED')}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Completar
              </button>
            )}
            <button
              onClick={() => onUpdateStatus(order.id, 'CANCELLED')}
              className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-[11px] font-semibold cursor-pointer bg-card hover:bg-red-50 flex items-center justify-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function OrdenesTrabajo() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    loading, error,
    search, setSearch,
    filterStatus, setFilterStatus,
    page, setPage, perPage,
    filtered, pageData,
    clientes, services, usuarios, quoteServiceItems, clientesFiltrados,
    detailOrder, openDetail, closeDetail,
    createOpen, createForm, setCreateForm, saving,
    openCreate, closeCreate, handleCreate,
    handleUpdateStatus, handleStartAssignment, handleFinishAssignment,
  } = useWorkOrders()

  useEffect(() => {
    const quoteId = searchParams.get('quoteId')
    const customerId = searchParams.get('customerId')
    if (quoteId) {
      openCreate(quoteId, customerId ?? undefined)
      setSearchParams({}, { replace: true })
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo((): Column<WorkOrder>[] => [
    {
      label: 'Orden',
      render: (wo) => (
        <div>
          <div className="text-[12px] font-bold text-foreground">{wo.orderNumber}</div>
          <div className="text-[10px] text-muted-foreground">{new Date(wo.createdAt).toLocaleDateString('es-MX')}</div>
        </div>
      ),
    },
    {
      label: 'Cliente',
      render: (wo) => (
        <div>
          <div className="text-[12px] font-semibold text-foreground">{wo.customer.firstName} {wo.customer.lastName}</div>
          <div className="text-[10px] text-muted-foreground">{wo.customer.email}</div>
        </div>
      ),
    },
    {
      label: 'Trabajo',
      render: (wo) => (
        <div className="max-w-[200px]">
          <div className="text-[12px] text-foreground truncate">{wo.description}</div>
          {wo.service && <div className="text-[10px] text-primary">{wo.service.name}</div>}
        </div>
      ),
    },
    {
      label: 'Técnico',
      render: (wo) => {
        if (wo.assignments.length === 0) return <span className="text-[11px] text-muted-foreground">—</span>
        const [first, ...rest] = wo.assignments
        return (
          <div>
            <div className="text-[12px] font-semibold text-foreground">{first.user.firstName} {first.user.lastName}</div>
            {rest.length > 0 && <div className="text-[10px] text-muted-foreground">+{rest.length} más</div>}
          </div>
        )
      },
    },
    {
      label: 'Compromiso',
      render: (wo) => wo.dueDate ? (
        <span className="text-[11px] text-amber-600 font-semibold">
          {new Date(wo.dueDate).toLocaleDateString('es-MX')}
        </span>
      ) : <span className="text-[11px] text-muted-foreground">—</span>,
    },
    {
      label: 'Estado',
      render: (wo) => {
        const Icon = STATUS_ICON[wo.status]
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[wo.status]}`}>
            <Icon className="w-3 h-3" />
            {STATUS_LABELS[wo.status]}
          </span>
        )
      },
    },
    {
      label: '',
      render: (wo) => (
        <button
          onClick={() => openDetail(wo.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-[11px] font-semibold text-foreground bg-card hover:bg-muted cursor-pointer"
        >
          Ver <ChevronRight className="w-3 h-3" />
        </button>
      ),
    },
  ], [openDetail])

  const statuses: Array<WorkOrderStatus | 'ALL'> = ['ALL', 'PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED']

  return (
    <div className="px-7 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary" />
          <div>
            <div className="text-[13px] font-bold text-foreground">Órdenes de Trabajo</div>
            <div className="text-[11px] text-muted-foreground">{filtered.length} orden(es)</div>
          </div>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva orden
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar orden, cliente o descripción…"
            className="border-none bg-transparent outline-none text-[13px] text-foreground w-52"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); setPage(1) }}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition-all ${
                filterStatus === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {s === 'ALL' ? 'Todas' : STATUS_LABELS[s as WorkOrderStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: filtered.length, color: 'text-foreground' },
          { label: 'En proceso', value: filtered.filter((wo) => wo.status === 'IN_PROGRESS').length, color: 'text-blue-600' },
          { label: 'Pendientes', value: filtered.filter((wo) => wo.status === 'PENDING').length, color: 'text-amber-600' },
          { label: 'Completadas', value: filtered.filter((wo) => wo.status === 'COMPLETED').length, color: 'text-green-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
            <div className={`text-[20px] font-extrabold ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Cargando…</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Wrench className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <div className="text-[13px] font-semibold text-muted-foreground">Sin órdenes de trabajo</div>
          <div className="text-[11px] text-muted-foreground mt-1">Crea la primera orden con el botón de arriba</div>
        </div>
      ) : (
        <>
          <DataTable columns={columns} rows={pageData} />
          {filtered.length > perPage && (
            <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPage} />
          )}
        </>
      )}

      <CreateModal
        open={createOpen}
        form={createForm}
        setForm={setCreateForm}
        saving={saving}
        services={services}
        usuarios={usuarios}
        quoteServiceItems={quoteServiceItems}
        clientesFiltrados={clientesFiltrados}
        onClose={closeCreate}
        onSave={handleCreate}
      />

      {detailOrder && (
        <DetailModal
          order={detailOrder}
          onClose={closeDetail}
          onUpdateStatus={handleUpdateStatus}
          onStartAssignment={handleStartAssignment}
          onFinishAssignment={handleFinishAssignment}
        />
      )}
    </div>
  )
}
