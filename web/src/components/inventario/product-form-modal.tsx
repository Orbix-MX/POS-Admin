import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { FormModal, FormField } from '@/components/shared/form-modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STATUS_OPTIONS, TAX_CODES } from '@/hooks/retail/use-products'
import type { Product } from '@/services/retail/product-service'
import type { Category } from '@/services/retail/categories-service'
import { uploadProductImage, deleteProductImage } from '@/services/retail/product-service'
import { ImageViewer } from '@/components/shared/image-viewer'

export interface ProductFormModalProps {
  open: boolean
  onClose: () => void
  editingId: string | null
  form: Product
  setForm: Dispatch<SetStateAction<Product>>
  onSave: () => void
  onImageChange?: () => void
  categories: Category[]
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

function IconImage() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function IconUpload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function IconEye() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function IconSpinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

export function ProductFormModal({
  open,
  onClose,
  editingId,
  form,
  setForm,
  onSave,
  onImageChange,
  categories,
}: ProductFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

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
      setForm(p => ({ ...p, images: [newImage] }))
      onImageChange?.()
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
      onImageChange?.()
    } catch {
      setUploadError('Error al eliminar la imagen.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload() {
    if (!primaryImage) return
    try {
      const res = await fetch(primaryImage.url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = blob.type.split('/')[1] || 'jpg'
      a.download = `${(form.name || 'producto').replace(/\s+/g, '-').toLowerCase()}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.open(primaryImage.url, '_blank')
    }
  }

  return (
    <>
      <FormModal open={open} onClose={onClose} title={editingId ? 'Editar Producto' : 'Nuevo Producto'}>
        {/* Image section */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-muted-foreground mb-2">Imagen del producto</label>

          {editingId ? (
            <div className="space-y-2">
              {/* Card image container */}
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
                      alt={primaryImage.altText ?? form.name}
                      loading="lazy"
                      className="w-full h-full object-contain"
                      style={{ background: 'var(--muted)' }}
                    />

                    {/* Hover overlay */}
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2 transition-opacity duration-200"
                      style={{
                        background: 'rgba(0,0,0,0.52)',
                        opacity: hovered && !uploading ? 1 : 0,
                        pointerEvents: hovered && !uploading ? 'auto' : 'none',
                        backdropFilter: 'blur(2px)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewerOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition-colors border border-white/20"
                          aria-label="Ver imagen ampliada"
                        >
                          <IconEye />
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition-colors border border-white/20"
                          aria-label="Descargar imagen"
                        >
                          <IconDownload />
                          Descargar
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition-colors border border-white/20"
                          aria-label="Reemplazar imagen"
                        >
                          <IconRefresh />
                          Reemplazar
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/70 hover:bg-destructive/90 text-white text-xs font-medium transition-colors border border-destructive/40"
                          aria-label="Eliminar imagen"
                        >
                          <IconTrash />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Placeholder */
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full flex flex-col items-center justify-center gap-3 text-center cursor-pointer group disabled:cursor-not-allowed"
                    aria-label="Subir imagen de producto"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-muted/60 border-2 border-dashed border-border group-hover:border-primary/50 group-hover:bg-primary/5 flex items-center justify-center transition-colors duration-200">
                      <IconImage />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        Subir imagen
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                        PNG, JPG, WebP · máx 5 MB
                      </p>
                    </div>
                  </button>
                )}

                {/* Upload loading overlay */}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-xl">
                    <div className="flex flex-col items-center gap-2">
                      <IconSpinner />
                      <span className="text-xs text-muted-foreground">
                        {primaryImage ? 'Procesando...' : 'Subiendo...'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick upload button when image exists */}
              {primaryImage && !uploading && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <IconUpload />
                  Reemplazar imagen
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
                aria-label="Seleccionar imagen de producto"
              />
            </div>
          ) : (
            <div className="w-full rounded-xl border border-dashed border-border bg-muted/10 flex items-center justify-center gap-3 py-5 px-4" style={{ aspectRatio: '16/9' }}>
              <IconImage />
              <div>
                <p className="text-sm text-muted-foreground font-medium">Imagen disponible al guardar</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Guarda el producto primero para subir imagen</p>
              </div>
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-destructive mt-1.5">{uploadError}</p>
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
          <div className="mb-3.5">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Estado</label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as 'DRAFT' | 'ACTIVE' | 'ARCHIVED' }))}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue>{STATUS_OPTIONS.find(o => o.value === form.status)?.label ?? form.status}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <FormField label="Stock" type="number" value={Number(form.stock).toString()} onChange={v => setForm(p => ({ ...p, stock: Number(v) || 0 }))} />
          <FormField label="Stock Mínimo" type="number" value={form.lowStockAlert.toString()} onChange={v => setForm(p => ({ ...p, lowStockAlert: Number(v) || 0 }))} />
          <div className="col-span-2 flex items-center gap-2 mb-3.5">
            <input type="checkbox" id="trackInv" checked={form.trackInventory} onChange={e => setForm(p => ({ ...p, trackInventory: e.target.checked }))} />
            <label htmlFor="trackInv" className="text-xs text-muted-foreground cursor-pointer">Rastrear inventario</label>
          </div>
          {!editingId && (
            <FormField label="Slug" value={form.slug} onChange={v => setForm(p => ({ ...p, slug: v }))} />
          )}
          <div className="mb-3.5">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Código Impuesto</label>
            <Select value={form.taxCode} onValueChange={v => setForm(p => ({ ...p, taxCode: v ?? p.taxCode }))}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue>{TAX_CODES.find(t => t.value === form.taxCode)?.label ?? form.taxCode}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TAX_CODES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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

      {viewerOpen && primaryImage && (
        <ImageViewer
          src={primaryImage.url}
          alt={primaryImage.altText ?? form.name}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  )
}
