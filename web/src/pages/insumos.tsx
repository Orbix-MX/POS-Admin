import { useMemo } from 'react'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import { FormModal, FormField } from '@/components/shared/form-modal'
import { Search, Plus, Pencil, Trash2, Loader2, Package, AlertTriangle, TrendingDown, ArrowUpDown } from 'lucide-react'
import { useSupplies, SUPPLY_UNITS } from '@/hooks/retail/use-supplies'
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

export function Insumos() {
  const {
    loading, error, search, setSearch, page, setPage,
    filtered, pageData, stats, perPage,
    modalOpen, editingId, form, setForm,
    handleOpenNew, handleEdit, handleCloseModal, handleSave, handleDelete,
    adjustModalOpen, setAdjustModalOpen, adjustingId, adjustQty, setAdjustQty,
    adjustNotes, setAdjustNotes, handleOpenAdjust, handleAdjust,
    supplies, loadSupplies,
  } = useSupplies()

  const adjustingSupply = supplies.find((s) => s.id === adjustingId)

  const columns: Column<Supply>[] = useMemo(() => [
    {
      label: 'SKU',
      render: (r) => <span className="font-mono text-[11px] text-muted-foreground font-semibold">{r.sku}</span>,
    },
    {
      label: 'Insumo',
      render: (r) => (
        <div>
          <div className="font-semibold text-[13px]">{r.name}</div>
          <div className="text-[11px] text-muted-foreground">{r.unit}</div>
        </div>
      ),
    },
    {
      label: 'Stock',
      render: (r) => <StockBadge stock={Number(r.stock)} minStock={Number(r.minStock)} />,
    },
    {
      label: 'Mín.',
      render: (r) => <span className="text-[12px] text-muted-foreground">{Number(r.minStock).toLocaleString('es-MX', { maximumFractionDigits: 3 })} {r.unit}</span>,
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
          <div className="col-span-2">
            <FormField label="Nombre" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
          </div>
          {!editingId && (
            <FormField label="SKU" value={form.sku} onChange={(v) => setForm((p) => ({ ...p, sku: v }))} />
          )}
          <div className="mb-3.5">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Unidad de medida</label>
            <Select value={form.unit} onValueChange={(v) => setForm((p) => ({ ...p, unit: v ?? p.unit }))}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Selecciona unidad" />
              </SelectTrigger>
              <SelectContent>
                {SUPPLY_UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {editingId && (
            <FormField
              label="Stock actual"
              type="number"
              value={Number(form.stock).toString()}
              onChange={(v) => setForm((p) => ({ ...p, stock: Number(v) || 0 }))}
            />
          )}
          {!editingId && (
            <FormField
              label="Stock inicial"
              type="number"
              value={Number(form.stock).toString()}
              onChange={(v) => setForm((p) => ({ ...p, stock: Number(v) || 0 }))}
            />
          )}
          <FormField
            label="Stock mínimo"
            type="number"
            value={Number(form.minStock).toString()}
            onChange={(v) => setForm((p) => ({ ...p, minStock: Number(v) || 0 }))}
          />
          <FormField
            label="Costo unitario"
            type="number"
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
            {adjustingSupply && (
              <p className="text-sm text-muted-foreground mb-4">
                {adjustingSupply.name} — Stock actual:{' '}
                <strong>{Number(adjustingSupply.stock).toLocaleString('es-MX', { maximumFractionDigits: 3 })} {adjustingSupply.unit}</strong>
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Cantidad (+ agregar / - restar)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] bg-card outline-none focus:border-primary"
                />
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
