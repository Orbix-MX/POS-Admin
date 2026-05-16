import { useMemo } from 'react'
import { Plus, Wrench, Clock, DollarSign, ToggleLeft, ToggleRight, Search } from 'lucide-react'
import { useServicios } from '@/hooks/retail/use-servicios'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import type { Service } from '@/services/retail/services-service'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

function ServiceModal({
  open, editing, form, setForm, saving, onClose, onSave,
}: {
  open: boolean
  editing: Service | null
  form: any
  setForm: (f: any) => void
  saving: boolean
  onClose: () => void
  onSave: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-[15px] font-bold text-foreground mb-5">
          {editing ? 'Editar servicio' : 'Nuevo servicio'}
        </h2>

        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p: any) => ({ ...p, name: e.target.value }))}
              placeholder="Ej: Reparación de PC"
              className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-background outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p: any) => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Descripción del servicio…"
              className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-background outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Precio base *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.basePrice}
                onChange={(e) => setForm((p: any) => ({ ...p, basePrice: parseFloat(e.target.value) || 0 }))}
                className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-background outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Duración estimada</label>
              <input
                value={form.estimatedDuration}
                onChange={(e) => setForm((p: any) => ({ ...p, estimatedDuration: e.target.value }))}
                placeholder="Ej: 2 horas"
                className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-background outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasVariablePrice}
                onChange={(e) => setForm((p: any) => ({ ...p, hasVariablePrice: e.target.checked }))}
                className="accent-primary"
              />
              <span className="text-xs text-foreground">Precio variable</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p: any) => ({ ...p, isActive: e.target.checked }))}
                className="accent-primary"
              />
              <span className="text-xs text-foreground">Activo</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground bg-card hover:bg-muted cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Servicios() {
  const {
    loading, error,
    search, setSearch,
    filterActive, setFilterActive,
    page, setPage, perPage,
    filtered, pageData,
    modalOpen, editing, form, setForm, saving,
    openCreate, openEdit, closeModal, handleSave,
    toggleActive,
  } = useServicios()

  const columns = useMemo((): Column<Service>[] => [
    {
      label: 'Servicio',
      render: (s: Service) => (
        <div>
          <div className="text-[12px] font-bold text-foreground">{s.name}</div>
          {s.description && (
            <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{s.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'basePrice',
      label: 'Precio base',
      render: (s: Service) => (
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-foreground">{fmt(Number(s.basePrice))}</span>
          {s.hasVariablePrice && (
            <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">VARIABLE</span>
          )}
        </div>
      ),
    },
    {
      key: 'estimatedDuration',
      label: 'Duración',
      render: (s: Service) =>
        s.estimatedDuration ? (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {s.estimatedDuration}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Estado',
      render: (s: Service) => (
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            s.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
          }`}
        >
          {s.isActive ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      label: '',
      render: (s: Service) => (
        <div className="flex gap-1.5 justify-end">
          <button
            onClick={() => toggleActive(s)}
            title={s.isActive ? 'Desactivar' : 'Activar'}
            className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted cursor-pointer text-muted-foreground"
          >
            {s.isActive ? <ToggleRight className="w-3.5 h-3.5 text-green-600" /> : <ToggleLeft className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => openEdit(s)}
            className="px-2.5 py-1.5 border border-border rounded-lg text-[11px] font-semibold text-foreground bg-card hover:bg-muted cursor-pointer"
          >
            Editar
          </button>
        </div>
      ),
    },
  ], [openEdit, toggleActive])

  return (
    <div className="px-7 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary" />
          <div>
            <div className="text-[13px] font-bold text-foreground">Catálogo de Servicios</div>
            <div className="text-[11px] text-muted-foreground">{filtered.length} servicio(s)</div>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo servicio
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar servicio…"
            className="border-none bg-transparent outline-none text-[13px] text-foreground w-full"
          />
        </div>
        <select
          value={filterActive}
          onChange={(e) => { setFilterActive(e.target.value as any); setPage(1) }}
          className="px-2.5 py-2 border border-border rounded-lg text-[12px] text-foreground bg-card outline-none focus:border-primary cursor-pointer"
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total servicios', value: filtered.length, icon: Wrench, color: 'text-primary' },
          { label: 'Activos', value: filtered.filter((s) => s.isActive).length, icon: ToggleRight, color: 'text-green-600' },
          { label: 'Precio variable', value: filtered.filter((s) => s.hasVariablePrice).length, icon: DollarSign, color: 'text-amber-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            <div>
              <div className="text-[18px] font-extrabold text-foreground">{kpi.value}</div>
              <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Cargando…</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500 text-sm">{error}</div>
      ) : (
        <>
          <DataTable columns={columns} rows={pageData} />
          {filtered.length > perPage && (
            <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPage} />
          )}
        </>
      )}

      <ServiceModal
        open={modalOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        saving={saving}
        onClose={closeModal}
        onSave={handleSave}
      />
    </div>
  )
}
