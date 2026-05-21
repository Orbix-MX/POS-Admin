import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Loader2, Building2, GitBranch, Users, Package, Activity,
  AlertTriangle, Plus, X, Check, LayoutDashboard,
} from 'lucide-react'
import { DashboardsTab } from './platform-dashboards-tab'
import {
  fetchTenant, fetchTenantAudit, updateTenantPlan, updateTenantModules, updateTenantLimits,
  fetchTenantBranches, createTenantBranch, updateTenantBranchStatus, updateTenantBranchLimits,
} from '@/services/platform/platform-tenants-service'
import type {
  PlatformTenant, TenantPlan, PlatformAuditLog,
  PlatformBranch, BranchCapacity, BranchStatus, CreateBranchInput,
} from '@/services/platform/platform-tenants-service'
import { TenantStatusBadge, TenantPlanBadge } from '@/components/platform/tenant-status-badge'

type FullTenant = PlatformTenant & {
  branches: { id: string; name: string; code: string; status: string; isMain: boolean }[]
  _count: { memberships: number; orders: number; products: number }
}

const PLANS: TenantPlan[] = ['FREE', 'STARTER', 'PRO', 'PLUS', 'ENTERPRISE']

const ALL_MODULES = [
  'dashboard', 'ventas', 'compras', 'inventario', 'clientes', 'proveedores',
  'cxc', 'cxp', 'caja', 'reportes', 'servicios', 'cotizaciones', 'empleados',
]

const BRANCH_STATUS_OPTIONS: BranchStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED']

const STATUS_COLORS: Record<BranchStatus, string> = {
  ACTIVE:    'bg-emerald-500/15 text-emerald-400',
  INACTIVE:  'bg-zinc-700 text-zinc-400',
  SUSPENDED: 'bg-amber-500/15 text-amber-400',
  CLOSED:    'bg-red-500/15 text-red-400',
}

function errMessage(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error inesperado'
}

// ─── Create Branch Modal ──────────────────────────────────────────────────────

interface CreateBranchModalProps {
  tenantId: string
  onCreated: () => void
  onClose: () => void
}

