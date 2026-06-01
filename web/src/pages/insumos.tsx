import { useMemo } from 'react'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import { FormModal, FormField } from '@/components/shared/form-modal'
import { Search, Plus, Pencil, Trash2, Loader2, Package, AlertTriangle, TrendingDown, ArrowUpDown, ArrowRight } from 'lucide-react'
import { useSupplies } from '@/hooks/retail/use-supplies'
import type { Supply } from '@/services/retail/supplies-service'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  const isLow = Number(stock) <= Number(minStock)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
      isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
    }`}>
      {isLow && <AlertTriangle className="w-3 h-3" />}
      {Number(stock).toLocaleString('es-MX', { maximumFractionDigits: 3 })}
    </span>
  )
}

/** Display stock in inventory unit (stock stored in base unit) */
function StockDisplay({ supply }: { supply: Supply }) {
  const convFactor = Number(supply.conversionFactor ?? 1) || 1
  const invSymbol = supply.inventoryUnit?.symbol ?? supply.unit
  const baseSymbol = supply.baseUnit?.symbol ?? supply.unit
  const rawStock = Number(supply.stock)

  if (supply.inventoryUnitId && convFactor !== 1) {
    const inventoryQty = rawStock / convFactor
    return (
      <div>
        <StockBadge stock={inventoryQty} minStock={Number(supply.minStock) / convFactor} />
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {invSymbol} ({rawStock.toLocaleString('es-MX', { maximumFractionDigits: 0 })} {baseSymbol})
        </div>
      </div>
    )
  }
  return <StockBadge stock={rawStock} minStock={Number(supply.minStock)} />
}

export function Insumos() {
  const {
    loading, error, search, setSearch, page, setPage,
    filtered, pageData, stats, perPage,
    measurementUnits,
    modalOpen, editingId, form, setForm,
    handleOpenNew, handleEdit, handleCloseModal, handleSave, handleDelete,
    adjustModalOpen, setAdjustModalOpen, adjustingId, adjustQty, setAdjustQty,
    adjustNotes, setAdjustNotes, handleOpenAdjust, handleAdjust,
    supplies, loadSupplies,
  } = useSupplies()

  // Derived form state
  const inventoryUnit = useMemo(
    () => measurementUnits.find((u) => u.id === form.inventoryUnitId) ?? null,
    [measurementUnits, form.inventoryUnitId],
  )
  const baseUnitObj = useMemo(
    () => measurementUnits.find((u) => u.id === form.baseUnitId) ?? null,
    [measurementUnits, form.baseUnitId],
  )

  // Units compatible with currently selected inventory unit (same category)
  const compatibleBaseUnits = useMemo(() => {
    if (!inventoryUnit) return measurementUnits
    return measurementUnits.filter(
      (u) => u.category === inventoryUnit.category && u.id !== form.inventoryUnitId,
    )
  }, [measurementUnits, inventoryUnit, form.inventoryUnitId])

  // Auto-compute conversionFactor when both units selected and same WEIGHT/VOLUME category
  const autoConversionFactor = useMemo(() => {
    if (!inventoryUnit || !baseUnitObj) return null
    if (inventoryUnit.category === 'COUNT') return null
    const inv = Number(inventoryUnit.baseFactor)
    const base = Number(baseUnitObj.baseFactor)
    if (base === 0) return null
    return inv / base
  }, [inventoryUnit, baseUnitObj])

  const adjustingSupply = supplies.find((s) => s.id === adjustingId)

  const columns: Column<Supply>[] = useMemo(() => [
    {
      label: 'SKU',
      render: (r) => <span className="font-mono text-[11px] text-muted-foreground font-semibold">{r.sku}</span>,
    },
    {
      label: 'Insumo',
      render: (r) => {
        const invSymbol = r.inventoryUnit?.symbol ?? r.unit
        const baseSymbol = r.baseUnit?.symbol ?? r.unit
        const hasTwoUnits = r.inventoryUnitId && r.baseUnitId && invSymbol !== baseSymbol
        return (
          <div>
            <div className="font-semibold text-[13px]">{r.name}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              {hasTwoUnits ? (
                <>
                  <span>{invSymbol}</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                  <span>{baseSymbol}</span>
                  <span className="text-[10px] opacity-60">(×{Number(r.conversionFactor ?? 1)})</span>
                </>
              ) : (
                <span>{invSymbol}</span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      label: 'Stock',
      render: (r) => <StockDisplay supply={r} />,
    },
    {
      label: 'Mín.',
      render: (r) => {
        const convFactor = Number(r.conversionFactor ?? 1) || 1
        const invSymbol = r.inventoryUnit?.symbol ?? r.unit
        const minQty = r.inventoryUnitId && convFactor !== 1
          ? Number(r.minStock) / convFactor
          : Number(r.minStock)
        return (
          <span className="text-[12px] text-muted-foreground">
            {minQty.toLocaleString('es-MX', { maximumFractionDigits: 3 })} {invSymbol}
          </span>
        )
      },
    },
    {
      label: 'Costo',
      render: (r) => (
        <span className="text-[12px]">
          {Number(r.cost).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
        </span>
      ),
    },
    {
      label: 'Estado',
      render: (r) => (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
          r.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {r.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      label: 'Acciones',
      render: (r) => (
        <div className="flex gap-1.5">
          <button
            onClick={() => handleOpenAdjust(r.id!)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Ajustar stock"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleEdit(r.id!)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete(r.id!)}
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ], [handleEdit, handleDelete, handleOpenAdjust])

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Insumos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ingredientes y materiales consumibles para recetas
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nuevo Insumo
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Package className="w-4 h-4" />
            <span className="text-xs font-medium">Total insumos</span>
          </div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Package className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium">Activos</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium">Stock bajo</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.lowStock}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar insumo o SKU..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={loadSupplies}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-card text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Actualizar
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando insumos...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <span className="text-sm text-red-500">{error}</span>
          <button onClick={loadSupplies} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer">
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <DataTable columns={columns} rows={pageData} />
          <div className="mt-4">
            <Pagination
              page={page}
              total={filtered.length}
              perPage={perPage}
              onChange={setPage}
            />
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      <FormModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingId ? 'Editar Insumo' : 'Nuevo Insumo'}
      >
        <div className="grid grid-cols-2 gap-x-4">
          {/* Nombre */}
          <div className="col-span-2">
            <FormField label="Nombre" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
          </div>

          {/* SKU solo en creación */}
          {!editingId && (
            <FormField label="SKU" value={form.sku} onChange={(v) => setForm((p) => ({ ...p, sku: v }))} />
          )}

          {/* ── Unidades ── */}
          {/* Paso 1: Unidad inventario (display operativa) */}
          <div className="mb-3.5">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Unidad inventario
              <span className="font-normal ml-1 text-[10px]">(KG, LT, Caja…)</span>
            </label>
            <Select
              value={form.inventoryUnitId ?? ''}
              onValueChange={(v) => {
                const mu = measurementUnits.find((u) => u.id === v)
                // Reset base unit and factor when changing inventory unit
                setForm((p) => ({
                  ...p,
                  inventoryUnitId: v || null,
                  unit: mu ? mu.symbol : p.unit,
                  baseUnitId: null,
                  conversionFactor: 1,
                }))
              }}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Seleccionar…">
                  {inventoryUnit ? `${inventoryUnit.name} (${inventoryUnit.symbol})` : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(['WEIGHT', 'VOLUME', 'COUNT'] as const).map((cat) => {
                  const catUnits = measurementUnits.filter((u) => u.category === cat)
                  if (!catUnits.length) return null
                  return catUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </SelectItem>
                  ))
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Paso 2: Unidad mínima/base (almacenamiento interno) */}
          <div className="mb-3.5">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Unidad mínima / base
              <span className="font-normal ml-1 text-[10px]">(GR, ML, Pieza…)</span>
            </label>
            <Select
              value={form.baseUnitId ?? ''}
              onValueChange={(v) => {
                const mu = measurementUnits.find((u) => u.id === v)
                // Auto-compute factor for WEIGHT/VOLUME
                let factor = form.conversionFactor
                if (mu && inventoryUnit && inventoryUnit.category !== 'COUNT') {
                  const inv = Number(inventoryUnit.baseFactor)
                  const base = Number(mu.baseFactor)
                  if (base > 0) factor = inv / base
                }
                setForm((p) => ({
                  ...p,
                  baseUnitId: v || null,
                  conversionFactor: factor,
                }))
              }}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Seleccionar…">
                  {baseUnitObj ? `${baseUnitObj.name} (${baseUnitObj.symbol})` : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {compatibleBaseUnits.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Paso 3: Equivalencia / factor de conversión */}
          {form.inventoryUnitId && form.baseUnitId && (
            <div className="col-span-2 mb-3.5 p-3 bg-muted/30 rounded-lg border border-border">
              <label className="block text-xs font-semibold text-muted-foreground mb-2">
                Equivalencia
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-foreground">1 {inventoryUnit?.symbol}</span>
                <span className="text-muted-foreground">=</span>
                {autoConversionFactor !== null ? (
                  // WEIGHT/VOLUME: auto-computed, show read-only
                  <>
                    <span className="text-[13px] font-semibold text-primary">{autoConversionFactor}</span>
                    <span className="text-[13px] text-foreground">{baseUnitObj?.symbol}</span>
                    <span className="text-[11px] text-muted-foreground ml-1">(automático)</span>
                  </>
                ) : (
                  // COUNT: user defines factor
                  <>
                    <input
                      type="number"
                      min="0.000001"
                      step="1"
                      value={form.conversionFactor}
                      onChange={(e) => setForm((p) => ({ ...p, conversionFactor: Number(e.target.value) || 1 }))}
                      className="w-24 px-2 py-1 border border-border rounded text-[13px] bg-card outline-none focus:border-primary text-center font-semibold"
                    />
                    <span className="text-[13px] text-foreground">{baseUnitObj?.symbol}</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Stock se almacena en <strong>{baseUnitObj?.symbol}</strong>.
                {autoConversionFactor !== null
                  ? ` Al ingresar ${inventoryUnit?.symbol}, el sistema convierte automáticamente.`
                  : ' Define cuántas unidades mínimas equivale 1 unidad inventario (ej: 1 Caja = 24 Piezas).'}
              </p>
            </div>
          )}

          {/* Stock */}
          {editingId ? (
            <FormField
              label={`Stock actual (${(inventoryUnit?.symbol ?? form.unit) || 'unidades'})`}
              type="number"
              value={Number(form.stock).toString()}
              onChange={(v) => setForm((p) => ({ ...p, stock: Number(v) || 0 }))}
            />
          ) : (
            <FormField
              label={`Stock inicial (${(inventoryUnit?.symbol ?? form.unit) || 'unidades'})`}
              type="number"
              value={Number(form.stock).toString()}
              onChange={(v) => setForm((p) => ({ ...p, stock: Number(v) || 0 }))}
            />
          )}

          <FormField
            label={`Stock mínimo (${(inventoryUnit?.symbol ?? form.unit) || 'unidades'})`}
            type="number"
            value={Number(form.minStock).toString()}
            onChange={(v) => setForm((p) => ({ ...p, minStock: Number(v) || 0 }))}
          />
          <FormField
            label={`Costo por ${inventoryUnit?.symbol || 'unidad'}`}
            type="number"
            step={0.01}
            value={Number(form.cost).toString()}
            onChange={(v) => setForm((p) => ({ ...p, cost: Number(v) || 0 }))}
          />
          <div className="mb-3.5">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Estado</label>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
              className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
            >
              <option value="ACTIVE">Activo</option>
              <option value="INACTIVE">Inactivo</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2.5 justify-end pt-2">
          <button
            type="button"
            onClick={handleCloseModal}
            className="px-4 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer"
          >
            Guardar
          </button>
        </div>
      </FormModal>

      {/* Adjust Stock Modal */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold mb-1">Ajustar Stock</h2>
            {adjustingSupply && (() => {
              const convFactor = Number(adjustingSupply.conversionFactor ?? 1) || 1
              const invSymbol = adjustingSupply.inventoryUnit?.symbol ?? adjustingSupply.unit
              const baseSymbol = adjustingSupply.baseUnit?.symbol ?? adjustingSupply.unit
              const rawStock = Number(adjustingSupply.stock)
              const displayStock = adjustingSupply.inventoryUnitId && convFactor !== 1
                ? `${(rawStock / convFactor).toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${invSymbol}  (${rawStock.toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${baseSymbol})`
                : `${rawStock.toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${invSymbol}`
              return (
                <p className="text-sm text-muted-foreground mb-4">
                  {adjustingSupply.name} — Stock actual: <strong>{displayStock}</strong>
                </p>
              )
            })()}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Cantidad (+ agregar / - restar)
                  {adjustingSupply?.inventoryUnit && (
                    <span className="font-normal ml-1 text-[11px]">
                      en {adjustingSupply.inventoryUnit.symbol}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] bg-card outline-none focus:border-primary"
                />
                {adjustingSupply?.inventoryUnitId && Number(adjustingSupply.conversionFactor ?? 1) !== 1 && adjustQty !== 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    = {(adjustQty * (Number(adjustingSupply.conversionFactor) || 1)).toLocaleString('es-MX', { maximumFractionDigits: 3 })} {adjustingSupply.baseUnit?.symbol ?? adjustingSupply.unit} internamente
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Notas (opcional)</label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Motivo del ajuste..."
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] bg-card outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex gap-2.5 justify-end mt-5">
              <button
                type="button"
                onClick={() => setAdjustModalOpen(false)}
                className="px-4 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAdjust}
                disabled={adjustQty === 0}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-50"
              >
                Aplicar ajuste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
