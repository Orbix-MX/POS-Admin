import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, Edit2, Check, X, Loader2, LayoutDashboard,
  ChevronRight, Shield, Zap, AlertTriangle, GripVertical,
} from 'lucide-react'
import type {
  PlatformDashboard, PlatformWidget, TenantRole, WidgetType,
} from '@/services/platform/platform-dashboards-service'
import {
  listDashboards, getDashboard, createDashboard, updateDashboard, deleteDashboard,
  addWidget, updateWidget, deleteWidget, listTenantRoles,
  assignDashboardRole, removeDashboardRole,
} from '@/services/platform/platform-dashboards-service'

// ─── Constants ────────────────────────────────────────────────────────────────

const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  COUNTER:    'Contador',
  BAR_CHART:  'Barras',
  LINE_CHART: 'Líneas',
  AREA_CHART: 'Área',
  PIE_CHART:  'Pastel',
  DONUT_CHART:'Dona',
  TABLE:      'Tabla',
  RANKING:    'Ranking',
  TIMELINE:   'Línea de tiempo',
  HEATMAP:    'Mapa de calor',
  FUNNEL:     'Embudo',
  GAUGE:      'Medidor',
  TEXT_CARD:  'Tarjeta de texto',
}

const ALL_WIDGET_TYPES: WidgetType[] = [
  'COUNTER', 'BAR_CHART', 'LINE_CHART', 'AREA_CHART', 'PIE_CHART',
  'DONUT_CHART', 'TABLE', 'RANKING', 'TIMELINE', 'HEATMAP',
  'FUNNEL', 'GAUGE', 'TEXT_CARD',
]

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function errMsg(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error inesperado'
}

// ─── Small shared input ───────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text', disabled }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        className="w-full px-2.5 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[12px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500 disabled:opacity-50"
      />
    </div>
  )
}

// ─── Create / Edit Dashboard Modal ───────────────────────────────────────────

interface DashboardFormProps {
  tenantId: string
  existing?: PlatformDashboard
  onSaved: () => void
  onClose: () => void
}

