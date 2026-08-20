import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Upload, RefreshCw, Trash2 as TrashIcon, ImageOff } from 'lucide-react'
import { FormModal, FormField } from '@/components/shared/form-modal'
import type { Category } from '@/hooks/retail/use-categories'
import { uploadCategoryImage, deleteCategoryImage } from '@/services/retail/categories-service'

export type CategoryFormState = Omit<Category, 'id'>

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)
  const primaryImage = form.images?.[0]

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
      const newImage = await uploadCategoryImage(editingId, file)
      setForm(p => ({ ...p, images: [newImage] }))
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
      await deleteCategoryImage(editingId, primaryImage.id)
      setForm(p => ({ ...p, images: [] }))
    } catch {
      setUploadError('Error al eliminar la imagen.')
    } finally {
      setUploading(false)
    }
  }
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

        <div className="col-span-2 mb-3.5">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Foto de referencia</label>
          {editingId ? (
            <>
              <div
                className="relative w-full rounded-xl overflow-hidden border border-border bg-muted/20"
                style={{ aspectRatio: '16/9' }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                {primaryImage ? (
                  <>
                    <img
                      src={primaryImage.url}
                      alt={form.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div
                      className="absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-200"
                      style={{
                        background: 'rgba(0,0,0,0.52)',
                        opacity: hovered && !uploading ? 1 : 0,
                        pointerEvents: hovered && !uploading ? 'auto' : 'none',
                      }}
                    >
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition-colors border border-white/20 cursor-pointer">
                        <RefreshCw className="w-3.5 h-3.5" /> Reemplazar
                      </button>
                      <button type="button" onClick={handleRemoveImage} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/70 hover:bg-destructive/90 text-white text-xs font-medium transition-colors border border-destructive/40 cursor-pointer">
                        <TrashIcon className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center gap-2 text-center cursor-pointer group disabled:cursor-not-allowed">
                    <div className="w-12 h-12 rounded-2xl bg-muted/60 border-2 border-dashed border-border group-hover:border-primary/50 group-hover:bg-primary/5 flex items-center justify-center transition-colors duration-200">
                      <Upload className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">Subir imagen · PNG, JPG, WebP · máx 5 MB</p>
                  </button>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={handleFileChange} />
              {uploadError && <p className="text-xs text-destructive mt-1.5">{uploadError}</p>}
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-3 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
              <ImageOff className="w-4 h-4 shrink-0" /> Guarda la categoría primero para poder subirle una foto.
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2.5 justify-end pt-2">
        <button type="button" onClick={onClose} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cancelar</button>
        <button type="button" onClick={onSave} className="px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer">Guardar</button>
      </div>
    </FormModal>
  )
}
