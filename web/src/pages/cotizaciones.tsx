import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Plus, Search, ChevronRight, Check, X,
  User, Calendar, Package, Wrench, Download, ShoppingCart, RefreshCw,
} from 'lucide-react'
import { useCotizaciones, fmt } from '@/hooks/retail/use-cotizaciones'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import type { ServiceQuote, QuoteStatus } from '@/services/retail/cotizaciones-service'
import { downloadQuotePdf } from '@/services/retail/cotizaciones-service'
import type { Service } from '@/services/retail/services-service'
import type { CreateQuoteItemPayload } from '@/services/retail/cotizaciones-service'

const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Vencida',
  CONVERTED: 'Convertida',
}

const STATUS_COLORS: Record<QuoteStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-orange-100 text-orange-700',
  CONVERTED: 'bg-purple-100 text-purple-700',
}

// ─── Create Modal ────────────────────────────────────────────────────────────

function CreateQuoteModal({
  open, form, setForm, saving, createSubtotal,
  services, clientesFiltrados, onClose, onSave, addItem, removeItem, updateItem, selectServiceForItem,
}: {
  open: boolean
  form: any
  setForm: (f: any) => void
  saving: boolean
  createSubtotal: number
  services: Service[]
  clientesFiltrados: any[]
  onClose: () => void
  onSave: () => void
  addItem: () => void
  removeItem: (i: number) => void
  updateItem: (i: number, patch: Partial<CreateQuoteItemPayload>) => void
  selectServiceForItem: (i: number, svc: Service) => void
}) {
  const [showClienteDD, setShowClienteDD] = useState(false)

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-bold text-foreground">Nueva Cotización</h2>
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
                {form.clienteSelected
                  ? `${form.clienteSelected.nombre} — ${form.clienteSelected.email}`
                  : 'Seleccionar cliente…'}
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

        {/* Delivery date + notes */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Fecha estimada entrega</label>
            <input
              type="date"
              value={form.estimatedDeliveryDate}
              onChange={(e) => setForm((p: any) => ({ ...p, estimatedDeliveryDate: e.target.value }))}
              className="w-full px-2.5 py-2 border border-border rounded-lg text-[12px] text-foreground bg-background outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Notas</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((p: any) => ({ ...p, notes: e.target.value }))}
              placeholder="Observaciones…"
              className="w-full px-2.5 py-2 border border-border rounded-lg text-[12px] text-foreground bg-background outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Items */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-muted-foreground">Servicios *</label>
            <button onClick={addItem} className="text-[11px] text-primary font-semibold cursor-pointer bg-transparent border-none flex items-center gap-1">
              <Plus className="w-3 h-3" /> Agregar línea
            </button>
          </div>
          <div className="space-y-2">
            {form.items.map((item: CreateQuoteItemPayload & { serviceId?: string }, idx: number) => (
              <div key={idx} className="border border-border rounded-xl p-3 bg-muted/30 space-y-2">
                {/* Service selector */}
                {services.length > 0 && (
                  <select
                    value={item.serviceId ?? ''}
                    onChange={(e) => {
                      const svc = services.find((s) => s.id === e.target.value)
                      if (svc) selectServiceForItem(idx, svc)
                      else updateItem(idx, { serviceId: undefined })
                    }}
                    className="w-full px-2 py-1.5 border border-border rounded-lg text-[11px] text-foreground bg-card outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">— Seleccionar del catálogo (opcional) —</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} — {fmt(Number(s.basePrice))}</option>
                    ))}
                  </select>
                )}
                <div className="grid grid-cols-[1fr_80px_90px_24px] gap-2 items-center">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    placeholder="Descripción del servicio *"
                    className="px-2 py-1.5 border border-border rounded-lg text-[11px] text-foreground bg-card outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                    className="px-2 py-1.5 border border-border rounded-lg text-[11px] text-foreground bg-card outline-none focus:border-primary text-center"
                    placeholder="Cant."
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                    className="px-2 py-1.5 border border-border rounded-lg text-[11px] text-foreground bg-card outline-none focus:border-primary text-right"
                    placeholder="Precio"
                  />
                  <button
                    onClick={() => removeItem(idx)}
                    disabled={form.items.length === 1}
                    className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-600 rounded cursor-pointer border-none disabled:opacity-30"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-[10px] text-right text-muted-foreground">
                  Subtotal: <span className="font-bold text-foreground">{fmt(item.unitPrice * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-end items-center gap-3 border-t border-border pt-4 mb-4">
          <span className="text-[12px] text-muted-foreground font-semibold">Total:</span>
          <span className="text-[20px] font-extrabold text-primary">{fmt(createSubtotal)}</span>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground bg-card hover:bg-muted cursor-pointer">
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50">
            {saving ? 'Creando…' : 'Crear Cotización'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  quote, onClose, onApprove, onUpdateStatus, onOpenInPOS, onOpenWorkOrder,
}: {
  quote: ServiceQuote
  onClose: () => void
  onApprove: (id: string) => void
  onUpdateStatus: (id: string, status: string) => void
  onOpenInPOS: (id: string) => void
  onOpenWorkOrder: (quoteId: string, customerId: string) => void
}) {
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  async function handleDownloadPdf() {
    setDownloadingPdf(true)
    try {
      await downloadQuotePdf(quote.id, quote.quoteNumber)
    } catch {
      // silently fail — user will notice no download
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[15px] font-bold text-foreground">{quote.quoteNumber}</div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[quote.status]}`}>
              {STATUS_LABELS[quote.status]}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Customer info */}
        <div className="bg-muted/40 rounded-xl p-3.5 mb-4 space-y-1">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
            <User className="w-3.5 h-3.5 text-primary" />
            {quote.customer.firstName} {quote.customer.lastName}
          </div>
          <div className="text-[11px] text-muted-foreground">{quote.customer.email}</div>
          {quote.estimatedDeliveryDate && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              Entrega: {new Date(quote.estimatedDeliveryDate).toLocaleDateString('es-MX')}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="mb-4">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Servicios</div>
          <div className="space-y-2">
            {quote.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between border-b border-border pb-2">
                <div className="flex items-start gap-2">
                  <Wrench className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[12px] font-semibold text-foreground">{item.description}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.quantity} × {fmt(Number(item.unitPrice))}
                    </div>
                  </div>
                </div>
                <div className="text-[12px] font-bold text-foreground shrink-0">{fmt(Number(item.total))}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-between items-center border-t border-border pt-3 mb-4">
          <span className="text-[12px] font-semibold text-muted-foreground">Total</span>
          <span className="text-[20px] font-extrabold text-primary">{fmt(Number(quote.total))}</span>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <div className="text-[11px] text-amber-800">{quote.notes}</div>
          </div>
        )}

        {/* Orders generated */}
        {quote.orders && quote.orders.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Ventas generadas</div>
            {quote.orders.map((o) => (
              <div key={o.id} className="flex items-center gap-2 text-[12px] text-foreground">
                <Package className="w-3.5 h-3.5 text-purple-600" />
                <span className="font-semibold">{o.orderNumber}</span>
                <span className="text-muted-foreground">— {o.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* PDF Download */}
        <div className="mb-3">
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-[11px] font-semibold text-foreground bg-card hover:bg-muted cursor-pointer disabled:opacity-50 transition-colors"
          >
            {downloadingPdf
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generando PDF…</>
              : <><Download className="w-3.5 h-3.5" /> Descargar PDF</>}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {quote.status === 'DRAFT' && (
            <button onClick={() => onUpdateStatus(quote.id, 'SENT')}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5" /> Marcar como enviada
            </button>
          )}
          {quote.status === 'SENT' && (
            <>
              <button onClick={() => onUpdateStatus(quote.id, 'REJECTED')}
                className="flex-1 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-[11px] font-semibold bg-card hover:bg-red-50 cursor-pointer">
                Rechazar
              </button>
              <button onClick={() => onApprove(quote.id)}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1">
                <Check className="w-3 h-3" /> Aprobar
              </button>
            </>
          )}
          {quote.status === 'APPROVED' && (
            <>
              {quote.items.some((i) => i.itemType === 'SERVICE') && (
                <button
                  onClick={() => onOpenWorkOrder(quote.id, quote.customerId)}
                  className="flex-1 px-3 py-2.5 border border-border rounded-lg text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1.5 text-foreground bg-card hover:bg-muted">
                  <Wrench className="w-3.5 h-3.5" /> Abrir orden de trabajo
                </button>
              )}
              <button onClick={() => onOpenInPOS(quote.id)}
                className="flex-1 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg text-[12px] font-bold cursor-pointer flex items-center justify-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Abrir en POS
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Cotizaciones() {
  const navigate = useNavigate()
  const {
    loading, error,
    search, setSearch,
    filterStatus, setFilterStatus,
    page, setPage, perPage,
    filtered, pageData,
    services, clientes,
    detailQuote, openDetail, closeDetail,
    createOpen, createForm, setCreateForm, saving, createSubtotal,
    clientesFiltrados,
    openCreate, closeCreate, addItem, removeItem, updateItem, selectServiceForItem, handleCreate,
    handleApprove, handleUpdateStatus,
    openInPOS,
    fmt: fmtLocal,
  } = useCotizaciones()

  function handleOpenWorkOrder(quoteId: string, customerId: string) {
    navigate(`/ordenes-trabajo?quoteId=${quoteId}&customerId=${customerId}`)
  }

  const columns = useMemo((): Column<ServiceQuote>[] => [
    {
      label: 'Cotización',
      render: (q: ServiceQuote) => (
        <div>
          <div className="text-[12px] font-bold text-foreground">{q.quoteNumber}</div>
          <div className="text-[10px] text-muted-foreground">
            {new Date(q.createdAt).toLocaleDateString('es-MX')}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      label: 'Cliente',
      render: (q: ServiceQuote) => (
        <div>
          <div className="text-[12px] font-semibold text-foreground">
            {q.customer.firstName} {q.customer.lastName}
          </div>
          <div className="text-[10px] text-muted-foreground">{q.customer.email}</div>
        </div>
      ),
    },
    {
      key: 'items',
      label: 'Servicios',
      render: (q: ServiceQuote) => (
        <span className="text-[12px] text-muted-foreground">{q.items.length} servicio(s)</span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (q: ServiceQuote) => (
        <span className="text-[13px] font-extrabold text-foreground">{fmtLocal(Number(q.total))}</span>
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      render: (q: ServiceQuote) => (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[q.status]}`}>
          {STATUS_LABELS[q.status]}
        </span>
      ),
    },
    {
      label: '',
      render: (q: ServiceQuote) => (
        <button
          onClick={() => openDetail(q.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-[11px] font-semibold text-foreground bg-card hover:bg-muted cursor-pointer"
        >
          Ver <ChevronRight className="w-3 h-3" />
        </button>
      ),
    },
  ], [openDetail, fmtLocal])

  const statuses: Array<QuoteStatus | 'ALL'> = ['ALL', 'DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED']

  return (
    <div className="px-7 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <div className="text-[13px] font-bold text-foreground">Cotizaciones de Servicios</div>
            <div className="text-[11px] text-muted-foreground">{filtered.length} cotización(es)</div>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva cotización
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar cotización o cliente…"
            className="border-none bg-transparent outline-none text-[13px] text-foreground w-48"
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
              {s === 'ALL' ? 'Todas' : STATUS_LABELS[s as QuoteStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: filtered.length, color: 'text-foreground' },
          { label: 'Pendientes', value: filtered.filter((q) => ['DRAFT', 'SENT'].includes(q.status)).length, color: 'text-blue-600' },
          { label: 'Aprobadas', value: filtered.filter((q) => q.status === 'APPROVED').length, color: 'text-green-600' },
          { label: 'Convertidas', value: filtered.filter((q) => q.status === 'CONVERTED').length, color: 'text-purple-600' },
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
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <div className="text-[13px] font-semibold text-muted-foreground">Sin cotizaciones</div>
          <div className="text-[11px] text-muted-foreground mt-1">Crea la primera cotización con el botón de arriba</div>
        </div>
      ) : (
        <>
          <DataTable columns={columns} rows={pageData} />
          {filtered.length > perPage && (
            <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPage} />
          )}
        </>
      )}

      {/* Modals */}
      <CreateQuoteModal
        open={createOpen}
        form={createForm}
        setForm={setCreateForm}
        saving={saving}
        createSubtotal={createSubtotal}
        services={services}
        clientesFiltrados={clientesFiltrados}
        onClose={closeCreate}
        onSave={handleCreate}
        addItem={addItem}
        removeItem={removeItem}
        updateItem={updateItem}
        selectServiceForItem={selectServiceForItem}
      />

      {detailQuote && (
        <DetailModal
          quote={detailQuote}
          onClose={closeDetail}
          onApprove={handleApprove}
          onUpdateStatus={handleUpdateStatus}
          onOpenInPOS={openInPOS}
          onOpenWorkOrder={handleOpenWorkOrder}
        />
      )}
    </div>
  )
}
