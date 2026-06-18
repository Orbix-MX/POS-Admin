import { useMemo, useCallback } from 'react'
import { DataTable, type Column } from '@/components/shared/data-table'
import { FormModal, FormField } from '@/components/shared/form-modal'
import { useDiningAreas, type DiningArea } from '@/hooks/restaurant/use-dining-areas'

export default function DiningAreasPage() {
  const {
    filtered, loading, error, search, setSearch,
    currentBranch, branchId,
    modalOpen, editTarget, form, setForm, saving, saveError,
    openCreate, openEdit, closeModal, handleSave, toggleActive,
  } = useDiningAreas()

  const columns: Column<DiningArea>[] = useMemo(() => [
    {
      key: 'name' as keyof DiningArea,
      label: 'Nombre',
      render: (a) => <span className="font-semibold text-foreground">{a.name}</span>,
    },
    {
      key: 'description' as keyof DiningArea,
      label: 'Descripción',
      render: (a) => <span className="text-muted-foreground text-[13px]">{a.description || '—'}</span>,
    },
    {
      key: 'displayOrder' as keyof DiningArea,
      label: 'Orden',
      render: (a) => <span className="font-mono text-[13px]">{a.displayOrder}</span>,
    },
    {
      key: 'isActive' as keyof DiningArea,
      label: 'Estado',
      render: (a) => (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${a.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'}`}>
          {a.isActive ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
    {
      label: '',
      render: (a) => (
        <div className="flex gap-2 justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(a) }}
            className="px-2 py-1 text-[12px] rounded border border-border hover:bg-muted/50 text-foreground cursor-pointer bg-transparent"
          >
            Editar
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); void toggleActive(a) }}
            className={`px-2 py-1 text-[12px] rounded border cursor-pointer bg-transparent ${a.isActive ? 'border-amber-400/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'border-emerald-400/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
          >
            {a.isActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      ),
    },
  ], [openEdit, toggleActive])

  const handleField = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [k]: v }))
  }, [setForm])

  if (!branchId) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-muted-foreground text-[14px]">Selecciona una sucursal para administrar sus áreas.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-bold text-foreground">Áreas del restaurante</h1>
          {currentBranch && (
            <p className="text-[12px] text-muted-foreground mt-0.5">{currentBranch.name}</p>
          )}
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-primary text-primary-foreground text-[13px] font-semibold rounded-lg border-none cursor-pointer hover:opacity-90"
        >
          + Nueva área
        </button>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b border-border">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar área…"
          className="w-full max-w-xs px-3 py-2 border border-border rounded-lg text-[13px] bg-card text-foreground outline-none focus:border-primary"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="p-8 text-center text-destructive text-[14px]">{error}</div>
        ) : loading ? (
          <div className="p-8 text-center text-muted-foreground text-[13px]">Cargando áreas…</div>
        ) : (
          <DataTable columns={columns} rows={filtered} />
        )}
      </div>

      {/* Create / Edit modal */}
      <FormModal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Editar área' : 'Nueva área'}
      >
        <div className="flex flex-col gap-4">
          <FormField
            label="Nombre *"
            value={form.name}
            onChange={(v) => handleField('name', v)}
          />
          <FormField
            label="Descripción"
            value={form.description ?? ''}
            onChange={(v) => handleField('description', v)}
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
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-primary text-primary-foreground border-none cursor-pointer hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : (editTarget ? 'Guardar cambios' : 'Crear área')}
            </button>
          </div>
        </div>
      </FormModal>
    </div>
  )
}
