import { useState, useCallback } from 'react'
import { X, Loader2, Check, Building2, GitBranch, User, Package } from 'lucide-react'
import { provisionTenant } from '@/services/platform/platform-tenants-service'
import type { TenantPlan } from '@/services/platform/platform-tenants-service'

type Step = 'empresa' | 'plan' | 'sucursal' | 'admin'

const STEPS: { key: Step; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'empresa',  label: 'Empresa',   icon: Building2 },
  { key: 'plan',     label: 'Plan',      icon: Package   },
  { key: 'sucursal', label: 'Sucursal',  icon: GitBranch },
  { key: 'admin',    label: 'Administrador', icon: User  },
]

const PLANS: { value: TenantPlan; label: string; desc: string; color: string }[] = [
  { value: 'FREE',       label: 'Free',       desc: 'Funciones básicas, 1 usuario, 1 sucursal', color: 'border-zinc-600 hover:border-zinc-500' },
  { value: 'STARTER',    label: 'Starter',    desc: 'Hasta 5 usuarios, 2 sucursales',           color: 'border-sky-600/50 hover:border-sky-500' },
  { value: 'PRO',        label: 'Pro',        desc: 'Hasta 15 usuarios, 5 sucursales',          color: 'border-indigo-600/50 hover:border-indigo-500' },
  { value: 'PLUS',       label: 'Plus',       desc: 'Hasta 50 usuarios, ilimitadas sucursales', color: 'border-purple-600/50 hover:border-purple-500' },
  { value: 'ENTERPRISE', label: 'Enterprise', desc: 'Sin límites, SLA dedicado',                color: 'border-amber-600/50 hover:border-amber-500' },
]

const PLAN_COLORS_SELECTED: Record<TenantPlan, string> = {
  FREE:       'border-zinc-400 bg-zinc-700/30',
  STARTER:    'border-sky-500 bg-sky-500/10',
  PRO:        'border-indigo-500 bg-indigo-500/10',
  PLUS:       'border-purple-500 bg-purple-500/10',
  ENTERPRISE: 'border-amber-500 bg-amber-500/10',
}

interface Props {
  onClose: () => void
  onSuccess: () => void
}

type EmpresaForm = { name: string; slug: string }
type SucursalForm = { name: string; code: string; address: string; city: string; state: string; zipCode: string; phone: string }
type AdminForm = { firstName: string; lastName: string; email: string; password: string }

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function errMessage(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error inesperado'
}

