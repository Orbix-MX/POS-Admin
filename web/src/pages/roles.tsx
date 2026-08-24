import { useMemo, useState, useEffect } from 'react'
import { DataTable, Pagination, type Column } from '@/components/shared/data-table'
import { FormModal, FormField } from '@/components/shared/form-modal'
import { Search, Plus, Loader2, LayoutTemplate, X, Check } from 'lucide-react'
import { useRoles } from '@/hooks/core/use-roles'
import type { Rol, Permiso } from '@/hooks/core/use-roles'
import { fetchRoleTemplates, applyRoleTemplate, type RoleTemplate } from '@/services/core/roles-service'

function PlantillasModal({ onClose, onApplied }: { onClose: () => void; onApplied: () => Promise<void> }) {
  const [templates, setTemplates] = useState<RoleTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [applyingKey, setApplyingKey] = useState<string | null>(null)
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRoleTemplates()
      .then(setTemplates)
      .catch(() => setError('No se pudieron cargar las plantillas'))
      .finally(() => setLoading(false))
  }, [])

  async function handleApply(key: string) {
    setApplyingKey(key); setError(null)
    try {
      await applyRoleTemplate(key)
      setAppliedKeys(prev => new Set(prev).add(key))
      await onApplied()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setError(err?.response?.data?.message ?? 'No se pudo aplicar la plantilla')
    } finally { setApplyingKey(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-primary" /> Plantillas de rol
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="px-5 py-4 max-h-[400px] overflow-y-auto">
          <p className="text-[12px] text-muted-foreground mb-3">
            Roles típicos para el giro de tu empresa, listos para usar. Puedes editarlos o borrarlos después.
          </p>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-[13px]">
              No hay plantillas para el giro de tu empresa todavía.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {templates.map(t => {
                const applied = appliedKeys.has(t.key)
                return (
                  <div key={t.key} className="flex items-center gap-3 px-3.5 py-3 border border-border rounded-xl">
                    <span style={{ background: t.color }} className="w-3 h-3 rounded-full inline-block shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-foreground">{t.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{t.description}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{t.permissionCount} permisos</div>
                    </div>
                    <button
                      onClick={() => handleApply(t.key)}
                      disabled={applyingKey === t.key || applied}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[12px] font-semibold hover:opacity-90 disabled:opacity-60 cursor-pointer shrink-0"
                    >
                      {applyingKey === t.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : applied ? <><Check className="w-3.5 h-3.5" /> Aplicada</>
                        : 'Aplicar'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {error && <div className="mt-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>
      </div>
    </div>
  )
}

export function Roles() {
  const {
    loading, error, search, setSearch,
    page, setPage, modalOpen, editModalOpen, selected, setSelected,
    form, setForm, editForm, setEditForm,
    filtered, pageData, saving, togglePerm, permisos,
    handleSave, handleOpenNew, handleCloseModal,
    handleOpenEdit, handleCloseEdit, handleUpdate, handleDelete, loadAll,
  } = useRoles()

  const [showPlantillas, setShowPlantillas] = useState(false)

  // js-combine-iterations: single pass
  const stats = useMemo(() => {
    let sistema = 0, custom = 0
    for (const r of filtered) {
      if (r.isSystem) sistema++
      else custom++
    }
    return { total: filtered.length, sistema, custom }
  }, [filtered])

  const byModule = useMemo(() =>
    permisos.reduce<Record<string, Permiso[]>>((acc, p) => {
      ;(acc[p.module] ??= []).push(p)
      return acc
    }, {}),
  [permisos])

  const columns: Column<Rol>[] = useMemo(() => [
    {
      label: "Nombre", render: r => (
        <div className="flex items-center gap-2">
          <span style={{ background: r.color ?? '#6366f1' }} className="w-3 h-3 rounded-full inline-block shrink-0" />
          <span className="font-semibold text-[13px] text-foreground">{r.name}</span>
        </div>
      )
    },
    {
      label: "Descripción", render: r => (
        <span className="text-xs text-muted-foreground">{r.description ?? '—'}</span>
      )
    },
    {
      label: "Permisos", align: "center", render: r => (
        <span className="font-semibold text-primary text-sm">{r.permissionsCount}</span>
      )
    },
    {
      label: "Usuarios", align: "center", render: r => (
        <span className="font-semibold text-foreground text-sm">{r.usersCount}</span>
      )
    },
    {
      label: "Tipo", render: r => (
        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${r.isSystem ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>
          {r.isSystem ? 'Sistema' : 'Custom'}
        </span>
      )
    },
  ], [])

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando roles...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-7 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-red-500">{error}</span>
          <button onClick={loadAll} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer">
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
          { label: "Total Roles", value: stats.total, color: "text-primary" },
          { label: "Roles Sistema", value: stats.sistema, color: "text-amber-600" },
          { label: "Roles Custom", value: stats.custom, color: "text-green-600" },
        ].map((s, i) => (
          <div key={i} className="flex-1 bg-card border border-border rounded-[10px] px-4.5 py-3.5">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{s.label}</div>
            <div className={`text-[26px] font-extrabold tracking-tight ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border gap-3">
          <div className="flex gap-2.5 items-center">
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar rol…"
                className="border-none bg-transparent outline-none text-xs text-foreground w-[180px]" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowPlantillas(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border rounded-lg bg-card text-xs font-semibold text-foreground hover:bg-muted/50 cursor-pointer">
              <LayoutTemplate className="w-3.5 h-3.5" /> Plantillas
            </button>
            <button onClick={handleOpenNew} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground border-none rounded-lg text-xs font-semibold cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Nuevo Rol
            </button>
          </div>
        </div>
        <DataTable columns={columns} rows={pageData} onRowClick={setSelected} />
        <Pagination page={page} total={filtered.length} perPage={8} onChange={setPage} />
      </div>

      {/* Modal detalle */}
      <FormModal open={!!selected} onClose={() => setSelected(null)} title="Detalle del Rol">
        {selected && (
          <div>
            <div className="flex items-center gap-4 mb-5 p-4 bg-muted rounded-[10px]">
              <span style={{ background: selected.color ?? '#6366f1' }} className="w-10 h-10 rounded-full inline-block shrink-0" />
              <div>
                <div className="text-lg font-bold text-foreground">{selected.name}</div>
                <div className="text-[13px] text-muted-foreground">{selected.description ?? 'Sin descripción'}</div>
                <div className="mt-1.5">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${selected.isSystem ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>
                    {selected.isSystem ? 'Sistema' : 'Custom'}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Permisos", value: `${selected.permissionsCount} permisos` },
                { label: "Usuarios asignados", value: `${selected.usersCount} usuarios` },
              ].map((f, i) => (
                <div key={i} className="bg-muted rounded-lg p-3">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{f.label}</div>
                  <div className="text-[13px] font-semibold text-foreground">{f.value}</div>
                </div>
              ))}
            </div>
            {selected.permissions && selected.permissions.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Permisos asignados</div>
                {Object.entries(
                  selected.permissions.reduce<Record<string, string[]>>((acc, { permission: p }) => {
                    ;(acc[p.module] ??= []).push(p.name)
                    return acc
                  }, {})
                ).map(([mod, names]) => (
                  <div key={mod} className="mb-2">
                    <div className="text-[10px] font-semibold text-muted-foreground mb-1">{mod}</div>
                    <div className="flex flex-wrap gap-1">
                      {names.map(n => (
                        <span key={n} className="text-[10px] px-2 py-0.5 bg-secondary text-foreground rounded">{n}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2.5 justify-end">
              <button onClick={() => setSelected(null)} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cerrar</button>
              {!selected.isSystem && (
                <button
                  onClick={() => { if (window.confirm('¿Eliminar este rol?')) handleDelete(selected.id) }}
                  className="px-4.5 py-2 bg-red-500 text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer"
                >Eliminar</button>
              )}
              <button onClick={() => handleOpenEdit(selected)} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer">Editar Rol</button>
            </div>
          </div>
        )}
      </FormModal>

      {/* Modal crear */}
      <FormModal open={modalOpen} onClose={handleCloseModal} title="Nuevo Rol">
        <div className="flex flex-col gap-3">
          <FormField label="Nombre" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
          <FormField label="Descripción" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                className="w-9 h-9 rounded border border-border cursor-pointer p-0.5 bg-card"
              />
              <span className="text-[13px] text-muted-foreground font-mono">{form.color}</span>
            </div>
          </div>
          {Object.keys(byModule).length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Permisos</label>
              <div className="max-h-[240px] overflow-y-auto border border-border rounded-lg p-3 flex flex-col gap-3">
                {Object.entries(byModule).map(([mod, perms]) => (
                  <div key={mod}>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{mod}</div>
                    <div className="flex flex-col gap-1">
                      {perms.map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer text-[13px] text-foreground">
                          <input
                            type="checkbox"
                            checked={form.permissionIds.includes(p.id)}
                            onChange={() => setForm(prev => ({ ...prev, permissionIds: togglePerm(p.id, prev.permissionIds) }))}
                            className="accent-primary"
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2.5 justify-end mt-2">
          <button onClick={handleCloseModal} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar Rol'}
          </button>
        </div>
      </FormModal>

      {/* Modal editar */}
      <FormModal open={editModalOpen} onClose={handleCloseEdit} title="Editar Rol">
        <div className="flex flex-col gap-3">
          <FormField label="Nombre" value={editForm.name} onChange={v => setEditForm(p => ({ ...p, name: v }))} />
          <FormField label="Descripción" value={editForm.description} onChange={v => setEditForm(p => ({ ...p, description: v }))} />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editForm.color}
                onChange={e => setEditForm(p => ({ ...p, color: e.target.value }))}
                className="w-9 h-9 rounded border border-border cursor-pointer p-0.5 bg-card"
              />
              <span className="text-[13px] text-muted-foreground font-mono">{editForm.color}</span>
            </div>
          </div>
          {Object.keys(byModule).length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Permisos</label>
              <div className="max-h-[240px] overflow-y-auto border border-border rounded-lg p-3 flex flex-col gap-3">
                {Object.entries(byModule).map(([mod, perms]) => (
                  <div key={mod}>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{mod}</div>
                    <div className="flex flex-col gap-1">
                      {perms.map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer text-[13px] text-foreground">
                          <input
                            type="checkbox"
                            checked={editForm.permissionIds.includes(p.id)}
                            onChange={() => setEditForm(prev => ({ ...prev, permissionIds: togglePerm(p.id, prev.permissionIds) }))}
                            className="accent-primary"
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
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

      {showPlantillas && (
        <PlantillasModal onClose={() => setShowPlantillas(false)} onApplied={loadAll} />
      )}
    </div>
  )
}
