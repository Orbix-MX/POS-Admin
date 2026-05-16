import { useMemo } from 'react'
import { AvatarInitials } from '@/components/shared/avatar-initials'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import { FormModal, FormField } from '@/components/shared/form-modal'
import { Search, Plus, Loader2 } from 'lucide-react'
import { useProveedores } from '@/hooks/retail/use-proveedores'
import type { Proveedor } from '@/hooks/retail/use-proveedores'
import { useCategories } from '@/hooks/retail/use-categories'

export function Proveedores() {
  const {
    loading, error, search, setSearch, statusFilter, setStatusFilter,
    page, setPage, modalOpen, editModalOpen, selected, setSelected,
    form, setForm, editForm, setEditForm,
    filtered, pageData, stats, saving,
    handleSave, handleOpenNew, handleCloseModal,
    handleOpenEdit, handleCloseEdit, handleUpdate, handleDelete,
    loadProveedores,
  } = useProveedores()

  const { categories } = useCategories()

  const columns: Column<Proveedor>[] = useMemo(() => [
    {
      label: "Proveedor", render: r => (
        <div className="flex items-center gap-2.5">
          <AvatarInitials name={r.nombre} size={32} />
          <div>
            <div className="font-semibold text-[13px] text-foreground">{r.nombre}</div>
            <div className="text-[11px] text-muted-foreground">{r.contacto}</div>
          </div>
        </div>
      )
    },
    { label: "Categoría", render: r => <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-medium">{r.categoria}</span> },
    { label: "Email", render: r => <span className="text-xs text-muted-foreground">{r.email}</span> },
    { label: "Ciudad", render: r => <span className="text-xs text-muted-foreground">{r.ciudad}</span> },
    { label: "Total Compras", align: "right", render: r => <span className="font-bold text-foreground">{r.comprasTotal}</span> },
    { label: "Órdenes", align: "center", render: r => <span className="font-semibold text-primary text-sm">{r.ordenes}</span> },
    { label: "Plazo", render: r => <span className="text-xs text-muted-foreground">{r.plazo}</span> },
    { label: "Estado", render: r => <StatusBadge status={r.estado} /> },
  ], [])

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando proveedores...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-red-500">{error}</span>
          <button onClick={loadProveedores} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-7 flex flex-col gap-5">
      <div className="flex gap-3.5">
        {[
          { label: "Total Proveedores", value: stats.total, color: "text-primary" },
          { label: "Activos", value: stats.activos, color: "text-green-600" },
          { label: "Inactivos", value: stats.inactivos, color: "text-gray-500" },
          { label: "Gasto Total", value: `$${stats.gastoTotal.toLocaleString("es-MX")}`, color: "text-violet-600" },
        ].map((s, i) => (
          <div key={i} className="flex-1 bg-card border border-border rounded-[10px] px-4.5 py-3.5">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{s.label}</div>
            <div className={`font-extrabold tracking-tight ${s.color} ${typeof s.value === 'string' && s.value.length > 8 ? 'text-lg' : 'text-[26px]'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border gap-3">
          <div className="flex gap-1.5">
            {["Todos", "Activo", "Inactivo"].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`px-3 py-1.5 border rounded-md text-xs cursor-pointer font-medium ${statusFilter === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2.5 items-center">
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar proveedor…"
                className="border-none bg-transparent outline-none text-xs text-foreground w-[160px]" />
            </div>
            <button onClick={handleOpenNew} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground border-none rounded-lg text-xs font-semibold cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Nuevo Proveedor
            </button>
          </div>
        </div>
        <DataTable columns={columns} rows={pageData} onRowClick={setSelected} />
        <Pagination page={page} total={filtered.length} perPage={6} onChange={setPage} />
      </div>

      <FormModal open={!!selected} onClose={() => setSelected(null)} title="Detalle del Proveedor">
        {selected && (
          <div>
            <div className="flex items-center gap-4 mb-5 p-4 bg-muted rounded-[10px]">
              <AvatarInitials name={selected.nombre} size={52} />
              <div>
                <div className="text-lg font-bold text-foreground">{selected.nombre}</div>
                <div className="text-[13px] text-muted-foreground">{selected.categoria} · {selected.ciudad}</div>
                <div className="mt-1.5"><StatusBadge status={selected.estado} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Contacto", value: selected.contacto },
                { label: "Email", value: selected.email },
                { label: "Teléfono", value: selected.telefono },
                { label: "Plazo de Pago", value: selected.plazo },
                { label: "Total Compras", value: selected.comprasTotal },
                { label: "Órdenes", value: `${selected.ordenes} órdenes` },
              ].map((f, i) => (
                <div key={i} className="bg-muted rounded-lg p-3">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{f.label}</div>
                  <div className="text-[13px] font-semibold text-foreground">{f.value}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2.5 justify-end">
              <button onClick={() => setSelected(null)} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cerrar</button>
              <button
                onClick={() => { if (window.confirm('¿Eliminar este proveedor?')) handleDelete(selected.id) }}
                className="px-4.5 py-2 bg-red-500 text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer"
              >Eliminar</button>
              <button
                onClick={() => handleOpenEdit(selected)}
                className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer"
              >Editar Proveedor</button>
            </div>
          </div>
        )}
      </FormModal>

      <FormModal open={modalOpen} onClose={handleCloseModal} title="Nuevo Proveedor">
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Nombre empresa" value={form.nombre} onChange={v => setForm(p => ({ ...p, nombre: v }))} />
          <FormField label="Contacto" value={form.contacto} onChange={v => setForm(p => ({ ...p, contacto: v }))} />
          <FormField label="Email" type="email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} />
          <FormField label="Teléfono" value={form.telefono} onChange={v => setForm(p => ({ ...p, telefono: v }))} />
          <FormField label="Ciudad" value={form.ciudad} onChange={v => setForm(p => ({ ...p, ciudad: v }))} />
          <FormField label="Plazo de Pago" value={form.plazo} onChange={v => setForm(p => ({ ...p, plazo: v }))} options={["15 días", "30 días", "45 días", "60 días", "90 días"]} />
          <div className="col-span-2">
            <FormField label="Categoría" value={form.categoria} onChange={v => setForm(p => ({ ...p, categoria: v }))} options={categories.map(c => c.name)} />
          </div>
        </div>
        <div className="flex gap-2.5 justify-end mt-2">
          <button onClick={handleCloseModal} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar Proveedor'}
          </button>
        </div>
      </FormModal>

      <FormModal open={editModalOpen} onClose={handleCloseEdit} title="Editar Proveedor">
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Nombre empresa" value={editForm.nombre} onChange={v => setEditForm(p => ({ ...p, nombre: v }))} />
          <FormField label="Contacto" value={editForm.contacto} onChange={v => setEditForm(p => ({ ...p, contacto: v }))} />
          <FormField label="Email" type="email" value={editForm.email} onChange={v => setEditForm(p => ({ ...p, email: v }))} />
          <FormField label="Teléfono" value={editForm.telefono} onChange={v => setEditForm(p => ({ ...p, telefono: v }))} />
          <FormField label="Ciudad" value={editForm.ciudad} onChange={v => setEditForm(p => ({ ...p, ciudad: v }))} />
          <FormField label="Plazo de Pago" value={editForm.plazo} onChange={v => setEditForm(p => ({ ...p, plazo: v }))} options={["15 días", "30 días", "45 días", "60 días", "90 días"]} />
          <div className="col-span-2">
            <FormField label="Categoría" value={editForm.categoria} onChange={v => setEditForm(p => ({ ...p, categoria: v }))} options={categories.map(c => c.name)} />
          </div>
        </div>
        <div className="flex gap-2.5 justify-end mt-2">
          <button onClick={handleCloseEdit} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cancelar</button>
          <button onClick={handleUpdate} disabled={saving} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar Cambios'}
          </button>
        </div>
      </FormModal>
    </div>
  )
}
