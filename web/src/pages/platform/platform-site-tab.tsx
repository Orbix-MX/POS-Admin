import { useState, useEffect, useCallback } from 'react'
import { Loader2, LayoutTemplate, AlertTriangle, Trash2, Check } from 'lucide-react'
import {
  fetchTenantSite, fetchTemplates, assignTenantTemplate, removeTenantSite,
  updateTenantSiteSection, reorderTenantSiteSections, uploadTenantSiteImage,
} from '@/services/platform/platform-templates-service'
import type { TenantSite, Template } from '@/services/platform/platform-templates-service'
import { SectionCard } from '@/components/site-sections/section-editor'

function errMessage(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error inesperado'
}

export function SiteAssignmentTab({ tenantId }: { tenantId: string }) {
  const [site, setSite] = useState<TenantSite | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, tpls] = await Promise.all([fetchTenantSite(tenantId), fetchTemplates()])
      setSite(s)
      setTemplates(tpls)
    } catch {
      setError('Error al cargar la tienda en línea')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function handleAssign() {
    if (!selectedTemplateId) return
    setAssigning(true)
    setActionError(null)
    try {
      await assignTenantTemplate(tenantId, selectedTemplateId)
      await load()
    } catch (e) {
      setActionError(errMessage(e))
    } finally {
      setAssigning(false)
    }
  }

  async function handleRemove() {
    if (!confirm('¿Quitar la plantilla de este tenant? Se borrará todo el contenido que haya editado.')) return
    setRemoving(true)
    setActionError(null)
    try {
      await removeTenantSite(tenantId)
      await load()
    } catch (e) {
      setActionError(errMessage(e))
    } finally {
      setRemoving(false)
    }
  }

  async function handleSaveSection(sectionId: string, patch: { content?: Record<string, unknown>; isActive?: boolean }) {
    try {
      const updated = await updateTenantSiteSection(tenantId, sectionId, patch)
      setSite(prev => prev ? { ...prev, siteSections: prev.siteSections.map(s => s.id === sectionId ? updated : s) } : prev)
      return true
    } catch {
      return false
    }
  }

  async function handleMoveSection(sectionId: string, direction: 'up' | 'down') {
    if (!site) return
    const ordered = [...site.siteSections].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex(s => s.id === sectionId)
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || swapWith < 0 || swapWith >= ordered.length) return

    const next = [...ordered]
    ;[next[index], next[swapWith]] = [next[swapWith], next[index]]

    setReordering(true)
    try {
      const updated = await reorderTenantSiteSections(tenantId, next.map(s => s.id))
      setSite(updated)
    } catch {
      // deja el orden anterior si falla
    } finally {
      setReordering(false)
    }
  }

  async function handleUploadImage(file: File) {
    const { url } = await uploadTenantSiteImage(tenantId, file)
    return url
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
  }
  if (error) {
    return <div className="flex items-center gap-2 py-8 text-red-400 text-[13px]"><AlertTriangle className="w-4 h-4" /> {error}</div>
  }

  const activeTemplates = templates.filter(t => t.isActive)

  return (
    <div className="max-w-2xl">
      {actionError && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-900/20 border border-red-800/50 rounded-lg text-[12px] text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {actionError}
        </div>
      )}

      {!site ? (
        <div className="flex flex-col items-center gap-3 py-10 border border-dashed border-zinc-700 rounded-xl">
          <LayoutTemplate className="w-8 h-8 text-zinc-600" />
          <p className="text-[13px] text-zinc-400">Este tenant no tiene tienda en línea todavía.</p>
          {activeTemplates.length === 0 ? (
            <p className="text-[12px] text-zinc-500">No hay plantillas activas — crea una primero en Plantillas.</p>
          ) : (
            <div className="flex gap-2.5 items-center">
              <select
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">Elegir plantilla…</option>
                {activeTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button
                onClick={handleAssign}
                disabled={!selectedTemplateId || assigning}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[13px] font-semibold hover:bg-indigo-500 disabled:opacity-60 cursor-pointer"
              >
                {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Asignar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border border-zinc-700/50 rounded-xl px-4 py-3.5 bg-zinc-800/40">
            <div>
              <div className="text-[11px] text-zinc-500 uppercase tracking-wide">Plantilla asignada</div>
              <div className="text-[15px] font-bold text-white">{site.template.name}</div>
            </div>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-800/50 rounded-lg text-[12px] text-red-400 hover:bg-red-900/20 disabled:opacity-50 cursor-pointer"
            >
              {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Quitar plantilla
            </button>
          </div>

          <div>
            <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide mb-2">
              Secciones — el cambio se ve en la página real al refrescarla
            </div>
            {/* SectionCard usa los tokens de tema claro del ERP (bg-card, text-foreground...) —
                lo envolvemos en un fondo claro para que no choque con el panel oscuro de plataforma. */}
            <div className="bg-white rounded-xl p-3.5 flex flex-col gap-2.5">
              {[...site.siteSections].sort((a, b) => a.sortOrder - b.sortOrder).map((section, i) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  index={i}
                  total={site.siteSections.length}
                  reordering={reordering}
                  onSave={content => handleSaveSection(section.id, { content })}
                  onToggleActive={active => handleSaveSection(section.id, { isActive: active })}
                  onMove={direction => handleMoveSection(section.id, direction)}
                  onUploadImage={handleUploadImage}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