export function PlatformProvisionModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('empresa')
  const [empresa, setEmpresa] = useState<EmpresaForm>({ name: '', slug: '' })
  const [plan, setPlan] = useState<TenantPlan>('PRO')
  const [trialDays, setTrialDays] = useState<number | ''>('')
  const [sucursal, setSucursal] = useState<SucursalForm>({ name: '', code: '', address: '', city: '', state: '', zipCode: '', phone: '' })
  const [admin, setAdmin] = useState<AdminForm>({ firstName: '', lastName: '', email: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const stepIndex = STEPS.findIndex(s => s.key === step)

  const handleNameBlur = useCallback(() => {
    if (!empresa.slug && empresa.name) {
      setEmpresa(p => ({ ...p, slug: slugify(p.name) }))
    }
  }, [empresa.name, empresa.slug])

  const canNext = useCallback((): boolean => {
    if (step === 'empresa') return !!empresa.name.trim() && !!empresa.slug.trim()
    if (step === 'plan') return !!plan
    if (step === 'sucursal') return !!sucursal.name.trim() && !!sucursal.code.trim()
    if (step === 'admin') return !!admin.firstName.trim() && !!admin.lastName.trim() && !!admin.email.trim() && admin.password.length >= 8
    return false
  }, [step, empresa, plan, sucursal, admin])

  const goNext = () => {
    const idx = stepIndex
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key)
  }

  const goBack = () => {
    const idx = stepIndex
    if (idx > 0) setStep(STEPS[idx - 1].key)
  }

  const handleSubmit = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await provisionTenant({
        tenant: { name: empresa.name, slug: empresa.slug, plan },
        branch: {
          name: sucursal.name,
          code: sucursal.code,
          address: sucursal.address || undefined,
          city: sucursal.city || undefined,
          state: sucursal.state || undefined,
          zipCode: sucursal.zipCode || undefined,
          phone: sucursal.phone || undefined,
        },
        adminUser: { ...admin },
        trialDays: trialDays ? Number(trialDays) : undefined,
      })
      setSuccess(true)
      setTimeout(onSuccess, 1200)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setSaving(false)
    }
  }, [empresa, plan, trialDays, sucursal, admin, onSuccess])

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 w-full max-w-[400px] flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="text-[16px] font-bold text-white">¡Empresa creada!</div>
          <div className="text-[13px] text-zinc-400 text-center">
            <span className="text-zinc-200 font-semibold">{empresa.name}</span> fue aprovisionada correctamente.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-[580px] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <div className="text-[15px] font-bold text-white">Nueva empresa</div>
            <div className="text-[12px] text-zinc-500">Alta completa de tenant</div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 py-4 gap-2 border-b border-zinc-800">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isDone = i < stepIndex
            const isActive = i === stepIndex
            return (
              <div key={s.key} className="flex items-center gap-1.5 flex-1">
                <div className={`flex items-center gap-1.5 ${isActive ? 'opacity-100' : isDone ? 'opacity-70' : 'opacity-30'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                    ${isDone ? 'bg-emerald-500/20 text-emerald-400' : isActive ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}
                  >
                    {isDone ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  </div>
                  <span className={`text-[11px] font-medium ${isActive ? 'text-zinc-200' : 'text-zinc-500'}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-1 ${i < stepIndex ? 'bg-emerald-500/40' : 'bg-zinc-700'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[300px]">
          {/* Step 1: Empresa */}
          {step === 'empresa' && (
            <div className="flex flex-col gap-4">
              <div className="text-[13px] font-bold text-zinc-300 mb-1">Datos de la empresa</div>
              <div>
                <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Nombre de la empresa *</label>
                <input
                  value={empresa.name}
                  onChange={e => setEmpresa(p => ({ ...p, name: e.target.value }))}
                  onBlur={handleNameBlur}
                  placeholder="Mi Empresa S.A. de C.V."
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Slug (URL único) *</label>
                <input
                  value={empresa.slug}
                  onChange={e => setEmpresa(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="mi-empresa"
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500 font-mono"
                />
                <div className="text-[11px] text-zinc-600 mt-1">Solo letras minúsculas, números y guiones</div>
              </div>
            </div>
          )}

          {/* Step 2: Plan */}
          {step === 'plan' && (
            <div className="flex flex-col gap-3">
              <div className="text-[13px] font-bold text-zinc-300 mb-1">Seleccionar plan</div>
              {PLANS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPlan(p.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all cursor-pointer
                    ${plan === p.value ? PLAN_COLORS_SELECTED[p.value] : `border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 ${p.color}`}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-bold text-zinc-100">{p.label}</div>
                    {plan === p.value && <Check className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{p.desc}</div>
                </button>
              ))}
              <div className="mt-2">
                <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Días de trial (opcional)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={trialDays}
                  onChange={e => setTrialDays(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Sin trial"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Step 3: Sucursal */}
          {step === 'sucursal' && (
            <div className="flex flex-col gap-4">
              <div className="text-[13px] font-bold text-zinc-300 mb-1">Sucursal principal</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Nombre *</label>
                  <input
                    value={sucursal.name}
                    onChange={e => setSucursal(p => ({ ...p, name: e.target.value }))}
                    placeholder="Sucursal Principal"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Código *</label>
                  <input
                    value={sucursal.code}
                    onChange={e => setSucursal(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="SUC-01"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Teléfono</label>
                  <input
                    value={sucursal.phone}
                    onChange={e => setSucursal(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+52 55 0000 0000"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Dirección</label>
                  <input
                    value={sucursal.address}
                    onChange={e => setSucursal(p => ({ ...p, address: e.target.value }))}
                    placeholder="Calle, número, colonia"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Ciudad</label>
                  <input
                    value={sucursal.city}
                    onChange={e => setSucursal(p => ({ ...p, city: e.target.value }))}
                    placeholder="Ciudad de México"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Estado</label>
                  <input
                    value={sucursal.state}
                    onChange={e => setSucursal(p => ({ ...p, state: e.target.value }))}
                    placeholder="CDMX"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Admin */}
          {step === 'admin' && (
            <div className="flex flex-col gap-4">
              <div className="text-[13px] font-bold text-zinc-300 mb-1">Usuario administrador principal</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Nombre *</label>
                  <input
                    value={admin.firstName}
                    onChange={e => setAdmin(p => ({ ...p, firstName: e.target.value }))}
                    placeholder="Juan"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Apellido *</label>
                  <input
                    value={admin.lastName}
                    onChange={e => setAdmin(p => ({ ...p, lastName: e.target.value }))}
                    placeholder="García"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={admin.email}
                    onChange={e => setAdmin(p => ({ ...p, email: e.target.value }))}
                    placeholder="admin@empresa.com"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">Contraseña temporal * (mín. 8 caracteres)</label>
                  <input
                    type="password"
                    value={admin.password}
                    onChange={e => setAdmin(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
          <div className="text-[12px] text-red-400">{error ?? ''}</div>
          <div className="flex gap-2">
            {stepIndex > 0 ? (
              <button
                onClick={goBack}
                disabled={saving}
                className="px-4 py-2 text-[13px] text-zinc-400 border border-zinc-700 rounded-lg bg-transparent cursor-pointer hover:border-zinc-600 disabled:opacity-50"
              >
                Atrás
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 text-[13px] text-zinc-400 border border-zinc-700 rounded-lg bg-transparent cursor-pointer hover:border-zinc-600"
              >
                Cancelar
              </button>
            )}
            {stepIndex < STEPS.length - 1 ? (
              <button
                onClick={goNext}
                disabled={!canNext()}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving || !canNext()}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Crear empresa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
