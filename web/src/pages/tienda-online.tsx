import { Loader2, Store } from 'lucide-react'
import { useSite } from '@/hooks/core/use-site'
import { SectionCard } from '@/components/site-sections/section-editor'

export function TiendaOnline() {
  const { site, loading, notConfigured, error, reordering, reload, saveSection, moveSection, uploadImage } = useSite()

  if (loading) {
    return (
      <div className="p-7 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando tienda en línea…
      </div>
    )
  }

  if (notConfigured) {
    return (
      <div className="p-7">
        <div className="flex flex-col items-center gap-3 py-20 border border-dashed border-border rounded-xl">
          <Store className="w-9 h-9 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Tu tienda en línea todavía no tiene una plantilla asignada.</p>
          <p className="text-xs text-muted-foreground/70">Contacta a soporte de Orbix para activarla.</p>
        </div>
      </div>
    )
  }

  if (error || !site) {
    return (
      <div className="p-7">
        <div className="flex flex-col items-center gap-3 py-20">
          <span className="text-sm text-red-500">{error ?? 'Error al cargar'}</span>
          <button onClick={reload} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer">Reintentar</button>
        </div>
      </div>
    )
  }

  const ordered = [...site.siteSections].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="p-7 flex flex-col gap-5 max-w-3xl">
      <div>
        <div className="text-base font-bold text-foreground mb-1">Tienda en línea</div>
        <div className="text-xs text-muted-foreground">
          Plantilla: <span className="font-semibold text-foreground">{site.template.name}</span> — edita el contenido de tu página de inicio, súbele imágenes y ordena sus secciones.
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {ordered.map((section, i) => (
          <SectionCard
            key={section.id}
            section={section}
            index={i}
            total={ordered.length}
            reordering={reordering}
            onSave={content => saveSection(section.id, { content })}
            onToggleActive={active => saveSection(section.id, { isActive: active })}
            onMove={direction => moveSection(section.id, direction)}
            onUploadImage={uploadImage}
          />
        ))}
      </div>
    </div>
  )
}
