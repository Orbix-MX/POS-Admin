import { useMemo } from 'react'
import { AvatarInitials } from '@/components/shared/avatar-initials'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import { FormModal, FormField } from '@/components/shared/form-modal'
import { Search, Plus, Loader2 } from 'lucide-react'
import { useUsuarios } from '@/hooks/core/use-usuarios'
import type { Usuario } from '@/hooks/core/use-usuarios'
import { useRoles } from '@/hooks/core/use-roles'

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
]

const SELECT_CLASS = "w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"

export function Usuarios() {
  const { roles } = useRoles()

  const {
    loading, error, search, setSearch, rolFilter, setRolFilter,
    page, setPage, modalOpen, editModalOpen, selected, setSelected,
    form, setForm, editForm, setEditForm,
    filtered, pageData, stats, saving,
    handleSave, handleOpenNew, handleCloseModal,
    handleOpenEdit, handleCloseEdit, handleUpdate, handleDelete, loadUsuarios,
  } = useUsuarios()

  const columns: Column<Usuario>[] = useMemo(() => [
    {
      label: "Usuario", render: r => (
        <div className="flex items-center gap-2.5">
          <AvatarInitials name={r.nombre} size={32} />
          <div>
            <div className="font-semibold text-[13px] text-foreground">{r.nombre}</div>
            <div className="text-[11px] text-muted-foreground">{r.email}</div>
          </div>
        </div>
      )
    },
    {
      label: "Rol", render: r => (
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {r.rol}
        </span>
      )
    },
    { label: "Estado", render: r => <StatusBadge status={r.estado} /> },
    { label: "Desde", render: r => <span className="text-xs text-muted-foreground">{r.desde}</span> },
  ], [])

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando usuarios...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-red-500">{error}</span>
          <button onClick={loadUsuarios} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer">
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
          { label: "Total Usuarios", value: stats.total, color: "text-primary" },
          { label: "Activos", value: stats.activos, color: "text-green-600" },
          { label: "Inactivos", value: stats.inactivos, color: "text-gray-500" },
          { label: "Administradores", value: stats.admins, color: "text-violet-600" },
        ].map((s, i) => (
          <div key={i} className="flex-1 bg-card border border-border rounded-[10px] px-4.5 py-3.5">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{s.label}</div>
            <div className={`text-[26px] font-extrabold tracking-tight ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border gap-3">
          <div className="flex gap-1.5">
            {["Todos", "Administrador", "Gerente", "Personal"].map(r => (
              <button key={r} onClick={() => { setRolFilter(r); setPage(1) }}
                className={`px-3 py-1.5 border rounded-md text-xs cursor-pointer font-medium ${rolFilter === r ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'}`}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-2.5 items-center">
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar usuario…"
                className="border-none bg-transparent outline-none text-xs text-foreground w-[160px]" />
            </div>
            <button onClick={handleOpenNew} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground border-none rounded-lg text-xs font-semibold cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Nuevo Usuario
            </button>
          </div>
        </div>
        <DataTable columns={columns} rows={pageData} onRowClick={setSelected} />
        <Pagination page={page} total={filtered.length} perPage={8} onChange={setPage} />
      </div>

      {/* Modal detalle */}
      <FormModal open={!!selected} onClose={() => setSelected(null)} title="Detalle del Usuario">
        {selected && (
          <div>
            <div className="flex items-center gap-4 mb-5 p-4 bg-muted rounded-[10px]">
              <AvatarInitials name={selected.nombre} size={52} />
              <div>
                <div className="text-lg font-bold text-foreground">{selected.nombre}</div>
                <div className="text-[13px] text-muted-foreground">{selected.email}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {selected.rol}
                  </span>
                  <StatusBadge status={selected.estado} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Email", value: selected.email },
                { label: "Rol", value: selected.rol },
                { label: "Estado", value: selected.estado },
                { label: "Usuario desde", value: selected.desde },
                { label: "Nombre", value: selected.firstName },
                { label: "Apellido", value: selected.lastName },
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
                onClick={() => { if (window.confirm('¿Eliminar este usuario?')) handleDelete(selected.id) }}
                className="px-4.5 py-2 bg-red-500 text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer"
              >Eliminar</button>
              <button onClick={() => handleOpenEdit(selected)} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer">Editar Usuario</button>
            </div>
          </div>
        )}
      </FormModal>

      {/* Modal crear */}
      <FormModal open={modalOpen} onClose={handleCloseModal} title="Nuevo Usuario">
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Nombre" value={form.firstName} onChange={v => setForm(p => ({ ...p, firstName: v }))} />
          <FormField label="Apellido" value={form.lastName} onChange={v => setForm(p => ({ ...p, lastName: v }))} />
          <FormField label="Email" type="email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} />
          <FormField label="Contraseña" type="password" value={form.password} onChange={v => setForm(p => ({ ...p, password: v }))} />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Rol</label>
            <select
              value={form.roleId}
              onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))}
              className={SELECT_CLASS}
            >
              <option value="">Sin rol asignado</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Estado</label>
            <select
              value={form.status}
              onChange={e => setForm(p => ({ ...p, status: e.target.value as typeof form.status }))}
              className={SELECT_CLASS}
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2.5 justify-end mt-2">
          <button onClick={handleCloseModal} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar Usuario'}
          </button>
        </div>
      </FormModal>

      {/* Modal editar */}
      <FormModal open={editModalOpen} onClose={handleCloseEdit} title="Editar Usuario">
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Nombre" value={editForm.firstName} onChange={v => setEditForm(p => ({ ...p, firstName: v }))} />
          <FormField label="Apellido" value={editForm.lastName} onChange={v => setEditForm(p => ({ ...p, lastName: v }))} />
          <div className="col-span-2">
            <FormField label="Email" type="email" value={editForm.email} onChange={v => setEditForm(p => ({ ...p, email: v }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Rol</label>
            <select
              value={editForm.roleId}
              onChange={e => setEditForm(p => ({ ...p, roleId: e.target.value }))}
              className={SELECT_CLASS}
            >
              <option value="">Sin rol asignado</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Estado</label>
            <select
              value={editForm.status}
              onChange={e => setEditForm(p => ({ ...p, status: e.target.value as typeof editForm.status }))}
              className={SELECT_CLASS}
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
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
