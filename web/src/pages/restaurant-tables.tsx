import { useMemo, useCallback } from 'react'
import { FormModal, FormField } from '@/components/shared/form-modal'
import { useRestaurantTables } from '@/hooks/restaurant/use-restaurant-tables'
import type { RestaurantTable } from '@/hooks/restaurant/use-restaurant-tables'

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupada',
  RESERVED: 'Reservada',
  BLOCKED: 'Bloqueada',
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  OCCUPIED:  'bg-red-500/10 text-red-600 border border-red-500/20',
  RESERVED:  'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  BLOCKED:   'bg-zinc-200 text-zinc-500 border border-zinc-300 dark:bg-zinc-700 dark:text-zinc-400 dark:border-zinc-600',
}

function TableCard({ table, onEdit, onToggle }: {
  table: RestaurantTable
  onEdit: (t: RestaurantTable) => void
  onToggle: (t: RestaurantTable) => void
}) {
  return (
    <div
      className={`relative flex flex-col gap-1.5 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md ${table.isActive ? 'bg-card border-border' : 'bg-muted/40 border-border opacity-60'}`}
      onClick={() => onEdit(table)}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-[14px] font-bold text-foreground leading-tight">{table.name}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[table.status]}`}>
          {STATUS_LABEL[table.status]}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground">{table.capacity} personas</div>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(table) }}
        className={`mt-1 text-[11px] rounded border px-2 py-0.5 bg-transparent cursor-pointer ${table.isActive ? 'border-amber-400/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'border-emerald-400/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
      >
        {table.isActive ? 'Desactivar' : 'Activar'}
      </button>
    </div>
  )
}

export default function RestaurantTablesPage() {
  const {
    areas, tablesByArea, loading, error, search, setSearch,
    filterAreaId, setFilterAreaId,
    currentBranch, branchId,
    modalOpen, editTarget, form, setForm, saving, saveError,
    openCreate, openEdit, closeModal, handleSave, toggleActive,
  } = useRestaurantTables()

  const areaOptions = useMemo(() =>
    areas.filter((a) => a.isActive).map((a) => ({ value: a.id, label: a.name })),
    [areas])

  const handleField = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [k]: v }))
  }, [setForm])

  if (!branchId) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-muted-foreground text-[14px]">Selecciona una sucursal para administrar sus mesas.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-bold text-foreground">Mesas del restaurante</h1>
          {currentBranch && (
            <p className="text-[12px] text-muted-foreground mt-0.5">{currentBranch.name}</p>
          )}
        </div>
        <button
          onClick={() => openCreate()}
          className="px-4 py-2 bg-primary text-primary-foreground text-[13px] font-semibold rounded-lg border-none cursor-pointer hover:opacity-90"
        >
          + Nueva mesa
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-border flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar mesa…"
          className="px-3 py-2 border border-border rounded-lg text-[13px] bg-card text-foreground outline-none focus:border-primary w-48"
        />
        <select
          value={filterAreaId}
          onChange={(e) => setFilterAreaId(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-[13px] bg-card text-foreground outline-none focus:border-primary"
        >
          <option value="">Todas las áreas</option>
          {areas.filter((a) => a.isActive).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error ? (
          <div className="text-center text-destructive text-[14px] py-8">{error}</div>
        ) : loading ? (
          <div className="text-center text-muted-foreground text-[13px] py-8">Cargando mesas…</div>
        ) : tablesByArea.every((g) => g.tables.length === 0) ? (
          <div className="text-center text-muted-foreground text-[13px] py-8">
            {areas.length === 0
              ? 'No hay áreas activas. Crea áreas primero en "Áreas del restaurante".'
              : 'No hay mesas. Agrega la primera con "+ Nueva mesa".'}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {tablesByArea.map(({ area, tables }) => {
              if (tables.length === 0 && (search || filterAreaId)) return null
              return (
                <div key={area.id}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[15px] font-bold text-foreground">{area.name}</h2>
                      <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">{tables.length} mesas</span>
                    </div>
                    <button
                      onClick={() => openCreate(area.id)}
                      className="text-[12px] text-primary hover:underline bg-transparent border-none cursor-pointer"
                    >
                      + Agregar mesa
                    </button>
                  </div>
                  {tables.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground italic">Sin mesas en esta área.</p>
                  ) : (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                      {tables.map((table) => (
                        <TableCard key={table.id} table={table} onEdit={openEdit} onToggle={toggleActive} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      <FormModal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Editar mesa' : 'Nueva mesa'}
      >
        <div className="flex flex-col gap-4">
          <FormField
            label="Nombre *"
            value={form.name}
            onChange={(v) => handleField('name', v)}
          />

          {/* Area select */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-foreground">Área *</label>
            <select
              value={form.areaId}
              onChange={(e) => handleField('areaId', e.target.value)}
              className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
            >
              <option value="">Selecciona un área</option>
              {areaOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <FormField
            label="Capacidad (personas)"
            value={String(form.capacity ?? 4)}
            onChange={(v) => handleField('capacity', Number(v) || 1)}
            type="number"
            min={1}
          />
          <FormField
            label="Orden de visualización"
            value={String(form.displayOrder ?? 0)}
            onChange={(v) => handleField('displayOrder', Number(v) || 0)}
            type="number"
            min={0}
          />

          {saveError && (
            <p className="text-[12px] text-destructive">{saveError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-[13px] rounded-lg border border-border text-muted-foreground bg-transparent cursor-pointer hover:bg-muted/50"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving || !form.name.trim() || !form.areaId}
              className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-primary text-primary-foreground border-none cursor-pointer hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : (editTarget ? 'Guardar cambios' : 'Crear mesa')}
            </button>
          </div>
        </div>
      </FormModal>
    </div>
  )
}
