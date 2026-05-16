import { useMemo } from 'react'
import { AvatarInitials } from '@/components/shared/avatar-initials'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import { FormModal, FormField } from '@/components/shared/form-modal'
import { Search, Plus, Loader2 } from 'lucide-react'
import { useClientes } from '@/hooks/core/use-clientes'
import type { Cliente } from '@/hooks/core/use-clientes'

export function Clientes() {
  const {
    loading, error, search, setSearch, statusFilter, setStatusFilter,
    page, setPage, modalOpen, editModalOpen, selected, setSelected, form, setForm,
    editForm, setEditForm, filtered, pageData, stats, saving, handleSave, handleOpenNew,
    handleCloseModal, handleOpenEdit, handleCloseEdit, handleUpdate, handleDelete, loadClientes,
  } = useClientes()

  const columns: Column<Cliente>[] = useMemo(() => [
    {
      label: "Cliente", render: r => (
        <div className="flex items-center gap-2.5">
          <AvatarInitials name={r.nombre} size={32} />
          <div>
            <div className="font-semibold text-[13px] text-foreground">{r.nombre}</div>
            <div className="text-[11px] text-muted-foreground">{r.empresa}</div>
          </div>
        </div>
      )
    },
    { label: "Email", render: r => <span className="text-xs text-muted-foreground">{r.email}</span> },
    { label: "Teléfono", render: r => <span className="text-xs text-muted-foreground">{r.telefono}</span> },
    { label: "Ciudad", render: r => <span className="text-xs text-muted-foreground">{r.ciudad}</span> },
    { label: "Total Compras", align: "right", render: r => <span className="font-bold text-foreground">{r.totalCompras}</span> },
    { label: "Pedidos", align: "center", render: r => <span className="font-semibold text-primary text-sm">{r.pedidos}</span> },
    { label: "Estado", render: r => <StatusBadge status={r.estado} /> },
    { label: "Desde", render: r => <span className="text-xs text-muted-foreground">{r.desde}</span> },
  ], [])

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando clientes...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-red-500">{error}</span>
          <button onClick={loadClientes} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer">
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
          { label: "Total Clientes", value: stats.total, color: "text-primary" },
          { label: "Activos", value: stats.activos, color: "text-green-600" },
          { label: "Inactivos", value: stats.inactivos, color: "text-gray-500" },
          { label: "Valor Total", value: `$${stats.valorTotal.toLocaleString("es-MX")}`, color: "text-violet-600" },
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
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar cliente…"
                className="border-none bg-transparent outline-none text-xs text-foreground w-[160px]" />
            </div>
            <button onClick={handleOpenNew} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground border-none rounded-lg text-xs font-semibold cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Nuevo Cliente
            </button>
          </div>
        </div>
        <DataTable columns={columns} rows={pageData} onRowClick={setSelected} />
        <Pagination page={page} total={filtered.length} perPage={6} onChange={setPage} />
      </div>

      <FormModal open={!!selected} onClose={() => setSelected(null)} title="Detalle del Cliente">
        {selected && (
          <div>
            <div className="flex items-center gap-4 mb-5 p-4 bg-muted rounded-[10px]">
              <AvatarInitials name={selected.nombre} size={52} />
              <div>
                <div className="text-lg font-bold text-foreground">{selected.nombre}</div>
                <div className="text-[13px] text-muted-foreground">{selected.empresa} · {selected.ciudad}</div>
                <div className="mt-1.5"><StatusBadge status={selected.estado} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Email", value: selected.email },
                { label: "Teléfono", value: selected.telefono },
                { label: "Total Compras", value: selected.totalCompras },
                { label: "Pedidos", value: `${selected.pedidos} órdenes` },
                { label: "Cliente desde", value: selected.desde },
                { label: "ID", value: selected.id },
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
                onClick={() => { if (window.confirm('¿Eliminar este cliente?')) handleDelete(selected.id) }}
                className="px-4.5 py-2 bg-red-500 text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer"
              >Eliminar</button>
              <button onClick={() => { handleOpenEdit(selected); setSelected(null) }} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer">Editar Cliente</button>
            </div>
          </div>
        )}
      </FormModal>

      <FormModal open={modalOpen} onClose={handleCloseModal} title="Nuevo Cliente">
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Nombre completo" value={form.nombre} onChange={v => setForm(p => ({ ...p, nombre: v }))} />
          <FormField label="Empresa" value={form.empresa} onChange={v => setForm(p => ({ ...p, empresa: v }))} />
          <FormField label="Email" type="email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} />
          <FormField label="Teléfono" value={form.telefono} onChange={v => setForm(p => ({ ...p, telefono: v }))} />
          <div className="col-span-2">
            <FormField label="Ciudad" value={form.ciudad} onChange={v => setForm(p => ({ ...p, ciudad: v }))} />
          </div>
        </div>
        <div className="col-span-2 border border-border rounded-lg p-3.5 mt-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-bold text-foreground uppercase tracking-wide">Crédito</span>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, hasCredit: !p.hasCredit, creditDays: '', creditLimit: '' }))}
              className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full transition-colors ${form.hasCredit ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${form.hasCredit ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {form.hasCredit && (
            <div className="grid grid-cols-2 gap-x-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Días de crédito <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" min="1" placeholder="30"
                  value={form.creditDays}
                  onChange={e => setForm(p => ({ ...p, creditDays: e.target.value }))}
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Límite de crédito <span className="text-muted-foreground/60">(opcional)</span>
                </label>
                <input
                  type="number" min="0" step="0.01" placeholder="Sin límite"
                  value={form.creditLimit}
                  onChange={e => setForm(p => ({ ...p, creditLimit: e.target.value }))}
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2.5 justify-end mt-2">
          <button onClick={handleCloseModal} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar Cliente'}
          </button>
        </div>
      </FormModal>

      <FormModal open={editModalOpen} onClose={handleCloseEdit} title="Editar Cliente">
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Nombre completo" value={editForm.nombre} onChange={v => setEditForm(p => ({ ...p, nombre: v }))} />
          <FormField label="Empresa" value={editForm.empresa} onChange={v => setEditForm(p => ({ ...p, empresa: v }))} />
          <FormField label="Email" type="email" value={editForm.email} onChange={v => setEditForm(p => ({ ...p, email: v }))} />
          <FormField label="Teléfono" value={editForm.telefono} onChange={v => setEditForm(p => ({ ...p, telefono: v }))} />
          <div className="col-span-2">
            <FormField label="Ciudad" value={editForm.ciudad} onChange={v => setEditForm(p => ({ ...p, ciudad: v }))} />
          </div>
        </div>
        <div className="col-span-2 border border-border rounded-lg p-3.5 mt-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-bold text-foreground uppercase tracking-wide">Crédito</span>
            <button
              type="button"
              onClick={() => setEditForm(p => ({ ...p, hasCredit: !p.hasCredit, creditDays: '', creditLimit: '' }))}
              className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full transition-colors ${editForm.hasCredit ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${editForm.hasCredit ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {editForm.hasCredit && (
            <div className="grid grid-cols-2 gap-x-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Días de crédito <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" min="1" placeholder="30"
                  value={editForm.creditDays}
                  onChange={e => setEditForm(p => ({ ...p, creditDays: e.target.value }))}
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Límite de crédito <span className="text-muted-foreground/60">(opcional)</span>
                </label>
                <input
                  type="number" min="0" step="0.01" placeholder="Sin límite"
                  value={editForm.creditLimit}
                  onChange={e => setEditForm(p => ({ ...p, creditLimit: e.target.value }))}
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                />
              </div>
            </div>
          )}
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
