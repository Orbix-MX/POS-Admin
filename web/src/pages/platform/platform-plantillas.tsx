import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, LayoutTemplate, AlertTriangle, RefreshCw, X, Check, Pencil } from 'lucide-react'
import { fetchTemplates, createTemplate, updateTemplate } from '@/services/platform/platform-templates-service'
import type { Template } from '@/services/platform/platform-templates-service'

function errMessage(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error inesperado'
}

function CreateTemplateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: Template) => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    setError(null)
    try {
      const t = await createTemplate(name.trim())
      onCreated(t)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-[15px] font-semibold text-white flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-indigo-400" /> Nueva plantilla
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
        <div className="px-5 py-4">
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Nombre</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Aquascaping v1"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 outline-none focus:border-indigo-500"
            autoFocus
          />
          <p className="text-[11px] text-zinc-500 mt-2">
            El HTML de la plantilla es fijo (código Astro) — esto solo registra el nombre para poder asignarla a un tenant.
          </p>
          {error && <p className="text-[12px] text-red-400 mt-2">{error}</p>}
        </div>
        <div className="border-t border-zinc-800 px-5 py-3 flex justify-end gap-2.5">
          <button onClick={onClose} className="px-4 py-2 border border-zinc-700 rounded-lg text-[13px] text-zinc-400 hover:text-zinc-200 cursor-pointer">Cancelar</button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[13px] font-semibold hover:bg-indigo-500 disabled:opacity-60 cursor-pointer"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Crear
          </button>
        </div>
      </div>
    </div>
  )
}

function TemplateNameCell({ template, onRenamed }: { template: Template; onRenamed: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(template.name)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim() || name === template.name) { setEditing(false); setName(template.name); return }
    setSaving(true)
    try {
      await updateTemplate(template.id, { name: name.trim() })
      onRenamed()
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
        autoFocus
        disabled={saving}
        className="px-2 py-1 bg-zinc-900 border border-indigo-500 rounded text-[13px] text-zinc-100 outline-none"
      />
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-100 hover:text-white cursor-pointer bg-transparent border-none">
      {template.name} <Pencil className="w-3 h-3 text-zinc-600" />
    </button>
  )
}

export function PlatformPlantillas() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTemplates(await fetchTemplates())
    } catch {
      setError('Error al cargar plantillas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggleActive(t: Template) {
    setTogglingId(t.id)
    try {
      await updateTemplate(t.id, { isActive: !t.isActive })
      await load()
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Plantillas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            El HTML de cada plantilla es fijo (código Astro) — aquí solo se registran y se activan/desactivan. Se asignan a un tenant desde el detalle de su empresa, y el contenido se llena desde ahí.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 rounded-lg text-[13px] text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 bg-transparent cursor-pointer transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[13px] font-semibold hover:bg-indigo-500 transition-colors border-none cursor-pointer">
            <Plus className="w-4 h-4" /> Nueva plantilla
          </button>
        </div>
      </div>

      <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-red-400 text-[13px]">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-500">
            <LayoutTemplate className="w-10 h-10 opacity-30" />
            <span className="text-[13px]">Sin plantillas creadas todavía</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700/50">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Plantilla</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Tenants usándola</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Estado</th>
                <th className="text-right px-5 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} className="border-b border-zinc-700/30 hover:bg-zinc-700/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <TemplateNameCell template={t} onRenamed={load} />
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-zinc-300">{t._count?.tenantSites ?? 0}</td>
                  <td className="px-4 py-3.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.isActive ? 'bg-green-900/40 text-green-400' : 'bg-zinc-700 text-zinc-400'}`}>
                      {t.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleToggleActive(t)}
                      disabled={togglingId === t.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700 rounded-lg text-[12px] text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-50 cursor-pointer"
                    >
                      {togglingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      {t.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateTemplateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}
