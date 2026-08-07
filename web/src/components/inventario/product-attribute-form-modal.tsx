import type { Dispatch, SetStateAction } from 'react'
import { FormModal, FormField } from '@/components/shared/form-modal'
import type { ProductAttribute } from '@/hooks/retail/use-product-attributes'

export type ProductAttributeFormState = Omit<ProductAttribute, 'id'>

export interface ProductAttributeFormModalProps {
  open: boolean
  onClose: () => void
  editingId: string | null
  form: ProductAttributeFormState
  setForm: Dispatch<SetStateAction<ProductAttributeFormState>>
  setName: (name: string) => void
  onSave: () => void
}

export function ProductAttributeFormModal({
  open,
  onClose,
  editingId,
  form,
  setForm,
  setName,
  onSave,
}: ProductAttributeFormModalProps) {
  return (
    <FormModal open={open} onClose={onClose} title={editingId ? 'Editar Atributo' : 'Nuevo Atributo'}>
      <div className="grid grid-cols-2 gap-x-4">
        <div className="col-span-2">
          <FormField label="Nombre" value={form.name} onChange={setName} />
        </div>
        <div className="col-span-2">
          <FormField label="Slug" value={form.slug} onChange={v => setForm(p => ({ ...p, slug: v }))} />
        </div>

        <FormField
          label="Tipo de captura"
          value={form.type}
          onChange={v => setForm(p => ({ ...p, type: v as ProductAttribute['type'] }))}
          options={['TEXT', 'SELECT']}
        />
        <FormField
          label="Orden"
          type="number"
          value={form.sortOrder.toString()}
          onChange={v => setForm(p => ({ ...p, sortOrder: Number(v) || 0 }))}
        />

        {form.type === 'SELECT' && (
          <div className="col-span-2">
            <FormField
              label="Opciones (separadas por coma)"
              value={form.options.join(', ')}
              onChange={v => setForm(p => ({
                ...p,
                options: v.split(',').map(o => o.trim()).filter(Boolean),
              }))}
            />
          </div>
        )}

        <div className="col-span-2 flex items-center gap-2 mb-3.5">
          <input
            type="checkbox"
            id="attrActive"
            checked={form.isActive}
            onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
          />
          <label htmlFor="attrActive" className="text-xs text-muted-foreground cursor-pointer">
            Activo (disponible para capturar en productos)
          </label>
        </div>
      </div>
      <div className="flex gap-2.5 justify-end pt-2">
        <button type="button" onClick={onClose} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cancelar</button>
        <button type="button" onClick={onSave} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer">Guardar</button>
      </div>
    </FormModal>
  )
}
