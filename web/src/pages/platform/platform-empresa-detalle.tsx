import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Loader2, Building2, GitBranch, Users, Package, Activity,
  AlertTriangle, Plus, X, Check, LayoutDashboard, KeyRound, RefreshCw, Ban, Power,
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
import {
  fetchTenantLicense, createTenantLicense, renewTenantLicense,
  suspendTenantLicense, activateTenantLicense,
} from '@/services/platform/platform-licenses-service'
import type {
  License, LicenseStatus, LicenseValidation, CreateLicenseInput, RenewLicenseInput,
} from '@/services/platform/platform-licenses-service'
import { TenantStatusBadge, TenantPlanBadge } from '@/components/platform/tenant-status-badge'

type FullTenant = PlatformTenant & {
  branches: { id: string; name: string; code: string; status: string; isMain: boolean }[]
  _count: { memberships: number; orders: number; products: number }
}

const PLANS: TenantPlan[] = ['FREE', 'STARTER', 'PRO', 'PLUS', 'ENTERPRISE']

const VERTICAL_INCOMPATIBLE: Partial<Record<string, string[]>> = {
  RETAIL:     ['comanda', 'kitchen'],
  RESTAURANT: ['pos'],
}

function isCompatibleWithVertical(mod: string, vertical: string): boolean {
  return !(VERTICAL_INCOMPATIBLE[vertical] ?? []).includes(mod)
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', pos: 'POS', ventas: 'Ventas', inventario: 'Inventario',
  clientes: 'Clientes', compras: 'Compras', proveedores: 'Proveedores',
  servicios: 'Servicios', cotizaciones: 'Cotizaciones', 'ordenes-trabajo': 'Órdenes de Trabajo',
  cxc: 'CxC', cxp: 'CxP', caja: 'Caja', reportes: 'Reportes',
  usuarios: 'Usuarios', roles: 'Roles', configuracion: 'Configuración',
  branches: 'Sucursales', empleados: 'Empleados', comanda: 'Comandas',
  insumos: 'Insumos', 'dining-areas': 'Áreas Restaurante', gym: 'Gym', kitchen: 'Kitchen', delivery: 'Delivery',
  memberships: 'Membresías', 'access-control': 'Control Acceso',
}

const PLAN_ORDER: TenantPlan[] = ['FREE', 'STARTER', 'PRO', 'PLUS', 'ENTERPRISE']
const MODULES_BY_TIER: Array<{ plan: TenantPlan; modules: string[] }> = [
  { plan: 'FREE',       modules: ['dashboard', 'ventas', 'clientes', 'caja', 'usuarios', 'roles', 'configuracion'] },
  { plan: 'STARTER',   modules: ['inventario', 'insumos'] },
  { plan: 'PRO',       modules: ['compras', 'proveedores', 'servicios', 'cotizaciones', 'ordenes-trabajo', 'empleados', 'reportes', 'branches'] },
  { plan: 'PLUS',      modules: ['cxc', 'cxp'] },
  { plan: 'ENTERPRISE', modules: [] },
]

function getModulesForPlan(plan: TenantPlan): string[] {
  const tierIndex = PLAN_ORDER.indexOf(plan)
  return MODULES_BY_TIER.filter((_, i) => i <= tierIndex).flatMap(t => t.modules)
}

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

// ─── License helpers & modals ───────────────────────────────────────────────

const LICENSE_STATUS_COLORS: Record<LicenseStatus, string> = {
  TRIAL:     'bg-indigo-500/15 text-indigo-400',
  ACTIVE:    'bg-emerald-500/15 text-emerald-400',
  EXPIRED:   'bg-red-500/15 text-red-400',
  SUSPENDED: 'bg-amber-500/15 text-amber-400',
  CANCELLED: 'bg-zinc-700 text-zinc-400',
}

const LICENSE_STATUS_LABELS: Record<LicenseStatus, string> = {
  TRIAL: 'Prueba', ACTIVE: 'Activa', EXPIRED: 'Expirada', SUSPENDED: 'Suspendida', CANCELLED: 'Cancelada',
}

