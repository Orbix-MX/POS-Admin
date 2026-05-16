import { useState, useEffect } from 'react'
import { fetchSettings, updateSettings, type TenantSettings } from '@/services/core/configuracion-service'
import { Loader2 } from 'lucide-react'

export function Configuracion() {
  const [activeSection, setActiveSection] = useState("empresa")
  const sections = [
    { id: "empresa",       label: "Empresa" },
    { id: "pos",          label: "POS / Caja" },
    { id: "facturacion",  label: "Facturación" },
    { id: "notificaciones", label: "Notificaciones" },
  ]

  // ---- POS settings ----
  const [posSettings, setPosSettings] = useState<TenantSettings>({})
  const [posLoading, setPosLoading]   = useState(false)
  const [posSaving, setPosSaving]     = useState(false)
  const [posSaved, setPosSaved]       = useState(false)
  const [posError, setPosError]       = useState<string | null>(null)

  useEffect(() => {
    if (activeSection !== 'pos') return
    setPosLoading(true)
    fetchSettings()
      .then(s => setPosSettings(s))
      .catch(() => setPosError('Error al cargar configuración'))
      .finally(() => setPosLoading(false))
  }, [activeSection])

  async function handleSavePosSettings() {
    setPosSaving(true)
    setPosError(null)
    setPosSaved(false)
    try {
      const updated = await updateSettings(posSettings)
      setPosSettings(updated)
      setPosSaved(true)
      setTimeout(() => setPosSaved(false), 2500)
    } catch {
      setPosError('Error al guardar configuración')
    } finally {
      setPosSaving(false)
    }
  }

  return (
    <div className="p-7 flex gap-5">
      {/* Sidebar nav */}
      <div className="w-[180px] shrink-0">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Configuración</div>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`w-full text-left px-3 py-2 border-none rounded-lg text-[13px] cursor-pointer mb-0.5 transition-all
              ${activeSection === s.id ? 'font-semibold text-primary bg-secondary' : 'font-normal text-muted-foreground bg-transparent hover:bg-muted/50'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 bg-card border border-border rounded-xl p-7">

        {activeSection === "empresa" && (
          <div>
            <div className="text-base font-bold text-foreground mb-5">Datos de la Empresa</div>
            <div className="text-sm text-muted-foreground">Próximamente disponible.</div>
          </div>
        )}

        {activeSection === "pos" && (
          <div>
            <div className="text-base font-bold text-foreground mb-1">POS / Caja</div>
            <div className="text-xs text-muted-foreground mb-5">Configuración del punto de venta y sesiones de caja.</div>

            {posLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
              </div>
            ) : (
              <div className="max-w-sm flex flex-col gap-5">
                {/* cashChangeCurrency */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Moneda de cambio en efectivo
                  </label>
                  <select
                    value={posSettings.cashChangeCurrency ?? 'MXN'}
                    onChange={e => setPosSettings(p => ({ ...p, cashChangeCurrency: e.target.value as 'MXN' | 'USD' }))}
                    className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
                  >
                    <option value="MXN">MXN — Pesos mexicanos</option>
                    <option value="USD">USD — Dólares</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Define en qué moneda se entrega el cambio en efectivo, sin importar con qué monedas pague el cliente.
                  </p>
                </div>

                {posError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {posError}
                  </div>
                )}

                <button
                  onClick={handleSavePosSettings}
                  disabled={posSaving}
                  className="self-start px-5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60 flex items-center gap-2"
                >
                  {posSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</> : posSaved ? '✓ Guardado' : 'Guardar cambios'}
                </button>
              </div>
            )}
          </div>
        )}

        {(activeSection === "facturacion" || activeSection === "notificaciones") && (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-3xl mb-3">⚙️</div>
            <div className="text-sm font-semibold text-foreground mb-1.5">Módulo en configuración</div>
            <div className="text-xs">Esta sección estará disponible próximamente.</div>
          </div>
        )}
      </div>
    </div>
  )
}
