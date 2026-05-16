import type { Dispatch, SetStateAction } from 'react'
import { FormModal, FormField } from '@/components/shared/form-modal'
import type { Category } from '@/hooks/retail/use-categories'

export type CategoryFormState = Omit<Category, 'id'>

export interface CategoryFormModalProps {
  open: boolean
  onClose: () => void
  editingId: string | null
  form: CategoryFormState
  setForm: Dispatch<SetStateAction<CategoryFormState>>
  setName: (name: string) => void
  categories: Category[]
  onSave: () => void
}

export function CategoryFormModal({
  open,
  onClose,
  editingId,
  form,
  setForm,
  setName,
  categories,
  onSave,
}: CategoryFormModalProps) {
  return (
    <FormModal open={open} onClose={onClose} title={editingId ? 'Editar Categoría' : 'Nueva Categoría'}>
      <div className="grid grid-cols-2 gap-x-4">
        <div className="col-span-2">
          <FormField label="Nombre" value={form.name} onChange={setName} />
        </div>
        <div className="col-span-2">
          <FormField label="Slug" value={form.slug} onChange={v => setForm(p => ({ ...p, slug: v }))} />
        </div>
        <div className="col-span-2">
          <FormField label="Descripción" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} />
        </div>

        <div className="col-span-2 mb-3.5">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Categoría padre</label>
          <select
            value={form.parentId ?? ''}
            onChange={e => setForm(p => ({ ...p, parentId: e.target.value || null }))}
            className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
          >
            <option value="">Sin categoría padre</option>
            {categories
              .filter(c => c.id !== editingId)
              .map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>
        </div>

        <FormField
          label="Estado"
          value={form.status}
          onChange={v => setForm(p => ({ ...p, status: v as Category['status'] }))}
          options={['ACTIVE', 'INACTIVE']}
        />
        <FormField
          label="Orden"
          type="number"
          value={form.sortOrder.toString()}
          onChange={v => setForm(p => ({ ...p, sortOrder: Number(v) || 0 }))}
        />
      </div>
      <div className="flex gap-2.5 justify-end pt-2">
        <button type="button" onClick={onClose} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cancelar</button>
        <button type="button" onClick={onSave} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer">Guardar</button>
      </div>
    </FormModal>
  )
}