function CreateBranchModal({ tenantId, onCreated, onClose }: CreateBranchModalProps) {
  const [form, setForm] = useState<CreateBranchInput>({ name: '', code: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!form.name || !form.code) return
    setSaving(true); setError(null)
    try {
      await createTenantBranch(tenantId, form)
      onCreated()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof CreateBranchInput, required = false) => (
    <div>
      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">{label}{required && ' *'}</label>
      <input
        value={form[key] ?? ''}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[480px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-bold text-zinc-200">Nueva sucursal</div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-900/60 rounded-lg text-[12px] text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {field('Nombre', 'name', true)}
          {field('Código', 'code', true)}
          {field('Dirección', 'address')}
          {field('Ciudad', 'city')}
          {field('Estado', 'state')}
          {field('Código postal', 'zipCode')}
          {field('Teléfono', 'phone')}
          {field('Email', 'email')}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.name || !form.code}
            className="px-4 py-2 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg border-none cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Crear
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function PlatformEmpresaDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [tenant, setTenant] = useState<FullTenant | null>(null)
  const [audit, setAudit] = useState<PlatformAuditLog[]>([])
  const [branches, setBranches] = useState<PlatformBranch[]>([])
  const [capacity, setCapacity] = useState<BranchCapacity | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'sucursales' | 'modulos' | 'limites' | 'dashboards' | 'auditoria'>('info')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)
  const [showCreateBranch, setShowCreateBranch] = useState(false)

  // Plan change state
  const [newPlan, setNewPlan] = useState<TenantPlan | ''>('')

  // Modules state
  const [selectedModules, setSelectedModules] = useState<string[]>([])

  // Limits state
  const [userLimit, setUserLimit] = useState<number | ''>('')
  const [extraBranchLimit, setExtraBranchLimit] = useState<number>(0)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [t, a] = await Promise.all([fetchTenant(id), fetchTenantAudit(id)])
      setTenant(t)
      setAudit(a.data)
      setNewPlan(t.plan)
      setSelectedModules(t.enabledModules)
      setUserLimit(t.userLimitOverride ?? '')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadBranches = useCallback(async () => {
    if (!id) return
    const result = await fetchTenantBranches(id)
    setBranches(result.branches)
    setCapacity(result.capacity)
    setExtraBranchLimit(result.capacity.extraBranchLimit)
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (activeTab === 'sucursales') loadBranches()
  }, [activeTab, loadBranches])

  const flash = useCallback((ok: boolean) => {
    if (ok) { setSaveOk(true); setTimeout(() => setSaveOk(false), 2000) }
  }, [])

  const handlePlanSave = useCallback(async () => {
    if (!id || !newPlan) return
    setSaving(true); setSaveError(null)
    try {
      await updateTenantPlan(id, newPlan as TenantPlan)
      await load(); flash(true)
    } catch (e) { setSaveError(errMessage(e)) }
    finally { setSaving(false) }
  }, [id, newPlan, load, flash])

  const handleModulesSave = useCallback(async () => {
    if (!id) return
    setSaving(true); setSaveError(null)
    try {
      await updateTenantModules(id, selectedModules)
      await load(); flash(true)
    } catch (e) { setSaveError(errMessage(e)) }
    finally { setSaving(false) }
  }, [id, selectedModules, load, flash])

  const handleLimitsSave = useCallback(async () => {
    if (!id) return
    setSaving(true); setSaveError(null)
    try {
      await updateTenantLimits(id, userLimit !== '' ? Number(userLimit) : null)
      await load(); flash(true)
    } catch (e) { setSaveError(errMessage(e)) }
    finally { setSaving(false) }
  }, [id, userLimit, load, flash])

  const handleBranchLimitsSave = useCallback(async () => {
    if (!id) return
    setSaving(true); setSaveError(null)
    try {
      await updateTenantBranchLimits(id, extraBranchLimit)
      await loadBranches(); flash(true)
    } catch (e) { setSaveError(errMessage(e)) }
    finally { setSaving(false) }
  }, [id, extraBranchLimit, loadBranches, flash])

  const handleBranchStatus = useCallback(async (branchId: string, status: BranchStatus) => {
    if (!id) return
    setSaveError(null)
    try {
      await updateTenantBranchStatus(id, branchId, status)
      await loadBranches()
    } catch (e) { setSaveError(errMessage(e)) }
  }, [id, loadBranches])

  const toggleModule = useCallback((mod: string) => {
    setSelectedModules(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    )
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!tenant) return null

  const TABS = [
    { key: 'info',        label: 'Información',  icon: null },
    { key: 'sucursales',  label: 'Sucursales',   icon: null },
    { key: 'modulos',     label: 'Módulos',      icon: null },
    { key: 'limites',     label: 'Límites',      icon: null },
    { key: 'dashboards',  label: 'Dashboards',   icon: LayoutDashboard },
    { key: 'auditoria',   label: 'Auditoría',    icon: null },
  ] as const

  const activeBranchCount = capacity?.activeBranches ?? tenant.branches.filter(b => b.status === 'ACTIVE').length
  const maxBranchCount = capacity?.maxBranches ?? null
  const capacityPct = maxBranchCount ? Math.min((activeBranchCount / maxBranchCount) * 100, 100) : 0

  return (
    <div className="p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/platform/empresas')}
          className="text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer p-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-white">{tenant.name}</h1>
            <TenantStatusBadge status={tenant.status} />
            <TenantPlanBadge plan={tenant.plan} />
          </div>
          <div className="text-[12px] text-zinc-500 mt-0.5">/{tenant.slug} · {tenant.id}</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: Users,     label: 'Usuarios',   value: tenant._count.memberships },
          { icon: GitBranch, label: 'Sucursales',  value: tenant.branches.length   },
          { icon: Package,   label: 'Productos',   value: tenant._count.products   },
          { icon: Building2, label: 'Pedidos',     value: tenant._count.orders     },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-4 flex items-center gap-3">
            <Icon className="w-5 h-5 text-zinc-500" />
            <div>
              <div className="text-xl font-bold text-white">{value}</div>
              <div className="text-[11px] text-zinc-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-700/50">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors bg-transparent cursor-pointer
              ${activeTab === t.key
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
          >
            {t.icon && <t.icon className="w-3.5 h-3.5" />}
            {t.label}
          </button>
        ))}
      </div>

      {/* Save feedback */}
      {saveError && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-950/40 border border-red-900/60 rounded-lg text-[13px] text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {saveError}
        </div>
      )}
      {saveOk && (
        <div className="px-4 py-2.5 bg-emerald-950/40 border border-emerald-900/60 rounded-lg text-[13px] text-emerald-400">
          Cambios guardados correctamente
        </div>
      )}

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-5 flex flex-col gap-3">
            <div className="text-[13px] font-bold text-zinc-300 mb-1">General</div>
            {[
              ['Nombre', tenant.name],
              ['Slug', tenant.slug],
              ['Estado', tenant.status],
              ['Plan', tenant.plan],
              ['Creada', new Date(tenant.createdAt).toLocaleDateString('es-MX')],
              ['Trial ends', tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString('es-MX') : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-[13px]">
                <span className="text-zinc-500">{k}</span>
                <span className="text-zinc-200 font-medium">{v}</span>
              </div>
            ))}
          </div>

          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-5">
            <div className="text-[13px] font-bold text-zinc-300 mb-3">Sucursales ({tenant.branches.length})</div>
            {tenant.branches.length === 0 ? (
              <div className="text-[13px] text-zinc-600">Sin sucursales registradas</div>
            ) : (
              <div className="flex flex-col gap-2">
                {tenant.branches.map(b => (
                  <div key={b.id} className="flex items-center justify-between py-2 border-b border-zinc-700/40 last:border-0">
                    <div>
                      <div className="text-[13px] text-zinc-200 font-medium">{b.name}</div>
                      <div className="text-[11px] text-zinc-500 font-mono">{b.code}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {b.isMain && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/15 text-indigo-400 rounded">Principal</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        b.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-700 text-zinc-400'
                      }`}>{b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-5">
            <div className="text-[13px] font-bold text-zinc-300 mb-3">Cambiar plan</div>
            <select
              value={newPlan}
              onChange={e => setNewPlan(e.target.value as TenantPlan)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 outline-none focus:border-indigo-500 mb-3 cursor-pointer"
            >
              {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button
              onClick={handlePlanSave}
              disabled={saving || newPlan === tenant.plan}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-semibold rounded-lg border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar plan
            </button>
          </div>
        </div>
      )}

      {/* Tab: Sucursales */}
      {activeTab === 'sucursales' && (
        <div className="flex flex-col gap-4">
          {/* Capacity bar */}
          {capacity && (
            <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[13px] font-bold text-zinc-300">Capacidad de sucursales</div>
                <div className="text-[13px] font-mono text-zinc-300">
                  {capacity.activeBranches}
                  <span className="text-zinc-600"> / </span>
                  {capacity.maxBranches ?? '∞'}
                </div>
              </div>
              {capacity.maxBranches && (
                <div className="h-2 bg-zinc-700/60 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${capacityPct >= 100 ? 'bg-red-500' : capacityPct >= 75 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                    style={{ width: `${capacityPct}%` }}
                  />
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className="text-[12px] text-zinc-500">
                  Límite del plan: <span className="text-zinc-300">{capacity.maxBranches ?? '∞'}</span>
                </div>
                <div className="text-[12px] text-zinc-500">
                  Extra concedido: <span className="text-zinc-300">+{capacity.extraBranchLimit}</span>
                </div>
                {!capacity.hasCapacity && (
                  <span className="text-[11px] px-2 py-0.5 bg-red-500/15 text-red-400 rounded-full">Sin capacidad</span>
                )}
              </div>

              {/* Extra limit controls */}
              <div className="mt-4 pt-4 border-t border-zinc-700/40 flex items-center gap-3">
                <div className="text-[12px] font-semibold text-zinc-400">Sucursales extra:</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExtraBranchLimit(v => Math.max(0, v - 1))}
                    className="w-7 h-7 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg text-[14px] border-none cursor-pointer"
                  >−</button>
                  <span className="text-[14px] font-bold text-zinc-200 min-w-[24px] text-center">{extraBranchLimit}</span>
                  <button
                    onClick={() => setExtraBranchLimit(v => v + 1)}
                    className="w-7 h-7 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg text-[14px] border-none cursor-pointer"
                  >+</button>
                </div>
                <button
                  onClick={handleBranchLimitsSave}
                  disabled={saving || extraBranchLimit === capacity.extraBranchLimit}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold rounded-lg border-none cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* Branch list */}
          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-700/50 flex items-center justify-between">
              <div className="text-[13px] font-bold text-zinc-300">
                Sucursales ({branches.length})
              </div>
              <button
                onClick={() => setShowCreateBranch(true)}
                disabled={capacity ? !capacity.hasCapacity : false}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold rounded-lg border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" /> Nueva sucursal
              </button>
            </div>

            {branches.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-zinc-600 text-[13px]">
                Sin sucursales registradas
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-700/40">
                    <th className="text-left px-5 py-2.5 text-[11px] font-bold text-zinc-600 uppercase">Nombre</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-zinc-600 uppercase">Código</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-zinc-600 uppercase">Ciudad</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-zinc-600 uppercase">Estado</th>
                    <th className="text-right px-5 py-2.5 text-[11px] font-bold text-zinc-600 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map(branch => (
                    <tr key={branch.id} className="border-b border-zinc-700/20 hover:bg-zinc-700/10">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-zinc-200 font-medium">{branch.name}</span>
                          {branch.isMain && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/15 text-indigo-400 rounded">Principal</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] font-mono text-zinc-400">{branch.code}</td>
                      <td className="px-4 py-3 text-[12px] text-zinc-400">{branch.city ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[branch.status]}`}>
                          {branch.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {branch.status !== 'ACTIVE' && (
                            <button
                              onClick={() => handleBranchStatus(branch.id, 'ACTIVE')}
                              className="text-[11px] px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg border border-emerald-600/30 cursor-pointer"
                            >
                              Activar
                            </button>
                          )}
                          {branch.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleBranchStatus(branch.id, 'SUSPENDED')}
                              className="text-[11px] px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/20 cursor-pointer"
                            >
                              Suspender
                            </button>
                          )}
                          {branch.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleBranchStatus(branch.id, 'INACTIVE')}
                              className="text-[11px] px-2.5 py-1 bg-zinc-700/50 hover:bg-zinc-700 text-zinc-400 rounded-lg border border-zinc-600/50 cursor-pointer"
                            >
                              Desactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Módulos */}
      {activeTab === 'modulos' && (
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-6">
          <div className="text-[13px] font-bold text-zinc-300 mb-4">Módulos habilitados extra</div>
          <div className="text-[12px] text-zinc-500 mb-4">
            Estos módulos se habilitan ADEMÁS de los incluidos en el plan. Los módulos del plan no se pueden deshabilitar aquí.
          </div>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {ALL_MODULES.map(mod => {
              const checked = selectedModules.includes(mod)
              return (
                <button
                  key={mod}
                  onClick={() => toggleModule(mod)}
                  className={`px-3 py-2.5 rounded-lg text-[12px] font-medium border transition-all cursor-pointer
                    ${checked
                      ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                    }`}
                >
                  {mod}
                </button>
              )
            })}
          </div>
          <button
            onClick={handleModulesSave}
            disabled={saving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-semibold rounded-lg border-none cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar módulos
          </button>
        </div>
      )}

      {/* Tab: Límites */}
      {activeTab === 'limites' && (
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-6 max-w-[480px]">
          <div className="text-[13px] font-bold text-zinc-300 mb-4">Límites del tenant</div>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[12px] font-semibold text-zinc-400 block mb-1.5">
                Override de límite de usuarios (sobreescribe el límite del plan)
              </label>
              <input
                type="number"
                min={1}
                value={userLimit}
                onChange={e => setUserLimit(e.target.value ? Number(e.target.value) : '')}
                placeholder="Dejar vacío para usar límite del plan"
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
              />
              <div className="text-[11px] text-zinc-600 mt-1">
                Vacío = usar límite del plan · Número = límite personalizado
              </div>
            </div>
            <div>
              <div className={`text-[12px] px-3 py-2 rounded-lg ${tenant.overUserLimit ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {tenant.overUserLimit ? '⚠ Este tenant está sobre su límite de usuarios' : '✓ Dentro del límite de usuarios'}
              </div>
            </div>
            <button
              onClick={handleLimitsSave}
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-semibold rounded-lg border-none cursor-pointer disabled:opacity-50 flex items-center gap-2 w-fit"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar límites
            </button>
          </div>
        </div>
      )}

      {/* Tab: Dashboards */}
      {activeTab === 'dashboards' && id && (
        <DashboardsTab tenantId={id} />
      )}

      {/* Tab: Auditoría */}
      {activeTab === 'auditoria' && (
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-700/50">
            <div className="text-[13px] font-bold text-zinc-300">Log de auditoría de plataforma</div>
          </div>
          {audit.length === 0 ? (
            <div className="flex items-center justify-center py-12 gap-2 text-zinc-600 text-[13px]">
              <Activity className="w-4 h-4" /> Sin registros aún
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700/40">
                  <th className="text-left px-5 py-2.5 text-[11px] font-bold text-zinc-600 uppercase">Acción</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold text-zinc-600 uppercase">Realizado por</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold text-zinc-600 uppercase">Notas</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold text-zinc-600 uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(log => (
                  <tr key={log.id} className="border-b border-zinc-700/20 hover:bg-zinc-700/10">
                    <td className="px-5 py-3 text-[12px] font-mono text-indigo-400">{log.action}</td>
                    <td className="px-4 py-3 text-[12px] text-zinc-400">
                      {log.platformUser ? `${log.platformUser.firstName} ${log.platformUser.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-zinc-500">{log.notes ?? '—'}</td>
                    <td className="px-4 py-3 text-[11px] text-zinc-600">
                      {new Date(log.createdAt).toLocaleString('es-MX')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create branch modal */}
      {showCreateBranch && id && (
        <CreateBranchModal
          tenantId={id}
          onCreated={async () => {
            setShowCreateBranch(false)
            await loadBranches()
            flash(true)
          }}
          onClose={() => setShowCreateBranch(false)}
        />
      )}
    </div>
  )
}