function DashboardFormModal({ tenantId, existing, onSaved, onClose }: DashboardFormProps) {
  const [name, setName]       = useState(existing?.name ?? '')
  const [slug, setSlug]       = useState(existing?.slug ?? '')
  const [desc, setDesc]       = useState(existing?.description ?? '')
  const [isDef, setIsDef]     = useState(existing?.isDefault ?? false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const autoSlug = !existing

  const handleSave = async () => {
    if (!name || !slug) return
    setSaving(true); setError(null)
    try {
      if (existing) {
        await updateDashboard(tenantId, existing.id, { name, slug, description: desc || undefined, isDefault: isDef })
      } else {
        await createDashboard(tenantId, { name, slug, description: desc || undefined, isDefault: isDef })
      }
      onSaved()
    } catch (e) { setError(errMsg(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[440px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-bold text-zinc-200">
            {existing ? 'Editar dashboard' : 'Nuevo dashboard'}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-900/60 rounded-lg text-[12px] text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Field
            label="Nombre" value={name}
            onChange={v => { setName(v); if (autoSlug) setSlug(slugify(v)) }}
            placeholder="Dashboard Gerencia"
          />
          <Field
            label="Slug (identificador)" value={slug}
            onChange={setSlug} placeholder="dashboard-gerencia"
          />
          <Field
            label="Descripción (opcional)" value={desc}
            onChange={setDesc} placeholder="Descripción breve…"
          />
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isDef} onChange={e => setIsDef(e.target.checked)}
              className="accent-indigo-500 w-3.5 h-3.5" />
            <span className="text-[12px] text-zinc-300">Marcar como dashboard por defecto</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose}
            className="px-4 py-2 text-[12px] font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !name || !slug}
            className="px-4 py-2 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg border-none cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            {existing ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add / Edit Widget Modal ──────────────────────────────────────────────────

interface WidgetFormProps {
  tenantId: string
  dashboardId: string
  existing?: PlatformWidget
  nextSortOrder: number
  onSaved: () => void
  onClose: () => void
}

function ColSpanPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
        Columnas <span className="text-indigo-400 font-bold">{value}</span>
        <span className="text-zinc-600 font-normal"> / 12</span>
      </label>
      <div className="flex gap-0.5">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(col => (
          <button
            key={col}
            type="button"
            onClick={() => onChange(col)}
            className={[
              'flex-1 h-6 rounded text-[9px] font-bold border transition-colors cursor-pointer',
              col <= value
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-zinc-800 border-zinc-700 text-zinc-600 hover:bg-zinc-700',
            ].join(' ')}
          >
            {col}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-zinc-600 mt-1">
        El widget ocupará {value} de 12 columnas ({Math.round((value / 12) * 100)}% del ancho)
      </div>
    </div>
  )
}

function WidgetFormModal({ tenantId, dashboardId, existing, nextSortOrder, onSaved, onClose }: WidgetFormProps) {
  const [widgetType, setWidgetType] = useState<WidgetType>(existing?.widgetType ?? 'COUNTER')
  const [title, setTitle]           = useState(existing?.title ?? '')
  const [subtitle, setSubtitle]     = useState(existing?.subtitle ?? '')
  const [endpoint, setEndpoint]     = useState(existing?.endpoint ?? '')
  const [method, setMethod]         = useState(existing?.httpMethod ?? 'GET')
  const [refresh, setRefresh]       = useState(existing?.refreshSeconds?.toString() ?? '')
  const [colSpan, setColSpan]       = useState(existing?.colSpan ?? 6)
  const [sortOrder, setSortOrder]   = useState((existing?.sortOrder ?? nextSortOrder).toString())
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const handleSave = async () => {
    if (!title || !endpoint) return
    setSaving(true); setError(null)
    const dto = {
      widgetType,
      title,
      subtitle: subtitle || undefined,
      endpoint,
      httpMethod: method,
      refreshSeconds: refresh ? Number(refresh) : undefined,
      sortOrder: sortOrder !== '' ? Number(sortOrder) : (existing?.sortOrder ?? nextSortOrder),
      colSpan,
    }
    try {
      if (existing) {
        await updateWidget(tenantId, dashboardId, existing.id, dto)
      } else {
        await addWidget(tenantId, dashboardId, dto)
      }
      onSaved()
    } catch (e) { setError(errMsg(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[520px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-bold text-zinc-200">
            {existing ? 'Editar widget' : 'Nuevo widget'}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-900/60 rounded-lg text-[12px] text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Tipo de widget</label>
            <select value={widgetType} onChange={e => setWidgetType(e.target.value as WidgetType)}
              className="w-full px-2.5 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[12px] text-zinc-200 outline-none focus:border-indigo-500 cursor-pointer">
              {ALL_WIDGET_TYPES.map(t => (
                <option key={t} value={t}>{WIDGET_TYPE_LABELS[t]} ({t})</option>
              ))}
            </select>
          </div>
          <Field label="Título *" value={title} onChange={setTitle} placeholder="Ventas del mes" />
          <Field label="Subtítulo" value={subtitle} onChange={setSubtitle} placeholder="Últimos 30 días" />
          <div className="col-span-2">
            <Field
              label="Endpoint API *" value={endpoint} onChange={setEndpoint}
              placeholder="/reports/sales/summary"
            />
            <div className="text-[10px] text-zinc-600 mt-1">Ruta relativa al API del tenant (ej: /reports/sales/monthly)</div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Método HTTP</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              className="w-full px-2.5 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[12px] text-zinc-200 outline-none focus:border-indigo-500 cursor-pointer">
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </div>
          <Field
            label="Refresco automático (seg)" value={refresh}
            onChange={setRefresh} placeholder="60 — vacío = sin refresco" type="number"
          />
          <div className="col-span-2">
            <ColSpanPicker value={colSpan} onChange={setColSpan} />
          </div>
          <div>
            <Field
              label="Posición (índice)" value={sortOrder}
              onChange={setSortOrder} placeholder="0, 1, 2…" type="number"
            />
            <div className="text-[10px] text-zinc-600 mt-1">Orden en el dashboard (0 = primero)</div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose}
            className="px-4 py-2 text-[12px] font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !title || !endpoint}
            className="px-4 py-2 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg border-none cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            {existing ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard Detail Panel ───────────────────────────────────────────────────

interface DashboardDetailProps {
  tenantId: string
  dashboardId: string
  tenantRoles: TenantRole[]
  onClose: () => void
  onDeleted: () => void
}

function DashboardDetail({ tenantId, dashboardId, tenantRoles, onClose, onDeleted }: DashboardDetailProps) {
  const [dashboard, setDashboard]       = useState<PlatformDashboard | null>(null)
  const [loading, setLoading]           = useState(true)
  const [showWidgetForm, setShowWidgetForm] = useState(false)
  const [editWidget, setEditWidget]     = useState<PlatformWidget | null>(null)
  const [showEditDash, setShowEditDash] = useState(false)
  const [addingRole, setAddingRole]     = useState(false)
  const [selectedRole, setSelectedRole] = useState('')
  const [actionError, setActionError]   = useState<string | null>(null)
  const [deletingWidget, setDeletingWidget] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete]   = useState(false)

  // ── drag-and-drop widget reorder ────────────────────────────────────────────
  const [widgetOrder, setWidgetOrder]   = useState<PlatformWidget[]>([])
  const [dragIdx, setDragIdx]           = useState<number | null>(null)
  const [overIdx, setOverIdx]           = useState<number | null>(null)
  const [savingOrder, setSavingOrder]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setDashboard(await getDashboard(tenantId, dashboardId)) }
    finally { setLoading(false) }
  }, [tenantId, dashboardId])

  useEffect(() => { load() }, [load])

  // keep widgetOrder in sync whenever dashboard reloads
  useEffect(() => {
    setWidgetOrder([...(dashboard?.widgets ?? [])].sort((a, b) => a.sortOrder - b.sortOrder))
  }, [dashboard])

  const handleDragStart = (idx: number) => setDragIdx(idx)

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (idx !== overIdx) setOverIdx(idx)
  }

  const handleDrop = async (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null); setOverIdx(null); return
    }
    const next = [...widgetOrder]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(dropIdx, 0, moved)
    setWidgetOrder(next)
    setDragIdx(null); setOverIdx(null)

    setSavingOrder(true)
    setActionError(null)
    try {
      await Promise.all(
        next.map((w, i) => updateWidget(tenantId, dashboardId, w.id, { sortOrder: i }))
      )
    } catch (e) {
      setActionError(errMsg(e))
      await load()
    } finally {
      setSavingOrder(false)
    }
  }

  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null) }

  const assignedRoleIds = new Set(dashboard?.roles.map(r => r.roleId) ?? [])
  const availableRoles = tenantRoles.filter(r => !assignedRoleIds.has(r.id))

  const handleAddRole = async () => {
    if (!selectedRole) return
    setActionError(null)
    try {
      await assignDashboardRole(tenantId, dashboardId, selectedRole)
      setSelectedRole('')
      setAddingRole(false)
      await load()
    } catch (e) { setActionError(errMsg(e)) }
  }

  const handleRemoveRole = async (roleId: string) => {
    setActionError(null)
    try {
      await removeDashboardRole(tenantId, dashboardId, roleId)
      await load()
    } catch (e) { setActionError(errMsg(e)) }
  }

  const handleDeleteWidget = async (widgetId: string) => {
    setDeletingWidget(widgetId)
    setActionError(null)
    try {
      await deleteWidget(tenantId, dashboardId, widgetId)
      await load()
    } catch (e) { setActionError(errMsg(e)) }
    finally { setDeletingWidget(null) }
  }

  const handleDeleteDashboard = async () => {
    setActionError(null)
    try {
      await deleteDashboard(tenantId, dashboardId)
      onDeleted()
    } catch (e) { setActionError(errMsg(e)) }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
    </div>
  )
  if (!dashboard) return null

  return (
    <div className="flex-1 flex flex-col gap-5 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[15px] font-bold text-zinc-200">{dashboard.name}</div>
            {dashboard.isDefault && (
              <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full font-semibold">Por defecto</span>
            )}
            {!dashboard.isActive && (
              <span className="text-[10px] px-2 py-0.5 bg-zinc-700 text-zinc-400 rounded-full">Inactivo</span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono mt-0.5">{dashboard.slug}</div>
          {dashboard.description && (
            <div className="text-[12px] text-zinc-500 mt-1">{dashboard.description}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowEditDash(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-lg cursor-pointer">
            <Edit2 className="w-3 h-3" /> Editar
          </button>
          <button onClick={onClose}
            className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-semibold text-zinc-500 bg-transparent border border-zinc-700 hover:border-zinc-500 rounded-lg cursor-pointer">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-900/60 rounded-lg text-[12px] text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {actionError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {/* ── Widgets ─────────────────────────────────────────────────────── */}
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-700/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[12px] font-bold text-zinc-300">
                Widgets ({widgetOrder.length})
              </span>
              {savingOrder && <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />}
            </div>
            <button onClick={() => setShowWidgetForm(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg border-none cursor-pointer">
              <Plus className="w-3 h-3" /> Agregar
            </button>
          </div>

          {!widgetOrder.length ? (
            <div className="px-4 py-6 text-center text-[12px] text-zinc-600">
              Sin widgets. Agrega el primero.
            </div>
          ) : (
            <div className="divide-y divide-zinc-700/30">
              {widgetOrder.map((w, idx) => (
                <div
                  key={w.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  className={[
                    'flex items-start gap-2 px-3 py-3 transition-colors select-none',
                    dragIdx === idx
                      ? 'opacity-30 bg-zinc-700/20'
                      : 'hover:bg-zinc-700/10',
                    overIdx === idx && dragIdx !== idx
                      ? 'border-t-2 border-indigo-500'
                      : '',
                  ].join(' ')}
                >
                  {/* drag handle */}
                  <div className="mt-0.5 text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing shrink-0">
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/15 text-indigo-400 rounded font-mono whitespace-nowrap">
                        {WIDGET_TYPE_LABELS[w.widgetType]}
                      </span>
                      <span className="text-[12px] font-semibold text-zinc-200 truncate">{w.title}</span>
                    </div>
                    {w.subtitle && (
                      <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{w.subtitle}</div>
                    )}
                    <div className="text-[10px] font-mono text-zinc-600 mt-1 truncate">{w.endpoint}</div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditWidget(w)}
                      className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer rounded">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteWidget(w.id)}
                      disabled={deletingWidget === w.id}
                      className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-red-400 bg-transparent border-none cursor-pointer rounded disabled:opacity-50">
                      {deletingWidget === w.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Roles ───────────────────────────────────────────────────────── */}
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-700/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[12px] font-bold text-zinc-300">Roles con acceso</span>
            </div>
            {availableRoles.length > 0 && (
              <button onClick={() => setAddingRole(v => !v)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg border-none cursor-pointer">
                <Plus className="w-3 h-3" /> Asignar
              </button>
            )}
          </div>

          {addingRole && (
            <div className="px-4 py-3 border-b border-zinc-700/30 flex items-center gap-2">
              <select
                value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-[12px] text-zinc-200 outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">Seleccionar rol…</option>
                {availableRoles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button onClick={handleAddRole} disabled={!selectedRole}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg border-none cursor-pointer disabled:opacity-50 flex items-center gap-1">
                <Check className="w-3 h-3" /> OK
              </button>
              <button onClick={() => { setAddingRole(false); setSelectedRole('') }}
                className="px-2 py-1.5 bg-zinc-800 text-zinc-400 text-[11px] rounded-lg border border-zinc-700 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {!tenantRoles.length ? (
            <div className="px-4 py-6 text-center text-[12px] text-zinc-600">
              Este tenant no tiene roles definidos.
            </div>
          ) : !dashboard.roles.length ? (
            <div className="px-4 py-6 text-center">
              <div className="text-[12px] text-zinc-400 font-semibold mb-1">Visible para todos</div>
              <div className="text-[11px] text-zinc-600">Sin restricción de rol — todos los usuarios del tenant pueden ver este dashboard.</div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-700/30">
              {dashboard.roles.map(dr => (
                <div key={dr.roleId} className="flex items-center gap-3 px-4 py-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: dr.role.color ?? '#6366f1' }}
                  />
                  <span className="flex-1 text-[12px] text-zinc-300 font-medium">{dr.role.name}</span>
                  <div className="flex items-center gap-1">
                    {dr.canView && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">Ver</span>
                    )}
                    {dr.canEdit && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded">Editar</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveRole(dr.roleId)}
                    className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-red-400 bg-transparent border-none cursor-pointer rounded">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="border border-red-900/40 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="text-[12px] font-bold text-red-400">Eliminar dashboard</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Se eliminarán también todos sus widgets. Esta acción no se puede deshacer.</div>
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400">¿Confirmar?</span>
            <button onClick={handleDeleteDashboard}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-[11px] font-semibold rounded-lg border-none cursor-pointer">
              Sí, eliminar
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 bg-zinc-800 text-zinc-400 text-[11px] rounded-lg border border-zinc-700 cursor-pointer">
              Cancelar
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-red-400 border border-red-900/50 rounded-lg bg-transparent hover:bg-red-950/40 cursor-pointer">
            <Trash2 className="w-3 h-3" /> Eliminar
          </button>
        )}
      </div>

      {/* Modals */}
      {showWidgetForm && (
        <WidgetFormModal
          tenantId={tenantId}
          dashboardId={dashboardId}
          nextSortOrder={dashboard.widgets?.length ?? 0}
          onSaved={async () => { setShowWidgetForm(false); await load() }}
          onClose={() => setShowWidgetForm(false)}
        />
      )}
      {editWidget && (
        <WidgetFormModal
          tenantId={tenantId}
          dashboardId={dashboardId}
          existing={editWidget}
          nextSortOrder={editWidget.sortOrder}
          onSaved={async () => { setEditWidget(null); await load() }}
          onClose={() => setEditWidget(null)}
        />
      )}
      {showEditDash && (
        <DashboardFormModal
          tenantId={tenantId}
          existing={dashboard}
          onSaved={async () => { setShowEditDash(false); await load() }}
          onClose={() => setShowEditDash(false)}
        />
      )}
    </div>
  )
}

// ─── Main exported tab component ─────────────────────────────────────────────

export function DashboardsTab({ tenantId }: { tenantId: string }) {
  const [dashboards, setDashboards]     = useState<PlatformDashboard[]>([])
  const [roles, setRoles]               = useState<TenantRole[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [showCreate, setShowCreate]     = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [ds, rs] = await Promise.all([listDashboards(tenantId), listTenantRoles(tenantId)])
      setDashboards(ds)
      setRoles(rs)
    } catch (e) { setError(errMsg(e)) }
    finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
    </div>
  )

  return (
    <div className="flex gap-5 min-h-[400px]">
      {/* ── Left: Dashboard list ──────────────────────────────────────────── */}
      <div className="w-[280px] shrink-0 flex flex-col gap-3">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-semibold rounded-xl border-none cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nuevo dashboard
        </button>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-900/60 rounded-lg text-[12px] text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        {!dashboards.length ? (
          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-8 text-center">
            <LayoutDashboard className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <div className="text-[12px] text-zinc-500">Sin dashboards configurados</div>
            <div className="text-[11px] text-zinc-600 mt-1">Crea uno para empezar</div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {dashboards.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
                className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all cursor-pointer
                  ${selectedId === d.id
                    ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300'
                    : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-300 hover:border-zinc-600'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <LayoutDashboard className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    <span className="text-[13px] font-semibold truncate">{d.name}</span>
                    {d.isDefault && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-indigo-500/30 text-indigo-300 rounded-full shrink-0">default</span>
                    )}
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${selectedId === d.id ? 'rotate-90' : ''}`} />
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] text-zinc-500">{d._count?.widgets ?? 0} widgets</span>
                  {d.roles.length > 0 ? (
                    <span className="text-[10px] text-zinc-500">{d.roles.length} rol{d.roles.length !== 1 ? 'es' : ''}</span>
                  ) : (
                    <span className="text-[10px] text-zinc-600">todos los roles</span>
                  )}
                  {!d.isActive && (
                    <span className="text-[10px] text-zinc-600">inactivo</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: Detail panel ───────────────────────────────────────────── */}
      {selectedId ? (
        <DashboardDetail
          key={selectedId}
          tenantId={tenantId}
          dashboardId={selectedId}
          tenantRoles={roles}
          onClose={() => setSelectedId(null)}
          onDeleted={() => { setSelectedId(null); load() }}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center border border-zinc-700/30 rounded-xl border-dashed">
          <div className="text-center">
            <LayoutDashboard className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <div className="text-[13px] text-zinc-500 font-semibold">Selecciona un dashboard</div>
            <div className="text-[11px] text-zinc-600 mt-1">para ver widgets y asignación de roles</div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <DashboardFormModal
          tenantId={tenantId}
          onSaved={async () => { setShowCreate(false); await load() }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
