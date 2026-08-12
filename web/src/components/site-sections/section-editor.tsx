import { useState, useRef } from 'react'
import { Loader2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Upload, Trash2, Plus, Check } from 'lucide-react'
import {
  SECTION_META,
  type EditableSection, type IconItem, type TestimonialItem,
  type HeroContent, type ValuePropsContent, type FeaturedCategoriesContent, type FeaturedProductsContent,
  type TestimonialsContent, type ContactFooterContent,
} from './types'

// ─── Campos de texto compartidos ─────────────────────────────────────────────

function TextField({ label, value, onChange, placeholder, multiline = false }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2}
          className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary resize-none" />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary" />
      )}
    </div>
  )
}

function ImageField({ label, url, onUpload, onClear, uploading }: {
  label: string
  url?: string
  onUpload: (file: File) => void
  onClear: () => void
  uploading: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</label>
      <div className="relative rounded-xl border border-border bg-muted/20 overflow-hidden flex items-center justify-center" style={{ height: 100 }}>
        {url ? (
          <>
            <img src={url} alt="" className="w-full h-full object-cover" />
            {!uploading && (
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs border border-white/20 cursor-pointer"><Upload className="w-3 h-3" /> Reemplazar</button>
                <button type="button" onClick={onClear} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/70 hover:bg-destructive/90 text-white text-xs border border-destructive/40 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
              </div>
            )}
          </>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex flex-col items-center gap-1.5 text-center cursor-pointer disabled:cursor-not-allowed">
            <Upload className="w-5 h-5 text-muted-foreground/50" />
            <span className="text-[11px] text-muted-foreground">Subir imagen</span>
          </button>
        )}
        {uploading && <div className="absolute inset-0 bg-background/70 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} />
    </div>
  )
}

// ─── Editor de lista {icono, título, texto} — VALUE_PROPS y FEATURED_CATEGORIES ─

function IconItemsEditor({ items, onChange }: { items: IconItem[]; onChange: (items: IconItem[]) => void }) {
  const update = (i: number, patch: Partial<IconItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const add = () => onChange([...items, { icon: '✨', title: '', text: '' }])

  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start border border-border rounded-lg p-2.5">
          <input value={item.icon ?? ''} onChange={e => update(i, { icon: e.target.value })} placeholder="🌿"
            className="w-11 shrink-0 px-2 py-2 border border-border rounded-lg text-center text-base bg-card outline-none focus:border-primary" />
          <div className="flex-1 space-y-1.5">
            <input value={item.title} onChange={e => update(i, { title: e.target.value })} placeholder="Título"
              className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary" />
            <textarea value={item.text} onChange={e => update(i, { text: e.target.value })} placeholder="Descripción" rows={2}
              className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs text-foreground bg-card outline-none focus:border-primary resize-none" />
          </div>
          <button type="button" onClick={() => remove(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 cursor-pointer shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 cursor-pointer">
        <Plus className="w-3.5 h-3.5" /> Agregar tarjeta
      </button>
    </div>
  )
}

// ─── Formularios por tipo de sección ─────────────────────────────────────────

function HeroForm({ content, onSave, onUploadImage }: {
  content: HeroContent
  onSave: (c: HeroContent) => Promise<boolean>
  onUploadImage: (file: File) => Promise<string>
}) {
  const [draft, setDraft] = useState<HeroContent>(content)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleUpload(file: File) {
    setUploading(true)
    try { setDraft(p => ({ ...p, backgroundImageUrl: '' })); const url = await onUploadImage(file); setDraft(p => ({ ...p, backgroundImageUrl: url })) }
    finally { setUploading(false) }
  }

  async function handleSave() {
    setSaving(true)
    const ok = await onSave(draft)
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="space-y-3.5">
      <TextField label="Título" value={draft.title ?? ''} onChange={v => setDraft(p => ({ ...p, title: v }))} placeholder="Naturaleza para tu acuario" />
      <TextField label="Subtítulo" value={draft.subtitle ?? ''} onChange={v => setDraft(p => ({ ...p, subtitle: v }))} placeholder="Frase corta debajo del título" />
      <ImageField label="Imagen de fondo" url={draft.backgroundImageUrl} uploading={uploading} onUpload={handleUpload} onClear={() => setDraft(p => ({ ...p, backgroundImageUrl: '' }))} />
      <SaveButton onClick={handleSave} saving={saving} saved={saved} />
    </div>
  )
}

function ValuePropsForm({ content, onSave }: { content: ValuePropsContent; onSave: (c: ValuePropsContent) => Promise<boolean> }) {
  const [items, setItems] = useState<IconItem[]>(content.items ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    const ok = await onSave({ items })
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="space-y-3.5">
      <IconItemsEditor items={items} onChange={setItems} />
      <SaveButton onClick={handleSave} saving={saving} saved={saved} />
    </div>
  )
}

function FeaturedCategoriesForm({ content, onSave }: { content: FeaturedCategoriesContent; onSave: (c: FeaturedCategoriesContent) => Promise<boolean> }) {
  const [draft, setDraft] = useState<FeaturedCategoriesContent>({ items: [], ...content })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    const ok = await onSave(draft)
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="space-y-3.5">
      <TextField label="Título" value={draft.title ?? ''} onChange={v => setDraft(p => ({ ...p, title: v }))} placeholder="Nuestro oficio" />
      <TextField label="Subtítulo" value={draft.subtitle ?? ''} onChange={v => setDraft(p => ({ ...p, subtitle: v }))} multiline />
      <IconItemsEditor items={draft.items ?? []} onChange={items => setDraft(p => ({ ...p, items }))} />
      <SaveButton onClick={handleSave} saving={saving} saved={saved} />
    </div>
  )
}

function FeaturedProductsForm({ content, onSave }: { content: FeaturedProductsContent; onSave: (c: FeaturedProductsContent) => Promise<boolean> }) {
  const [draft, setDraft] = useState<FeaturedProductsContent>(content)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    const ok = await onSave(draft)
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="space-y-3.5">
      <TextField label="Título" value={draft.title ?? ''} onChange={v => setDraft(p => ({ ...p, title: v }))} placeholder="Selección destacada" />
      <TextField label="Subtítulo" value={draft.subtitle ?? ''} onChange={v => setDraft(p => ({ ...p, subtitle: v }))} multiline />
      <p className="text-[11px] text-muted-foreground">
        Los productos que se muestran aquí son los que tienes marcados como "Publicar en E-commerce" en Inventario — este bloque solo controla el título y subtítulo.
      </p>
      <SaveButton onClick={handleSave} saving={saving} saved={saved} />
    </div>
  )
}

function TestimonialsForm({ content, onSave, onUploadImage }: {
  content: TestimonialsContent
  onSave: (c: TestimonialsContent) => Promise<boolean>
  onUploadImage: (file: File) => Promise<string>
}) {
  const [draft, setDraft] = useState<TestimonialsContent>({ items: [], ...content })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)

  const items = draft.items ?? []
  const update = (i: number, patch: Partial<TestimonialItem>) =>
    setDraft(p => ({ ...p, items: (p.items ?? []).map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }))
  const remove = (i: number) => setDraft(p => ({ ...p, items: (p.items ?? []).filter((_, idx) => idx !== i) }))
  const add = () => setDraft(p => ({ ...p, items: [...(p.items ?? []), { author: '', quote: '' }] }))

  async function handleUpload(i: number, file: File) {
    setUploadingIndex(i)
    try { const url = await onUploadImage(file); update(i, { avatarUrl: url }) }
    finally { setUploadingIndex(null) }
  }

  async function handleSave() {
    setSaving(true)
    const ok = await onSave(draft)
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="space-y-3.5">
      <TextField label="Título" value={draft.title ?? ''} onChange={v => setDraft(p => ({ ...p, title: v }))} placeholder="Lo que dicen nuestros clientes" />
      <TextField label="Subtítulo" value={draft.subtitle ?? ''} onChange={v => setDraft(p => ({ ...p, subtitle: v }))} multiline />

      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2.5 items-start border border-border rounded-lg p-2.5">
            <div className="w-14 shrink-0">
              <ImageField label="Foto" url={item.avatarUrl} uploading={uploadingIndex === i} onUpload={f => handleUpload(i, f)} onClear={() => update(i, { avatarUrl: '' })} />
            </div>
            <div className="flex-1 space-y-1.5">
              <input value={item.author} onChange={e => update(i, { author: e.target.value })} placeholder="Nombre del cliente"
                className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary" />
              <textarea value={item.quote} onChange={e => update(i, { quote: e.target.value })} placeholder="Comentario" rows={2}
                className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs text-foreground bg-card outline-none focus:border-primary resize-none" />
            </div>
            <button type="button" onClick={() => remove(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 cursor-pointer shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button type="button" onClick={add} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Agregar testimonio
        </button>
      </div>

      <SaveButton onClick={handleSave} saving={saving} saved={saved} />
    </div>
  )
}

function ContactFooterForm({ content, onSave }: { content: ContactFooterContent; onSave: (c: ContactFooterContent) => Promise<boolean> }) {
  const [draft, setDraft] = useState<ContactFooterContent>(content)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    const ok = await onSave(draft)
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="space-y-3.5">
      <TextField label="Título" value={draft.title ?? ''} onChange={v => setDraft(p => ({ ...p, title: v }))} placeholder="¿No sabes por dónde empezar?" />
      <TextField label="Subtítulo" value={draft.subtitle ?? ''} onChange={v => setDraft(p => ({ ...p, subtitle: v }))} multiline />
      <TextField label="WhatsApp (con lada, sin espacios ni +)" value={draft.whatsappNumber ?? ''} onChange={v => setDraft(p => ({ ...p, whatsappNumber: v }))} placeholder="526562016886" />
      <SaveButton onClick={handleSave} saving={saving} saved={saved} />
    </div>
  )
}

function SaveButton({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <button onClick={onClick} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60">
      {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</> : saved ? <><Check className="w-3.5 h-3.5" /> Guardado</> : 'Guardar cambios'}
    </button>
  )
}

// ─── Tarjeta de sección (encabezado + form según tipo) ───────────────────────
// Compartida entre /tienda-online (tenant) y /platform/empresas/:id → pestaña
// "Tienda en línea" (plataforma) — solo cambian los callbacks que reciben.

export function SectionCard({ section, index, total, reordering, onSave, onToggleActive, onMove, onUploadImage }: {
  section: EditableSection
  index: number
  total: number
  reordering: boolean
  onSave: (content: Record<string, unknown>) => Promise<boolean>
  onToggleActive: (active: boolean) => void
  onMove: (direction: 'up' | 'down') => void
  onUploadImage: (file: File) => Promise<string>
}) {
  const [open, setOpen] = useState(false)
  const meta = SECTION_META[section.sectionType]

  return (
    <div className={`border border-border rounded-xl overflow-hidden transition-opacity ${section.isActive ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-3 px-4 py-3.5 bg-card">
        <div className="flex flex-col shrink-0">
          <button onClick={() => onMove('up')} disabled={index === 0 || reordering} className="p-0.5 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground cursor-pointer disabled:cursor-not-allowed">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onMove('down')} disabled={index === total - 1 || reordering} className="p-0.5 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground cursor-pointer disabled:cursor-not-allowed">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 min-w-0" onClick={() => setOpen(o => !o)} role="button">
          <div className="text-[13px] font-bold text-foreground">{meta.label}</div>
          <div className="text-[11px] text-muted-foreground">{meta.description}</div>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={section.isActive} onChange={e => onToggleActive(e.target.checked)} className="accent-primary w-3.5 h-3.5" />
          <span className="text-[11px] text-muted-foreground">Visible</span>
        </label>
        <button onClick={() => setOpen(o => !o)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer shrink-0">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-4 bg-muted/10">
          {reordering && (
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Guardando orden…</div>
          )}
          {section.sectionType === 'HERO' && (
            <HeroForm content={section.content as HeroContent} onSave={c => onSave(c as Record<string, unknown>)} onUploadImage={onUploadImage} />
          )}
          {section.sectionType === 'VALUE_PROPS' && (
            <ValuePropsForm content={section.content as ValuePropsContent} onSave={c => onSave(c as Record<string, unknown>)} />
          )}
          {section.sectionType === 'FEATURED_CATEGORIES' && (
            <FeaturedCategoriesForm content={section.content as FeaturedCategoriesContent} onSave={c => onSave(c as Record<string, unknown>)} />
          )}
          {section.sectionType === 'FEATURED_PRODUCTS' && (
            <FeaturedProductsForm content={section.content as FeaturedProductsContent} onSave={c => onSave(c as Record<string, unknown>)} />
          )}
          {section.sectionType === 'TESTIMONIALS' && (
            <TestimonialsForm content={section.content as TestimonialsContent} onSave={c => onSave(c as Record<string, unknown>)} onUploadImage={onUploadImage} />
          )}
          {section.sectionType === 'CONTACT_FOOTER' && (
            <ContactFooterForm content={section.content as ContactFooterContent} onSave={c => onSave(c as Record<string, unknown>)} />
          )}
        </div>
      )}
    </div>
  )
}
