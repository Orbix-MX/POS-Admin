import { useMemo, useState } from 'react'
import { AvatarInitials } from '@/components/shared/avatar-initials'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import { FormModal, FormField } from '@/components/shared/form-modal'
import { Search, Plus, Loader2, KeyRound } from 'lucide-react'
import { useEmpleados } from '@/hooks/core/use-empleados'
import type { Empleado } from '@/hooks/core/use-empleados'
import { EmployeePinModal } from '@/components/empleados/employee-pin-modal'

const CONTRACT_OPTIONS = [
  { value: 'FULL_TIME',  label: 'Tiempo completo' },
  { value: 'PART_TIME',  label: 'Medio tiempo' },
  { value: 'CONTRACTOR', label: 'Contratista' },
  { value: 'TEMPORARY',  label: 'Temporal' },
]

const STATUS_OPTIONS = [
  { value: 'ACTIVE',    label: 'Activo' },
  { value: 'INACTIVE',  label: 'Inactivo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'ON_LEAVE',  label: 'En permiso' },
]

const SELECT_CLS = 'w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary'

export function Empleados() {
  const {
    loading, error, search, setSearch, statusFilter, setStatusFilter,
    departmentFilter, setDepartmentFilter, departments,
    page, setPage, modalOpen, editModalOpen, selected, setSelected,
    form, setForm, editForm, setEditForm,
    filtered, pageData, stats, saving,
    formErrors, editErrors, apiError,
    handleSave, handleOpenNew, handleCloseModal,
    handleOpenEdit, handleCloseEdit, handleUpdate, handleDelete,
    loadEmpleados,
  } = useEmpleados()

  const [pinEmployee, setPinEmployee] = useState<Empleado | null>(null)

  const columns: Column<Empleado>[] = useMemo(() => [
    {
      label: 'Empleado', render: r => (
        <div className="flex items-center gap-2.5">
          <AvatarInitials name={r.nombre} size={32} />
          <div>
            <div className="font-semibold text-[13px] text-foreground">{r.nombre}</div>
            <div className="text-[11px] text-muted-foreground">#{r.numEmpleado}</div>
          </div>
        </div>
      ),
    },
    { label: 'Departamento', render: r => <span className="text-xs bg-muted px-2 py-1 rounded font-medium text-muted-foreground">{r.departamento || '—'}</span> },
    { label: 'Puesto', render: r => <span className="text-xs text-foreground font-medium">{r.puesto || '—'}</span> },
    { label: 'Contrato', render: r => <span className="text-xs text-muted-foreground">{r.tipoContrato}</span> },
    { label: 'Ingreso', render: r => <span className="text-xs text-muted-foreground">{r.fechaIngreso}</span> },
    { label: 'Salario', align: 'right', render: r => <span className="font-bold text-foreground">{r.salario}</span> },
    { label: 'Estado', render: r => <StatusBadge status={r.estado} /> },
  ], [])

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando empleados...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-red-500">{error}</span>
          <button onClick={loadEmpleados} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Stats */}
      <div className="flex gap-3.5">
        {[
          { label: 'Total Empleados',  value: stats.total,    color: 'text-primary' },
          { label: 'Activos',          value: stats.activos,  color: 'text-green-600' },
          { label: 'Inactivos',        value: stats.inactivos + stats.enPermiso, color: 'text-gray-500' },
          { label: 'Nómina Mensual',   value: `$${stats.nomina.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, color: 'text-violet-600' },
        ].map((s, i) => (
          <div key={i} className="flex-1 bg-card border border-border rounded-[10px] px-4.5 py-3.5">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{s.label}</div>
            <div className={`font-extrabold tracking-tight ${s.color} ${typeof s.value === 'string' && s.value.length > 8 ? 'text-lg' : 'text-[26px]'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {['Todos', 'Activo', 'Inactivo', 'Suspendido', 'En permiso'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`px-3 py-1.5 border rounded-md text-xs cursor-pointer font-medium ${statusFilter === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'}`}>
                {s}
              </button>
            ))}
            {departments.length > 1 && (
              <select value={departmentFilter} onChange={e => { setDepartmentFilter(e.target.value); setPage(1) }}
                className="px-2.5 py-1.5 border border-border rounded-md text-xs bg-card text-muted-foreground outline-none cursor-pointer">
                {departments.map(d => <option key={d} value={d}>{d === 'Todos' ? 'Todos los departamentos' : d}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-2.5 items-center">
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar empleado…"
                className="border-none bg-transparent outline-none text-xs text-foreground w-[160px]" />
            </div>
            <button onClick={handleOpenNew} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground border-none rounded-lg text-xs font-semibold cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Alta de Empleado
            </button>
          </div>
        </div>
        <DataTable columns={columns} rows={pageData} onRowClick={setSelected} />
        <Pagination page={page} total={filtered.length} perPage={8} onChange={setPage} />
      </div>

      {/* Detail modal */}
      <FormModal open={!!selected} onClose={() => setSelected(null)} title="Detalle del Empleado">
        {selected && (
          <div>
            <div className="flex items-center gap-4 mb-5 p-4 bg-muted rounded-[10px]">
              <AvatarInitials name={selected.nombre} size={52} />
              <div>
                <div className="text-lg font-bold text-foreground">{selected.nombre}</div>
                <div className="text-[13px] text-muted-foreground">{selected.puesto}{selected.departamento ? ` · ${selected.departamento}` : ''}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusBadge status={selected.estado} />
                  <span className="text-[11px] text-muted-foreground">#{selected.numEmpleado}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Email',        value: selected.email },
                { label: 'Teléfono',     value: selected.telefono || '—' },
                { label: 'Tipo contrato', value: selected.tipoContrato },
                { label: 'Fecha ingreso', value: selected.fechaIngreso },
                { label: 'Salario',      value: selected.salario },
                { label: 'RFC',          value: selected.rfc || '—' },
                { label: 'CURP',         value: selected.curp || '—' },
                { label: 'Acceso comandera', value: selected.hasPin ? 'PIN asignado ✓' : 'Sin PIN' },
                { label: 'Notas',        value: selected.notes || '—' },
              ].map((f, i) => (
                <div key={i} className="bg-muted rounded-lg p-3">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{f.label}</div>
                  <div className="text-[13px] font-semibold text-foreground">{f.value}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2.5 justify-end flex-wrap">
              <button onClick={() => setSelected(null)} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cerrar</button>
              <button
                onClick={() => { if (window.confirm('¿Dar de baja a este empleado?')) handleDelete(selected.id) }}
                className="px-4.5 py-2 bg-red-500 text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer"
              >Dar de baja</button>
              <button
                onClick={() => { setPinEmployee(selected); setSelected(null) }}
                className="flex items-center gap-1.5 px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] font-semibold cursor-pointer text-foreground hover:border-primary/50"
              ><KeyRound className="w-3.5 h-3.5" /> PIN comandera</button>
              <button
                onClick={() => handleOpenEdit(selected)}
                className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer"
              >Editar</button>
            </div>
          </div>
        )}
      </FormModal>

      {/* New employee modal */}
      <FormModal open={modalOpen} onClose={handleCloseModal} title="Alta de Empleado">
        {apiError && (
          <div className="sticky top-0 z-10 mb-4 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 rounded-lg flex items-start gap-2">
            <span className="text-red-500 font-bold text-sm mt-px">!</span>
            <span className="text-[12px] text-red-600 dark:text-red-400 leading-snug">{apiError}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Núm. Empleado *" value={form.employeeNumber} onChange={v => setForm(p => ({ ...p, employeeNumber: v }))} error={formErrors.employeeNumber} />
          <FormField label="Fecha de Ingreso" type="date" value={form.hireDate} onChange={v => setForm(p => ({ ...p, hireDate: v }))} />
          <FormField label="Nombre(s) *" value={form.firstName} onChange={v => setForm(p => ({ ...p, firstName: v }))} error={formErrors.firstName} />
          <FormField label="Apellidos *" value={form.lastName} onChange={v => setForm(p => ({ ...p, lastName: v }))} error={formErrors.lastName} />
          <FormField label="Email *" type="email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} error={formErrors.email} />
          <FormField label="Teléfono" value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} />
          <FormField label="Departamento" value={form.department} onChange={v => setForm(p => ({ ...p, department: v }))} />
          <FormField label="Puesto" value={form.position} onChange={v => setForm(p => ({ ...p, position: v }))} />
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tipo de Contrato</label>
            <select value={form.contractType} onChange={e => setForm(p => ({ ...p, contractType: e.target.value as typeof form.contractType }))} className={SELECT_CLS}>
              {CONTRACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <FormField label="Salario Mensual" type="number" value={form.salary} onChange={v => setForm(p => ({ ...p, salary: v }))} error={formErrors.salary} />
          <FormField label="RFC" value={form.rfc} onChange={v => setForm(p => ({ ...p, rfc: v }))} />
          <FormField label="CURP" value={form.curp} onChange={v => setForm(p => ({ ...p, curp: v }))} />
          <FormField label="Fecha de Nacimiento" type="date" value={form.birthDate} onChange={v => setForm(p => ({ ...p, birthDate: v }))} />
          <div className="col-span-2">
            <FormField label="Notas" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} />
          </div>
        </div>
        <div className="flex gap-2.5 justify-end mt-2">
          <button onClick={handleCloseModal} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60">
            {saving ? 'Guardando…' : 'Dar de Alta'}
          </button>
        </div>
      </FormModal>

      {/* Edit modal */}
      <FormModal open={editModalOpen} onClose={handleCloseEdit} title="Editar Empleado">
        {apiError && (
          <div className="sticky top-0 z-10 mb-4 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 rounded-lg flex items-start gap-2">
            <span className="text-red-500 font-bold text-sm mt-px">!</span>
            <span className="text-[12px] text-red-600 dark:text-red-400 leading-snug">{apiError}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Núm. Empleado *" value={editForm.employeeNumber} onChange={v => setEditForm(p => ({ ...p, employeeNumber: v }))} error={editErrors.employeeNumber} />
          <FormField label="Fecha de Ingreso" type="date" value={editForm.hireDate} onChange={v => setEditForm(p => ({ ...p, hireDate: v }))} />
          <FormField label="Nombre(s) *" value={editForm.firstName} onChange={v => setEditForm(p => ({ ...p, firstName: v }))} error={editErrors.firstName} />
          <FormField label="Apellidos *" value={editForm.lastName} onChange={v => setEditForm(p => ({ ...p, lastName: v }))} error={editErrors.lastName} />
          <FormField label="Email *" type="email" value={editForm.email} onChange={v => setEditForm(p => ({ ...p, email: v }))} error={editErrors.email} />
          <FormField label="Teléfono" value={editForm.phone} onChange={v => setEditForm(p => ({ ...p, phone: v }))} />
          <FormField label="Departamento" value={editForm.department} onChange={v => setEditForm(p => ({ ...p, department: v }))} />
          <FormField label="Puesto" value={editForm.position} onChange={v => setEditForm(p => ({ ...p, position: v }))} />
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tipo de Contrato</label>
            <select value={editForm.contractType} onChange={e => setEditForm(p => ({ ...p, contractType: e.target.value as typeof editForm.contractType }))} className={SELECT_CLS}>
              {CONTRACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Estado</label>
            <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as typeof editForm.status }))} className={SELECT_CLS}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <FormField label="Salario Mensual" type="number" value={editForm.salary} onChange={v => setEditForm(p => ({ ...p, salary: v }))} error={editErrors.salary} />
          <FormField label="RFC" value={editForm.rfc} onChange={v => setEditForm(p => ({ ...p, rfc: v }))} />
          <FormField label="CURP" value={editForm.curp} onChange={v => setEditForm(p => ({ ...p, curp: v }))} />
          <FormField label="Fecha de Nacimiento" type="date" value={editForm.birthDate ?? ''} onChange={v => setEditForm(p => ({ ...p, birthDate: v }))} />
          <div className="col-span-2">
            <FormField label="Notas" value={editForm.notes} onChange={v => setEditForm(p => ({ ...p, notes: v }))} />
          </div>
        </div>
        <div className="flex gap-2.5 justify-end mt-2">
          <button onClick={handleCloseEdit} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cancelar</button>
          <button onClick={handleUpdate} disabled={saving} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar Cambios'}
          </button>
        </div>
      </FormModal>

      {/* PIN de comandera */}
      {pinEmployee && (
        <EmployeePinModal
          empleado={pinEmployee}
          onClose={() => setPinEmployee(null)}
          onSaved={async () => { await loadEmpleados(); setPinEmployee(null) }}
        />
      )}
    </div>
  )
}
