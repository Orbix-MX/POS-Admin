import { useState, useEffect, useRef } from 'react'
import { fetchSettings, updateSettings, type TenantSettings } from '@/services/core/configuracion-service'
import {
  fetchTenantInfo, updateTenantInfo, uploadTenantLogo, uploadTenantBanner,
  deleteTenantLogo, deleteTenantBanner, type TenantInfo,
} from '@/services/core/tenant-service'
import { useERPStore } from '@/store/erp-store'
import { useAuthStore } from '@/store/auth-store'
import { Loader2, Upload, Trash2, Building2 } from 'lucide-react'

export function Configuracion() {
  const [activeSection, setActiveSection] = useState("empresa")
  const sections = [
    { id: "empresa",         label: "Empresa" },
    { id: "pos",             label: "POS / Caja" },
    { id: "facturacion",     label: "Facturación" },
    { id: "notificaciones",  label: "Notificaciones" },
  ]

  // ─── Empresa / Branding ───────────────────────────────────────────────────
  const { setTenantBranding, loadTenantBranding } = useERPStore()
  const { permissions, user } = useAuthStore()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const canEdit     = isSuperAdmin || permissions.includes('tenant:edit')
  const canBranding = isSuperAdmin || permissions.includes('tenant:branding')

  const [info, setInfo]           = useState<TenantInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoSaving, setInfoSaving]   = useState(false)
  const [infoSaved, setInfoSaved]     = useState(false)
  const [infoError, setInfoError]     = useState<string | null>(null)

  const [logoUploading, setLogoUploading]     = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [imageError, setImageError]           = useState<string | null>(null)

  const logoRef   = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (activeSection !== 'empresa') return
    setInfoLoading(true)
    fetchTenantInfo()
      .then(setInfo)
      .catch(() => setInfoError('Error al cargar información de empresa'))
      .finally(() => setInfoLoading(false))
  }, [activeSection])

  function setField(field: keyof TenantInfo, value: string) {
    setInfo(p => p ? { ...p, [field]: value } : p)
  }

  async function handleSaveInfo() {
    if (!info) return
    setInfoSaving(true)
    setInfoError(null)
    setInfoSaved(false)
    try {
      const updated = await updateTenantInfo(info)
      setInfo(updated)
      setTenantBranding(updated)
      setInfoSaved(true)
      setTimeout(() => setInfoSaved(false), 2500)
    } catch {
      setInfoError('Error al guardar información')
    } finally {
      setInfoSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError(null)
    setLogoUploading(true)
    try {
      const { logoUrl } = await uploadTenantLogo(file)
      setInfo(p => p ? { ...p, logoUrl } : p)
      await loadTenantBranding()
    } catch {
      setImageError('Error al subir logo')
    } finally {
      setLogoUploading(false)
      if (logoRef.current) logoRef.current.value = ''
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError(null)
    setBannerUploading(true)
    try {
      const { bannerUrl } = await uploadTenantBanner(file)
      setInfo(p => p ? { ...p, bannerUrl } : p)
      await loadTenantBranding()
    } catch {
      setImageError('Error al subir banner')
    } finally {
      setBannerUploading(false)
      if (bannerRef.current) bannerRef.current.value = ''
    }
  }

  async function handleDeleteLogo() {
    if (!confirm('¿Eliminar logo?')) return
    setImageError(null)
    setLogoUploading(true)
    try {
      await deleteTenantLogo()
      setInfo(p => p ? { ...p, logoUrl: undefined } : p)
      await loadTenantBranding()
    } catch {
      setImageError('Error al eliminar logo')
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleDeleteBanner() {
    if (!confirm('¿Eliminar banner?')) return
    setImageError(null)
    setBannerUploading(true)
    try {
      await deleteTenantBanner()
      setInfo(p => p ? { ...p, bannerUrl: undefined } : p)
      await loadTenantBranding()
    } catch {
      setImageError('Error al eliminar banner')
    } finally {
      setBannerUploading(false)
    }
  }

  // ─── POS settings ────────────────────────────────────────────────────────
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

        {/* ── EMPRESA ─────────────────────────────────────────────────────── */}
        {activeSection === "empresa" && (
          <div>
            <div className="text-base font-bold text-foreground mb-1">Información de la Empresa</div>
            <div className="text-xs text-muted-foreground mb-6">
              Branding, datos de contacto y configuración general.
            </div>

            {infoLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
              </div>
            ) : (
              <div className="flex flex-col gap-7 max-w-2xl">

                {/* ── BRANDING IMAGES ────────────────────────────────────── */}
                {canBranding && (
                  <div>
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-3">
                      Branding Visual
                    </div>
                    <div className="grid grid-cols-2 gap-4">

                      {/* Logo */}
                      <div>
                        <div className="text-xs font-semibold text-foreground mb-2">Logo</div>
                        <div className="relative rounded-xl border border-border bg-muted/20 overflow-hidden flex items-center justify-center"
                          style={{ height: 120 }}>
                          {info?.logoUrl ? (
                            <>
                              <img src={info.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-3" />
                              {!logoUploading && (
                                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => logoRef.current?.click()}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs border border-white/20"
                                  >
                                    <Upload className="w-3 h-3" /> Reemplazar
                                  </button>
                                  <button
                                    onClick={handleDeleteLogo}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/70 hover:bg-destructive/90 text-white text-xs border border-destructive/40"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => logoRef.current?.click()}
                              disabled={logoUploading}
                              className="flex flex-col items-center gap-2 p-4 text-center cursor-pointer disabled:cursor-not-allowed w-full h-full"
                            >
                              <Building2 className="w-8 h-8 text-muted-foreground/30" />
                              <span className="text-xs text-muted-foreground">Subir logo</span>
                              <span className="text-[10px] text-muted-foreground/60">PNG, JPG, WebP · 400×400</span>
                            </button>
                          )}
                          {logoUploading && (
                            <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
                          )}
                        </div>
                        <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp"
                          className="hidden" onChange={handleLogoUpload} />
                        {!info?.logoUrl && (
                          <button
                            onClick={() => logoRef.current?.click()}
                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors cursor-pointer"
                          >
                            <Upload className="w-3 h-3" /> Subir logo
                          </button>
                        )}
                      </div>

                      {/* Banner */}
                      <div>
                        <div className="text-xs font-semibold text-foreground mb-2">Banner / Imagen representativa</div>
                        <div className="relative rounded-xl border border-border bg-muted/20 overflow-hidden flex items-center justify-center"
                          style={{ height: 120 }}>
                          {info?.bannerUrl ? (
                            <>
                              <img src={info.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                              {!bannerUploading && (
                                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => bannerRef.current?.click()}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs border border-white/20"
                                  >
                                    <Upload className="w-3 h-3" /> Reemplazar
                                  </button>
                                  <button
                                    onClick={handleDeleteBanner}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/70 hover:bg-destructive/90 text-white text-xs border border-destructive/40"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => bannerRef.current?.click()}
                              disabled={bannerUploading}
                              className="flex flex-col items-center gap-2 p-4 text-center cursor-pointer disabled:cursor-not-allowed w-full h-full"
                            >
                              <Building2 className="w-8 h-8 text-muted-foreground/30" />
                              <span className="text-xs text-muted-foreground">Subir banner</span>
                              <span className="text-[10px] text-muted-foreground/60">PNG, JPG, WebP · 1200px</span>
                            </button>
                          )}
                          {bannerUploading && (
                            <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
                          )}
                        </div>
                        <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp"
                          className="hidden" onChange={handleBannerUpload} />
                        {!info?.bannerUrl && (
                          <button
                            onClick={() => bannerRef.current?.click()}
                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors cursor-pointer"
                          >
                            <Upload className="w-3 h-3" /> Subir banner
                          </button>
                        )}
                      </div>
                    </div>

                    {imageError && (
                      <p className="text-xs text-destructive mt-2">{imageError}</p>
                    )}
                  </div>
                )}

                {/* ── DATOS GENERALES ─────────────────────────────────────── */}
                <div>
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-3">
                    Datos Generales
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                    <Field label="Nombre empresa" value={info?.name ?? ''} disabled={!canEdit}
                      onChange={v => setField('name', v)} />
                    <Field label="Nombre a mostrar" value={info?.displayName ?? ''} disabled={!canEdit}
                      onChange={v => setField('displayName', v)} placeholder="Alias o nombre corto" />
                    <Field label="RFC" value={info?.rfc ?? ''} disabled={!canEdit}
                      onChange={v => setField('rfc', v)} />
                    <Field label="Teléfono" value={info?.phone ?? ''} disabled={!canEdit}
                      onChange={v => setField('phone', v)} />
                    <Field label="Email" type="email" value={info?.email ?? ''} disabled={!canEdit}
                      onChange={v => setField('email', v)} />
                    <Field label="Moneda base" value={info?.currency ?? ''} disabled={!canEdit}
                      onChange={v => setField('currency', v)} placeholder="MXN" />
                    <div className="col-span-2">
                      <Field label="Dirección" value={info?.address ?? ''} disabled={!canEdit}
                        onChange={v => setField('address', v)} />
                    </div>
                    <div className="col-span-2">
                      <Field label="Zona horaria" value={info?.timezone ?? ''} disabled={!canEdit}
                        onChange={v => setField('timezone', v)} placeholder="America/Mexico_City" />
                    </div>
                  </div>
                </div>

                {infoError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {infoError}
                  </div>
                )}

                {canEdit && (
                  <button
                    onClick={handleSaveInfo}
                    disabled={infoSaving}
                    className="self-start px-5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60 flex items-center gap-2"
                  >
                    {infoSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</> : infoSaved ? '✓ Guardado' : 'Guardar cambios'}
                  </button>
                )}

                {!canEdit && (
                  <p className="text-xs text-muted-foreground">Sin permiso para editar información de empresa.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── POS ─────────────────────────────────────────────────────────── */}
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
                    Define en qué moneda se entrega el cambio en efectivo.
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

function Field({
  label, value, onChange, disabled = false, type = 'text', placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  )
}
