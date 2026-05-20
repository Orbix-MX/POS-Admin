import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { FormModal, FormField } from '@/components/shared/form-modal'
import { STATUS_OPTIONS, TAX_CODES } from '@/hooks/retail/use-products'
import type { Product } from '@/services/retail/product-service'
import type { Category } from '@/services/retail/categories-service'
import { uploadProductImage, deleteProductImage } from '@/services/retail/product-service'

export interface ProductFormModalProps {
  open: boolean
  onClose: () => void
  editingId: string | null
  form: Product
  setForm: Dispatch<SetStateAction<Product>>
  onSave: () => void
  categories: Category[]
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

export function ProductFormModal({
  open,
  onClose,
  editingId,
  form,
  setForm,
  onSave,
  categories,
}: ProductFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const primaryImage = form.images?.find(img => img.isPrimary) ?? form.images?.[0]

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editingId) return

    setUploadError(null)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError('Formato no permitido. Usa PNG, JPG o WebP.')
      return
    }
    if (file.size > MAX_SIZE) {
      setUploadError('La imagen supera 5 MB.')
      return
    }

    setUploading(true)
    try {
      const newImage = await uploadProductImage(editingId, file)
      setForm(p => ({
        ...p,
        images: [newImage],
      }))
    } catch {
      setUploadError('Error al subir la imagen. Intenta de nuevo.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveImage() {
    if (!editingId || !primaryImage) return
    setUploadError(null)
    setUploading(true)
    try {
      await deleteProductImage(editingId, primaryImage.id)
      setForm(p => ({
        ...p,
        images: p.images?.filter(img => img.id !== primaryImage.id) ?? [],
      }))
    } catch {
      setUploadError('Error al eliminar la imagen.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title={editingId ? 'Editar Producto' : 'Nuevo Producto'}>
      {/* Image section */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Imagen</label>
        {editingId ? (
          <div className="flex items-center gap-3">
            {primaryImage ? (
              <div className="relative flex-shrink-0">
                <img
                  src={primaryImage.url}
                  alt={primaryImage.altText ?? form.name}
                  className="w-16 h-16 object-cover rounded-lg border border-border"
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                    <span className="text-white text-xs">...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/30 flex-shrink-0">
                {uploading ? (
                  <span className="text-xs text-muted-foreground">...</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Sin imagen</span>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground cursor-pointer disabled:opacity-50"
              >
                {primaryImage ? 'Reemplazar' : 'Subir imagen'}
              </button>
              {primaryImage && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleRemoveImage}
                  className="px-3 py-1.5 text-xs border border-destructive/50 rounded-lg text-destructive cursor-pointer disabled:opacity-50"
                >
                  Eliminar
                </button>
              )}
              <span className="text-[11px] text-muted-foreground">PNG, JPG, WebP · máx 5 MB</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Guarda el producto primero para subir imagen.</p>
        )}
        {uploadError && (
          <p className="text-xs text-destructive mt-1">{uploadError}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4">
        {!editingId && (
          <FormField label="SKU" value={form.sku} onChange={v => setForm(p => ({ ...p, sku: v }))} />
        )}
        <div className={`mb-3.5${editingId ? ' col-span-2' : ''}`}>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Categoría</label>
          <select
            value={form.categoryId}
            onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))}
            className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
          >
            <option value="">— Sin categoría —</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <FormField label="Nombre" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
        </div>
        <div className="col-span-2">
          <FormField label="Descripción" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} />
        </div>
        <FormField label="Precio" type="number" value={form.price.toString()} onChange={v => setForm(p => ({ ...p, price: Number(v) || 0 }))} />
        <FormField label="Precio Compare" type="number" value={Number(form.comparePrice).toString()} onChange={v => setForm(p => ({ ...p, comparePrice: Number(v) || 0 }))} />
        <FormField label="Costo" type="number" value={Number(form.costPrice).toString()} onChange={v => setForm(p => ({ ...p, costPrice: Number(v) || 0 }))} />
        <FormField label="Estado"
          value={form.status}
          onChange={v => setForm(p => ({
            ...p,
            status: STATUS_OPTIONS.find(o => o.label === v)?.value as 'DRAFT' | 'ACTIVE' | 'ARCHIVED' || 'DRAFT'
          }))}
          options={STATUS_OPTIONS.map(o => o.label)} />
        <FormField label="Stock" type="number" value={Number(form.stock).toString()} onChange={v => setForm(p => ({ ...p, stock: Number(v) || 0 }))} />
        <FormField label="Stock Mínimo" type="number" value={form.lowStockAlert.toString()} onChange={v => setForm(p => ({ ...p, lowStockAlert: Number(v) || 0 }))} />
        <div className="col-span-2 flex items-center gap-2 mb-3.5">
          <input type="checkbox" id="trackInv" checked={form.trackInventory} onChange={e => setForm(p => ({ ...p, trackInventory: e.target.checked }))} />
          <label htmlFor="trackInv" className="text-xs text-muted-foreground cursor-pointer">Rastrear inventario</label>
        </div>
        {!editingId && (
          <FormField label="Slug" value={form.slug} onChange={v => setForm(p => ({ ...p, slug: v }))} />
        )}
        <FormField label="Código Impuesto" value={form.taxCode} onChange={v => setForm(p => ({ ...p, taxCode: TAX_CODES.find(t => t.label === v)?.value || 'IVA_16' }))} options={TAX_CODES.map(t => t.label)} />
        <FormField label="Tasa Impuesto" type="number" value={Number(form.taxRate || 0).toString()} onChange={v => setForm(p => ({ ...p, taxRate: Number(v) || 0 }))} />
        <div className="col-span-2">
          <FormField label="Meta Title" value={form.metaTitle} onChange={v => setForm(p => ({ ...p, metaTitle: v }))} />
        </div>
        <div className="col-span-2">
          <FormField label="Meta Description" value={form.metaDescription} onChange={v => setForm(p => ({ ...p, metaDescription: v }))} />
        </div>
      </div>
      <div className="flex gap-2.5 justify-end pt-2">
        <button type="button" onClick={onClose} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cancelar</button>
        <button type="button" onClick={onSave} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer">Guardar</button>
      </div>
    </FormModal>
  )
}