function LicenseStatusBadge({ status }: { status: LicenseStatus }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${LICENSE_STATUS_COLORS[status]}`}>
      {LICENSE_STATUS_LABELS[status]}
    </span>
  )
}

function numOrUndef(v: string): number | undefined {
  return v.trim() === '' ? undefined : Number(v)
}

interface IssueLicenseModalProps {
  tenantId: string
  defaultPlan: TenantPlan
  onDone: () => void
  onClose: () => void
}

type Vigencia = 'perpetual' | 'trial' | 'expires'

function IssueLicenseModal({ tenantId, defaultPlan, onDone, onClose }: IssueLicenseModalProps) {
  const [plan, setPlan] = useState<TenantPlan>(defaultPlan)
  const [vigencia, setVigencia] = useState<Vigencia>('perpetual')
  const [trialDays, setTrialDays] = useState('30')
  const [expiresAt, setExpiresAt] = useState('')
  const [maxUsers, setMaxUsers] = useState('')
  const [maxBranches, setMaxBranches] = useState('')
  const [maxDevices, setMaxDevices] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true); setError(null)
    try {
      const input: CreateLicenseInput = {
        plan,
        maxUsers: numOrUndef(maxUsers),
        maxBranches: numOrUndef(maxBranches),
        maxDevices: numOrUndef(maxDevices),
        notes: notes.trim() || undefined,
      }
      if (vigencia === 'trial') input.trialDays = Number(trialDays)
      else if (vigencia === 'expires') input.expiresAt = expiresAt || undefined
      await createTenantLicense(tenantId, input)
      onDone()
    } catch (e) { setError(errMessage(e)) }
    finally { setSaving(false) }
  }

  const numField = (label: string, value: string, set: (v: string) => void, ph: string) => (
    <div>
      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">{label}</label>
      <input
        type="number" min={1} value={value} onChange={e => set(e.target.value)} placeholder={ph}
        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[520px] flex flex-col gap-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-bold text-zinc-200">Emitir nueva licencia</div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="text-[12px] text-zinc-500 -mt-2">Reemplaza la licencia vigente (la anterior queda cancelada).</div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-900/60 rounded-lg text-[12px] text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        <div>
          <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Plan</label>
          <select value={plan} onChange={e => setPlan(e.target.value as TenantPlan)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 outline-none focus:border-indigo-500 cursor-pointer">
            {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Vigencia</label>
          <select value={vigencia} onChange={e => setVigencia(e.target.value as Vigencia)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 outline-none focus:border-indigo-500 cursor-pointer mb-2">
            <option value="perpetual">Perpetua (sin vencimiento)</option>
            <option value="trial">Prueba por N días</option>
            <option value="expires">Expira en fecha</option>
          </select>
          {vigencia === 'trial' && numField('Días de prueba', trialDays, setTrialDays, '30')}
          {vigencia === 'expires' && (
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 outline-none focus:border-indigo-500" />
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {numField('Máx. usuarios', maxUsers, setMaxUsers, 'Plan')}
          {numField('Máx. sucursales', maxBranches, setMaxBranches, 'Plan')}
          {numField('Máx. dispositivos', maxDevices, setMaxDevices, '∞')}
        </div>

        <div>
          <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Notas</label>
          <input value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500" />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-[12px] font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg border-none cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Emitir
          </button>
        </div>
      </div>
    </div>
  )
}

interface RenewLicenseModalProps {
  tenantId: string
  current: License
  onDone: () => void
  onClose: () => void
}

function RenewLicenseModal({ tenantId, current, onDone, onClose }: RenewLicenseModalProps) {
  const [mode, setMode] = useState<'extend' | 'expires'>('extend')
  const [extendDays, setExtendDays] = useState('30')
  const [expiresAt, setExpiresAt] = useState('')
  const [plan, setPlan] = useState<TenantPlan>(current.plan)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true); setError(null)
    try {
      const input: RenewLicenseInput = {}
      if (mode === 'extend') input.extendDays = Number(extendDays)
      else input.expiresAt = expiresAt || undefined
      if (plan !== current.plan) input.plan = plan
      await renewTenantLicense(tenantId, input)
      onDone()
    } catch (e) { setError(errMessage(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[480px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-bold text-zinc-200">Renovar licencia</div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="text-[12px] text-zinc-500 -mt-2">
          Vence actualmente: <span className="text-zinc-300">{current.expiresAt ? new Date(current.expiresAt).toLocaleDateString('es-MX') : 'Perpetua'}</span>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-900/60 rounded-lg text-[12px] text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        <div>
          <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Modo</label>
          <select value={mode} onChange={e => setMode(e.target.value as 'extend' | 'expires')}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 outline-none focus:border-indigo-500 cursor-pointer mb-2">
            <option value="extend">Extender N días</option>
            <option value="expires">Nueva fecha de vencimiento</option>
          </select>
          {mode === 'extend' ? (
            <input type="number" min={1} value={extendDays} onChange={e => setExtendDays(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 outline-none focus:border-indigo-500" />
          ) : (
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 outline-none focus:border-indigo-500" />
          )}
        </div>

        <div>
          <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Plan (opcional)</label>
          <select value={plan} onChange={e => setPlan(e.target.value as TenantPlan)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-200 outline-none focus:border-indigo-500 cursor-pointer">
            {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-[12px] font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg border-none cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Renovar
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
  const [activeTab, setActiveTab] = useState<'info' | 'sucursales' | 'licencia' | 'modulos' | 'limites' | 'dashboards' | 'auditoria'>('info')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)
  const [showCreateBranch, setShowCreateBranch] = useState(false)

  // License state
  const [license, setLicense] = useState<License | null>(null)
  const [licenseValidation, setLicenseValidation] = useState<LicenseValidation | null>(null)
  const [showIssueLicense, setShowIssueLicense] = useState(false)
  const [showRenewLicense, setShowRenewLicense] = useState(false)

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

  const loadLicense = useCallback(async () => {
    if (!id) return
    const { license: lic, validation } = await fetchTenantLicense(id)
    setLicense(lic)
    setLicenseValidation(validation)
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (activeTab === 'sucursales') loadBranches()
    if (activeTab === 'licencia') loadLicense()
  }, [activeTab, loadBranches, loadLicense])

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
    if (!id || !tenant) return
    setSaving(true); setSaveError(null)
    try {
      const compatible = selectedModules.filter(m => isCompatibleWithVertical(m, tenant.businessVertical))
      await updateTenantModules(id, compatible)
      await load(); flash(true)
    } catch (e) { setSaveError(errMessage(e)) }
    finally { setSaving(false) }
  }, [id, tenant, selectedModules, load, flash])

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

  const handleSuspendLicense = useCallback(async () => {
    if (!id) return
    const reason = window.prompt('Motivo de la suspensión (opcional):') ?? undefined
    setSaving(true); setSaveError(null)
    try {
      await suspendTenantLicense(id, reason)
      await Promise.all([loadLicense(), load()]); flash(true)
    } catch (e) { setSaveError(errMessage(e)) }
    finally { setSaving(false) }
  }, [id, loadLicense, load, flash])

  const handleActivateLicense = useCallback(async () => {
    if (!id) return
    setSaving(true); setSaveError(null)
    try {
      await activateTenantLicense(id)
      await Promise.all([loadLicense(), load()]); flash(true)
    } catch (e) { setSaveError(errMessage(e)) }
    finally { setSaving(false) }
  }, [id, loadLicense, load, flash])

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
    { key: 'licencia',    label: 'Licencia',     icon: KeyRound },
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

      {/* Tab: Licencia */}
      {activeTab === 'licencia' && (
        <div className="flex flex-col gap-4">
          {!license ? (
            <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-10 flex flex-col items-center gap-3 text-center">
              <KeyRound className="w-8 h-8 text-zinc-600" />
              <div className="text-[13px] text-zinc-400">Esta empresa no tiene licencia registrada.</div>
              <button
                onClick={() => setShowIssueLicense(true)}
                className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold rounded-lg border-none cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Emitir licencia
              </button>
            </div>
          ) : (
            <>
              {/* Validation banner */}
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] border ${
                licenseValidation?.valid
                  ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-400'
                  : 'bg-red-950/40 border-red-900/60 text-red-400'
              }`}>
                {licenseValidation?.valid
                  ? <><Check className="w-4 h-4 shrink-0" /> Licencia vigente</>
                  : <><AlertTriangle className="w-4 h-4 shrink-0" /> Licencia no vigente{licenseValidation?.reason ? ` · ${licenseValidation.reason}` : ''}</>
                }
              </div>

              <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-mono text-zinc-200">{license.licenseKey}</span>
                    <LicenseStatusBadge status={license.status} />
                  </div>
                  <TenantPlanBadge plan={license.plan} />
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 sm:grid-cols-3">
                  {[
                    ['Inicia', new Date(license.startsAt).toLocaleDateString('es-MX')],
                    ['Vence', license.expiresAt ? new Date(license.expiresAt).toLocaleDateString('es-MX') : 'Perpetua'],
                    ['Plan', license.plan],
                    ['Máx. usuarios', license.maxUsers ?? 'Plan'],
                    ['Máx. sucursales', license.maxBranches ?? 'Plan'],
                    ['Máx. dispositivos', license.maxDevices ?? '∞'],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex flex-col">
                      <span className="text-[11px] text-zinc-500">{k}</span>
                      <span className="text-[13px] text-zinc-200 font-medium">{v}</span>
                    </div>
                  ))}
                </div>

                {license.notes && (
                  <div className="text-[12px] text-zinc-500 border-t border-zinc-700/40 pt-3">{license.notes}</div>
                )}

                <div className="flex items-center gap-2 border-t border-zinc-700/40 pt-4">
                  <button
                    onClick={() => setShowRenewLicense(true)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold rounded-lg border-none cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Renovar
                  </button>
                  {(license.status === 'ACTIVE' || license.status === 'TRIAL') && (
                    <button
                      onClick={handleSuspendLicense}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[12px] font-semibold rounded-lg border border-amber-500/20 cursor-pointer disabled:opacity-50"
                    >
                      <Ban className="w-3.5 h-3.5" /> Suspender
                    </button>
                  )}
                  {license.status === 'SUSPENDED' && (
                    <button
                      onClick={handleActivateLicense}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[12px] font-semibold rounded-lg border border-emerald-600/30 cursor-pointer disabled:opacity-50"
                    >
                      <Power className="w-3.5 h-3.5" /> Reactivar
                    </button>
                  )}
                  <button
                    onClick={() => setShowIssueLicense(true)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 text-[12px] font-semibold rounded-lg border border-zinc-600/50 cursor-pointer disabled:opacity-50 ml-auto"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Emitir nueva
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Módulos */}
      {activeTab === 'modulos' && (() => {
        const planMods = new Set(getModulesForPlan(tenant.plan))
        const allMods = Object.keys(MODULE_LABELS)
        const extraMods = allMods.filter(m => !planMods.has(m))
        const extraEnabled = selectedModules.filter(m => !planMods.has(m))
        const vertical = tenant.businessVertical

        return (
          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[13px] font-bold text-zinc-300">Módulos del tenant</div>
              <div className="flex items-center gap-3 text-[12px]">
                <span className="text-zinc-500">
                  Plan <span className="text-indigo-400 font-semibold">{tenant.plan}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-400 text-[11px] font-mono">
                  {vertical}
                </span>
                {extraEnabled.length > 0 && (
                  <span className="text-emerald-400">+{extraEnabled.length} extras</span>
                )}
              </div>
            </div>
            <div className="text-[12px] text-zinc-500 mb-5">
              Módulos del plan están siempre activos. Puedes agregar módulos extra fuera del plan.
              Los módulos marcados con ⚠ son incompatibles con el vertical actual y no se mostrarán al usuario.
            </div>

            {/* Plan modules — locked on, show incompatibility warning */}
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Incluidos en el plan ({planMods.size})
            </div>
            <div className="grid grid-cols-1 gap-1.5 mb-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...planMods].map(mod => {
                const compatible = isCompatibleWithVertical(mod, vertical)
                return (
                  <div
                    key={mod}
                    title={!compatible ? `Incompatible con vertical ${vertical} — no se mostrará en el sidebar` : undefined}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg border
                      ${compatible
                        ? 'border-indigo-500/20 bg-indigo-600/5'
                        : 'border-amber-500/30 bg-amber-500/5'
                      }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-[13px] font-medium ${compatible ? 'text-indigo-300' : 'text-amber-400'}`}>
                        {MODULE_LABELS[mod] ?? mod}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono">{mod}</span>
                      {!compatible && (
                        <span className="text-[10px] text-amber-500">
                          ⚠ Incompatible con {vertical}
                        </span>
                      )}
                    </div>
                    <Check className={`w-4 h-4 flex-shrink-0 ${compatible ? 'text-indigo-500' : 'text-amber-500/50'}`} />
                  </div>
                )
              })}
            </div>

            {/* Extra modules — toggleable; incompatible ones locked */}
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Módulos extra ({extraEnabled.length} activos de {extraMods.length})
            </div>
            <div className="grid grid-cols-1 gap-1.5 mb-6 sm:grid-cols-2 lg:grid-cols-3">
              {extraMods.map(mod => {
                const enabled = selectedModules.includes(mod)
                const compatible = isCompatibleWithVertical(mod, vertical)

                if (!compatible) {
                  return (
                    <div
                      key={mod}
                      title={`Incompatible con vertical ${vertical}`}
                      className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900/30 opacity-50 cursor-not-allowed"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-zinc-600">{MODULE_LABELS[mod] ?? mod}</span>
                        <span className="text-[10px] text-zinc-700 font-mono">{mod}</span>
                        <span className="text-[10px] text-amber-600">⚠ No compatible con {vertical}</span>
                      </div>
                      <X className="w-4 h-4 text-zinc-700 flex-shrink-0" />
                    </div>
                  )
                }

                return (
                  <button
                    key={mod}
                    onClick={() => toggleModule(mod)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all cursor-pointer text-left
                      ${enabled
                        ? 'bg-emerald-600/10 border-emerald-500/40 hover:border-emerald-400/60'
                        : 'bg-zinc-900/60 border-zinc-700/60 hover:border-zinc-600'
                      }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-[13px] font-medium ${enabled ? 'text-emerald-300' : 'text-zinc-500'}`}>
                        {MODULE_LABELS[mod] ?? mod}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono">{mod}</span>
                    </div>
                    <div className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ml-3
                      ${enabled ? 'bg-emerald-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                        ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`}
                      />
                    </div>
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
              Guardar extras
            </button>
          </div>
        )
      })()}

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

      {/* Issue license modal */}
      {showIssueLicense && id && (
        <IssueLicenseModal
          tenantId={id}
          defaultPlan={tenant.plan}
          onDone={async () => {
            setShowIssueLicense(false)
            await Promise.all([loadLicense(), load()])
            flash(true)
          }}
          onClose={() => setShowIssueLicense(false)}
        />
      )}

      {/* Renew license modal */}
      {showRenewLicense && id && license && (
        <RenewLicenseModal
          tenantId={id}
          current={license}
          onDone={async () => {
            setShowRenewLicense(false)
            await Promise.all([loadLicense(), load()])
            flash(true)
          }}
          onClose={() => setShowRenewLicense(false)}
        />
      )}
    </div>
  )
}
