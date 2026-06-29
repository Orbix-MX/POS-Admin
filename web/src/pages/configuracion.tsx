import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchSettings, updateSettings, type TenantSettings } from '@/services/core/configuracion-service'
import {
  fetchPrinters, createPrinter, updatePrinter, deletePrinter,
  type PrinterConfig, type PrinterConfigInput, type PrinterType, type PrinterConnection,
} from '@/services/core/printers-service'
import { fetchUsuarios, type Usuario } from '@/services/core/users-service'
import {
  fetchTenantInfo, updateTenantInfo, uploadTenantLogo, uploadTenantBanner,
  deleteTenantLogo, deleteTenantBanner, type TenantInfo, type RestaurantServiceMode,
} from '@/services/core/tenant-service'
import {
  fetchBranches, createBranch, updateBranch, deleteBranch, setMainBranch,
  addBranchMember, removeBranchMember, type Branch, type CreateBranchInput,
} from '@/services/core/branches-service'
import { useERPStore } from '@/store/erp-store'
import { useAuthStore } from '@/store/auth-store'
const PLAN_BRANCH_LIMITS: Record<string, number | null> = {
  FREE: 1, STARTER: 1, PRO: 3, PLUS: 10, ENTERPRISE: null,
}
function getMaxBranchesForPlan(plan: string): number | null {
  return PLAN_BRANCH_LIMITS[plan] ?? null
}
import {
  Loader2, Upload, Trash2, Building2, MapPin, Plus, Pencil,
  CheckCircle, XCircle, Star, UserPlus, UserMinus, Users, X,
  Printer, Wifi, Usb, Bluetooth, Monitor, Check,
  KeyRound, Smartphone, RefreshCw, ShieldCheck, QrCode, AlertTriangle,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  fetchMyLicense, createEnrollmentToken, fetchDevices, revokeDevice,
  type LicenseOverview, type LicenseStatus, type Device, type DeviceType,
} from '@/services/core/license-service'

// ─── BRANCH STATUS ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activa', INACTIVE: 'Inactiva', SUSPENDED: 'Suspendida', CLOSED: 'Cerrada',
}
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  INACTIVE: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  SUSPENDED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  CLOSED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

// ─── BRANCH FORM MODAL ────────────────────────────────────────────────────────

function BranchModal({
  branch,
  onClose,
  onSave,
}: {
  branch: Branch | null
  onClose: () => void
  onSave: (input: CreateBranchInput) => Promise<void>
}) {
  const isEdit = !!branch
  const [form, setForm] = useState<CreateBranchInput>({
    name: branch?.name ?? '',
    code: branch?.code ?? '',
    address: branch?.address ?? '',
    city: branch?.city ?? '',
    state: branch?.state ?? '',
    zipCode: branch?.zipCode ?? '',
    phone: branch?.phone ?? '',
    email: branch?.email ?? '',
    isMain: branch?.isMain ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setF<K extends keyof CreateBranchInput>(k: K, v: CreateBranchInput[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) { setError('Nombre y código son requeridos'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al guardar sucursal')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            {isEdit ? 'Editar sucursal' : 'Nueva sucursal'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <BF label="Nombre *" value={form.name} onChange={v => setF('name', v)} />
            <BF label="Código *" value={form.code} onChange={v => setF('code', v.toUpperCase())} placeholder="CENTRO" />
          </div>
          <BF label="Dirección" value={form.address ?? ''} onChange={v => setF('address', v)} />
          <div className="grid grid-cols-3 gap-3">
            <BF label="Ciudad" value={form.city ?? ''} onChange={v => setF('city', v)} />
            <BF label="Estado" value={form.state ?? ''} onChange={v => setF('state', v)} />
            <BF label="C.P." value={form.zipCode ?? ''} onChange={v => setF('zipCode', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BF label="Teléfono" value={form.phone ?? ''} onChange={v => setF('phone', v)} type="tel" />
            <BF label="Email" value={form.email ?? ''} onChange={v => setF('email', v)} type="email" />
          </div>
        </div>

        <div className="border-t border-border px-5 py-3">
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-[12px] mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              <XCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2.5">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-muted/50">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear sucursal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BF({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary" />
    </div>
  )
}

// ─── MEMBERS PANEL ────────────────────────────────────────────────────────────

function MembersPanel({ branch, allUsers, onAdd, onRemove }: {
  branch: Branch
  allUsers: { id: string; firstName: string; lastName: string; email: string }[]
  onAdd: (userId: string) => Promise<void>
  onRemove: (userId: string) => Promise<void>
}) {
  const memberIds = new Set((branch.memberships ?? []).map(m => m.userId))
  const [adding, setAdding] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')

  const nonMembers = allUsers.filter(u => !memberIds.has(u.id))

  return (
    <div className="space-y-3">
      {/* Add member */}
      <div className="flex gap-2">
        <select
          value={selectedUserId}
          onChange={e => setSelectedUserId(e.target.value)}
          className="flex-1 px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
        >
          <option value="">Seleccionar usuario…</option>
          {nonMembers.map(u => (
            <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
          ))}
        </select>
        <button
          onClick={async () => {
            if (!selectedUserId) return
            setAdding(selectedUserId)
            try { await onAdd(selectedUserId); setSelectedUserId('') }
            finally { setAdding(null) }
          }}
          disabled={!selectedUserId || !!adding}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold disabled:opacity-60"
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          Asignar
        </button>
      </div>

      {/* Member list */}
      {(branch.memberships ?? []).length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-2">Sin usuarios asignados. Todos los usuarios del tenant tienen acceso por defecto.</p>
      ) : (
        <div className="space-y-1.5">
          {(branch.memberships ?? []).map(m => (
            <div key={m.userId} className="flex items-center justify-between px-3 py-2 border border-border rounded-lg">
              <div>
                <span className="text-[13px] font-medium text-foreground">
                  {m.user ? `${m.user.firstName} ${m.user.lastName}` : m.userId}
                </span>
                {m.user && <span className="text-[11px] text-muted-foreground ml-2">{m.user.email}</span>}
                {m.isPrimary && <span className="ml-2 text-[10px] font-bold text-primary">Principal</span>}
              </div>
              <button
                onClick={async () => {
                  setRemoving(m.userId)
                  try { await onRemove(m.userId) }
                  finally { setRemoving(null) }
                }}
                disabled={removing === m.userId}
                className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 disabled:opacity-60"
              >
                {removing === m.userId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── BRANCHES SECTION ─────────────────────────────────────────────────────────

function SucursalesSection({ plan }: { plan: string }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalBranch, setModalBranch] = useState<Branch | 'new' | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [tenantUsers, setTenantUsers] = useState<Usuario[]>([])

  const maxBranches = getMaxBranchesForPlan(plan as any)
  const activeBranches = branches.filter(b => b.status === 'ACTIVE').length
  const atLimit = maxBranches !== null && activeBranches >= maxBranches

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchBranches()
      // Reload expanded branch with members
      const expanded = list.map(async (b) => {
        if (b.id === expandedId) {
          try {
            const { fetchBranch } = await import('@/services/core/branches-service')
            return await fetchBranch(b.id)
          } catch { return b }
        }
        return b
      })
      setBranches(await Promise.all(expanded))
    } catch {
      setError('Error al cargar sucursales')
    } finally {
      setLoading(false)
    }
  }, [expandedId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetchUsuarios().then(setTenantUsers).catch(() => {})
  }, [])

  async function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    // Reload with member details
    try {
      const { fetchBranch } = await import('@/services/core/branches-service')
      const full = await fetchBranch(id)
      setBranches(prev => prev.map(b => b.id === id ? full : b))
    } catch { /* show what we have */ }
  }

  async function handleSave(input: CreateBranchInput) {
    if (modalBranch && modalBranch !== 'new') {
      await updateBranch(modalBranch.id, input)
    } else {
      await createBranch(input)
    }
    await load()
  }

  async function handleToggleStatus(branch: Branch) {
    setActionLoading(branch.id)
    try {
      const newStatus = branch.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await updateBranch(branch.id, { status: newStatus })
      await load()
    } finally { setActionLoading(null) }
  }

  async function handleSetMain(branch: Branch) {
    setActionLoading(branch.id)
    try { await setMainBranch(branch.id); await load() }
    finally { setActionLoading(null) }
  }

  async function handleDelete(branch: Branch) {
    if (!confirm(`¿Eliminar sucursal "${branch.name}"? Esta acción no se puede deshacer.`)) return
    setActionLoading(branch.id)
    try { await deleteBranch(branch.id); await load() }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Error al eliminar') }
    finally { setActionLoading(null) }
  }

  const allTenantUsers = tenantUsers.map(u => ({
    id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email,
  }))

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-base font-bold text-foreground">Sucursales</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Administra las sucursales de tu empresa.
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Capacity indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 rounded-lg">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span className="text-[12px] font-semibold text-foreground">
              {activeBranches} / {maxBranches ?? '∞'}
            </span>
            <span className="text-[11px] text-muted-foreground">activas</span>
          </div>
          <button
            onClick={() => setModalBranch('new')}
            disabled={atLimit}
            title={atLimit ? `Tu plan permite máximo ${maxBranches} sucursal(es) activa(s).` : undefined}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva sucursal
          </button>
        </div>
      </div>

      {atLimit && (
        <div className="mt-3 mb-4 px-3.5 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-[12px] text-amber-700 dark:text-amber-300">
          Tu plan <strong>{plan}</strong> permite máximo <strong>{maxBranches}</strong> sucursal(es) activa(s). Desactiva una sucursal o mejora tu plan para agregar más.
        </div>
      )}

      {error && (
        <div className="mt-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="mt-5 space-y-2.5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando sucursales…
          </div>
        ) : branches.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-muted-foreground">
            <MapPin className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-[13px]">Sin sucursales registradas</span>
          </div>
        ) : branches.map(branch => (
          <div key={branch.id} className="border border-border rounded-xl overflow-hidden">
            {/* Branch header */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-foreground">{branch.name}</span>
                  {branch.isMain && (
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" aria-label="Sucursal principal" />
                  )}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[branch.status]}`}>
                    {STATUS_LABELS[branch.status]}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {branch.code}
                  {branch.city && ` · ${branch.city}`}
                  {branch.address && ` · ${branch.address}`}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Toggle status */}
                <button
                  onClick={() => handleToggleStatus(branch)}
                  disabled={!!actionLoading || branch.isMain}
                  title={branch.isMain ? 'La sucursal principal no se puede desactivar' : branch.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  {actionLoading === branch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                    branch.status === 'ACTIVE' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                </button>
                {/* Set main */}
                {!branch.isMain && branch.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleSetMain(branch)}
                    disabled={!!actionLoading}
                    title="Marcar como principal"
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-amber-500 disabled:opacity-40 transition-colors"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Edit */}
                <button
                  onClick={() => setModalBranch(branch)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {/* Users toggle */}
                <button
                  onClick={() => handleExpand(branch.id)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{branch._count?.memberships ?? (branch.memberships?.length ?? 0)}</span>
                </button>
                {/* Delete */}
                {!branch.isMain && (
                  <button
                    onClick={() => handleDelete(branch)}
                    disabled={!!actionLoading}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Expanded members panel */}
            {expandedId === branch.id && (
              <div className="border-t border-border px-4 py-4 bg-muted/20">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-3">
                  Usuarios asignados a esta sucursal
                </div>
                <MembersPanel
                  branch={branch}
                  allUsers={allTenantUsers}
                  onAdd={async (userId) => {
                    await addBranchMember(branch.id, userId)
                    await handleExpand(branch.id)
                  }}
                  onRemove={async (userId) => {
                    await removeBranchMember(branch.id, userId)
                    await handleExpand(branch.id)
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Branch modal */}
      {modalBranch !== null && (
        <BranchModal
          branch={modalBranch === 'new' ? null : modalBranch}
          onClose={() => setModalBranch(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

// ─── PRINTERS SECTION ─────────────────────────────────────────────────────────

const PRINTER_TYPE_LABELS: Record<PrinterType, string> = {
  TICKET:      'Tickets / Comandas',
  SALE_TICKET: 'Tickets de venta',
  LABEL:       'Etiquetas',
  REPORT:      'Reportes',
}

const CONN_LABELS: Record<PrinterConnection, string> = {
  NETWORK:   'Red (IP)',
  USB:       'USB',
  BLUETOOTH: 'Bluetooth',
  SYSTEM:    'Sistema operativo',
}

const CONN_ICONS: Record<PrinterConnection, React.ReactNode> = {
  NETWORK:   <Wifi className="w-3.5 h-3.5" />,
  USB:       <Usb className="w-3.5 h-3.5" />,
  BLUETOOTH: <Bluetooth className="w-3.5 h-3.5" />,
  SYSTEM:    <Monitor className="w-3.5 h-3.5" />,
}

const EMPTY_FORM: PrinterConfigInput = {
  name: '', branchId: null, type: 'TICKET', connectionType: 'NETWORK',
  ipAddress: '', port: 9100, usbPath: '', bluetoothAddress: '', systemName: '', paperWidth: 80,
  isDefault: false, isActive: true,
}

function PrinterModal({
  printer, branches, onClose, onSave,
}: {
  printer: PrinterConfig | null
  branches: { id: string; name: string }[]
  onClose: () => void
  onSave: (dto: PrinterConfigInput) => Promise<void>
}) {
  const [form, setForm] = useState<PrinterConfigInput>(
    printer ? {
      name: printer.name,
      branchId: printer.branchId,
      type: printer.type,
      connectionType: printer.connectionType,
      ipAddress: printer.ipAddress ?? '',
      port: printer.port ?? 9100,
      usbPath: printer.usbPath ?? '',
      bluetoothAddress: printer.bluetoothAddress ?? '',
      systemName: printer.systemName ?? '',
      paperWidth: printer.paperWidth ?? 80,
      isDefault: printer.isDefault,
      isActive: printer.isActive,
    } : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const set = <K extends keyof PrinterConfigInput>(k: K, v: PrinterConfigInput[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    if (form.connectionType === 'NETWORK' && !form.ipAddress?.trim()) {
      setError('La dirección IP es requerida para impresoras de red'); return
    }
    setSaving(true); setError(null)
    try { await onSave(form); onClose() }
    catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setError(err?.response?.data?.message ?? 'Error al guardar')
    }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <Printer className="w-4 h-4 text-primary" />
            {printer ? 'Editar impresora' : 'Nueva impresora'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Nombre *
            </label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Ej. Impresora Cocina, Barra…"
              className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Branch */}
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Sucursal
              </label>
              <select value={form.branchId ?? ''} onChange={e => set('branchId', e.target.value || null)}
                className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary">
                <option value="">— Todas las sucursales —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Tipo
              </label>
              <select value={form.type} onChange={e => set('type', e.target.value as PrinterType)}
                className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary">
                {(Object.keys(PRINTER_TYPE_LABELS) as PrinterType[]).map(t => (
                  <option key={t} value={t}>{PRINTER_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Connection type */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Tipo de conexión
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(CONN_LABELS) as PrinterConnection[]).map(c => (
                <button key={c} type="button" onClick={() => set('connectionType', c)}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all
                    ${form.connectionType === c
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/50'}`}
                >
                  {CONN_ICONS[c]}
                  {CONN_LABELS[c].split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Connection-specific fields */}
          {form.connectionType === 'NETWORK' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Dirección IP *
                </label>
                <input value={form.ipAddress ?? ''} onChange={e => set('ipAddress', e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Puerto
                </label>
                <input type="number" value={form.port ?? 9100} onChange={e => set('port', Number(e.target.value))}
                  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary" />
              </div>
            </div>
          )}
          {form.connectionType === 'USB' && (
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Ruta del dispositivo
              </label>
              <input value={form.usbPath ?? ''} onChange={e => set('usbPath', e.target.value)}
                placeholder="Linux: /dev/usb/lp0 · Windows: USB001"
                className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Ruta del puerto USB en el servidor donde corre el API.
              </p>
            </div>
          )}
          {form.connectionType === 'BLUETOOTH' && (
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Dirección MAC o puerto virtual *
              </label>
              <input value={form.bluetoothAddress ?? ''} onChange={e => set('bluetoothAddress', e.target.value)}
                placeholder="00:11:22:33:44:55  ó  /dev/rfcomm0  ó  COM3"
                className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary" />
              <p className="text-[11px] text-muted-foreground mt-1">
                La impresora debe estar emparejada en el OS del servidor. Obtén la MAC desde el menú de la impresora o desde la configuración Bluetooth del equipo.
              </p>
            </div>
          )}
          {form.connectionType === 'SYSTEM' && (
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Nombre en el sistema
              </label>
              <input value={form.systemName ?? ''} onChange={e => set('systemName', e.target.value)}
                placeholder="EPSON_TM-T20III"
                className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Paper width */}
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Ancho de papel (mm)
              </label>
              <select value={form.paperWidth ?? 80} onChange={e => set('paperWidth', Number(e.target.value))}
                className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary">
                <option value={58}>58 mm</option>
                <option value={80}>80 mm</option>
              </select>
            </div>
            {/* Flags */}
            <div className="flex flex-col gap-2 justify-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.isDefault ?? false}
                  onChange={e => set('isDefault', e.target.checked)}
                  className="accent-primary w-3.5 h-3.5" />
                <span className="text-[12px] text-foreground">Impresora por defecto</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.isActive ?? true}
                  onChange={e => set('isActive', e.target.checked)}
                  className="accent-primary w-3.5 h-3.5" />
                <span className="text-[12px] text-foreground">Activa</span>
              </label>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3">
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-[12px] mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              <XCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2.5">
            <button onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg text-[13px] text-muted-foreground hover:bg-muted/50 cursor-pointer">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 cursor-pointer">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {printer ? 'Guardar cambios' : 'Crear impresora'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PrintersSection({ branches }: { branches: { id: string; name: string }[] }) {
  const [printers, setPrinters]   = useState<PrinterConfig[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [modal, setModal]         = useState<PrinterConfig | 'new' | null>(null)
  const [deleting, setDeleting]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setPrinters(await fetchPrinters()) }
    catch { setError('Error al cargar impresoras') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(dto: PrinterConfigInput) {
    if (modal && modal !== 'new') {
      await updatePrinter(modal.id, dto)
    } else {
      await createPrinter(dto)
    }
    await load()
  }

  async function handleDelete(p: PrinterConfig) {
    if (!confirm(`¿Eliminar impresora "${p.name}"?`)) return
    setDeleting(p.id)
    try { await deletePrinter(p.id); await load() }
    catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      alert(err?.response?.data?.message ?? 'Error al eliminar')
    }
    finally { setDeleting(null) }
  }

  // Group by branch
  const byBranch = new Map<string, { label: string; items: PrinterConfig[] }>()
  for (const p of printers) {
    const key   = p.branchId ?? '__all__'
    const label = p.branch?.name ?? (p.branchId ? p.branchId : 'Todas las sucursales')
    if (!byBranch.has(key)) byBranch.set(key, { label, items: [] })
    byBranch.get(key)!.items.push(p)
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-base font-bold text-foreground">Impresoras</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Configura impresoras de tickets, etiquetas y reportes por sucursal.
          </div>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:opacity-90 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Nueva impresora
        </button>
      </div>

      {error && (
        <div className="mt-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="mt-5 space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando impresoras…
          </div>
        ) : printers.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
            <Printer className="w-9 h-9 mb-2 opacity-25" />
            <span className="text-[13px]">Sin impresoras configuradas</span>
            <span className="text-[11px] mt-0.5 opacity-70">Agrega una impresora para comenzar</span>
          </div>
        ) : (
          Array.from(byBranch.entries()).map(([key, { label, items }]) => (
            <div key={key}>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> {label}
              </div>
              <div className="space-y-2">
                {items.map(p => (
                  <div key={p.id} className={`flex items-center gap-3 px-4 py-3 border rounded-xl transition-colors
                    ${p.isActive ? 'border-border' : 'border-border/50 opacity-60'}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                      ${p.isActive ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Printer className={`w-4 h-4 ${p.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-bold text-foreground">{p.name}</span>
                        {p.isDefault && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                            Por defecto
                          </span>
                        )}
                        {!p.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full">
                            Inactiva
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">
                          {PRINTER_TYPE_LABELS[p.type]}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          {CONN_ICONS[p.connectionType]}
                          {p.connectionType === 'NETWORK' && p.ipAddress
                            ? `${p.ipAddress}:${p.port ?? 9100}`
                            : p.connectionType === 'USB' && p.usbPath
                            ? p.usbPath
                            : p.connectionType === 'BLUETOOTH' && p.bluetoothAddress
                            ? p.bluetoothAddress
                            : p.connectionType === 'SYSTEM' && p.systemName
                            ? p.systemName
                            : CONN_LABELS[p.connectionType]}
                        </span>
                        {p.paperWidth && (
                          <span className="text-[11px] text-muted-foreground">{p.paperWidth} mm</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setModal(p)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p)} disabled={deleting === p.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 disabled:opacity-40 transition-colors cursor-pointer">
                        {deleting === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {modal !== null && (
        <PrinterModal
          printer={modal === 'new' ? null : modal}
          branches={branches}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

// ─── LICENSE & DEVICES SECTION ──────────────────────────────────────────────

const LICENSE_STATUS_META: Record<LicenseStatus, { label: string; cls: string }> = {
  TRIAL:     { label: 'Prueba',     cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  ACTIVE:    { label: 'Activa',     cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  EXPIRED:   { label: 'Expirada',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  SUSPENDED: { label: 'Suspendida', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  CANCELLED: { label: 'Cancelada',  cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

const DEVICE_TYPE_META: Record<DeviceType, { label: string; icon: React.ReactNode }> = {
  MOBILE_COMANDERA: { label: 'Comandera móvil', icon: <Smartphone className="w-4 h-4" /> },
  POS_DESKTOP:      { label: 'POS escritorio',  icon: <Monitor className="w-4 h-4" /> },
  WEB:              { label: 'Web',             icon: <Monitor className="w-4 h-4" /> },
  OTHER:            { label: 'Otro',            icon: <Smartphone className="w-4 h-4" /> },
}

function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString('es-MX') : '—'
}

// QR modal: shows a short-lived enrollment code the comandera app scans to
// register the device. The QR carries a tenant-scoped, single-use token — never
// a session — so it's safe even if briefly visible.
function EnrollDeviceModal({ onClose, onEnrolled }: { onClose: () => void; onEnrolled: () => void }) {
  const [token, setToken] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = (import.meta.env.VITE_API_URL as string) ?? ''

  const generate = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = await createEnrollmentToken()
      setToken(t.token)
      setSecondsLeft(t.expiresInSeconds)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo generar el código')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { generate() }, [generate])

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  const expired = token !== null && secondsLeft === 0
  const payload = token ? JSON.stringify({ v: 1, type: 'orbix-enroll', apiUrl, token }) : ''
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <QrCode className="w-4 h-4 text-primary" /> Registrar dispositivo
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="px-5 py-5 flex flex-col items-center gap-4">
          <p className="text-[12px] text-muted-foreground text-center">
            Abre la app <strong>Orbix Comandera</strong> en el dispositivo y escanea este código para vincularlo a tu empresa.
          </p>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-[12px] bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg w-full">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          <div className="relative w-[232px] h-[232px] flex items-center justify-center rounded-xl border border-border bg-white p-3">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : token && !expired ? (
              <QRCodeSVG value={payload} size={208} level="M" includeMargin={false} />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <QrCode className="w-10 h-10 opacity-30" />
                <span className="text-[12px]">Código expirado</span>
              </div>
            )}
          </div>

          {token && !expired && (
            <div className="text-[12px] text-muted-foreground">
              Válido por <span className="font-mono font-semibold text-foreground">{mm}:{ss}</span>
            </div>
          )}

          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-[13px] text-foreground hover:bg-muted/50 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Generar nuevo código
          </button>

          <div className="text-[11px] text-muted-foreground text-center leading-relaxed border-t border-border pt-3 w-full">
            El código es de un solo uso y caduca pronto. Tras vincular, podrás revocar el dispositivo en cualquier momento.
          </div>

          <button
            onClick={onEnrolled}
            className="text-[12px] text-primary font-semibold hover:underline cursor-pointer bg-transparent border-none"
          >
            Ya registré el dispositivo — actualizar lista
          </button>
        </div>
      </div>
    </div>
  )
}

function LicenciaSection({ canManage }: { canManage: boolean }) {
  const [overview, setOverview] = useState<LicenseOverview | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEnroll, setShowEnroll] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [ov, devs] = await Promise.all([fetchMyLicense(), fetchDevices().catch(() => [])])
      setOverview(ov)
      setDevices(devs)
    } catch {
      setError('Error al cargar la licencia')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRevoke(d: Device) {
    if (!confirm(`¿Revocar el dispositivo "${d.name ?? d.deviceId}"? Dejará de tener acceso.`)) return
    setRevoking(d.id)
    try { await revokeDevice(d.id); await load() }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Error al revocar') }
    finally { setRevoking(null) }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
  }
  if (error) {
    return <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
  }

  const lic = overview?.license
  const valid = overview?.validation.valid
  const activeDevices = devices.filter(d => d.status === 'ACTIVE')

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <div className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> Licencia
        </div>
        <div className="text-xs text-muted-foreground">Estado de la licencia de tu empresa y dispositivos vinculados.</div>
      </div>

      {/* License card */}
      {!lic ? (
        <div className="border border-dashed border-border rounded-xl py-10 flex flex-col items-center gap-2 text-muted-foreground">
          <KeyRound className="w-8 h-8 opacity-30" />
          <span className="text-[13px]">Tu empresa no tiene una licencia registrada.</span>
        </div>
      ) : (
        <div className="border border-border rounded-xl p-5 flex flex-col gap-4">
          {/* validation banner */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] ${
            valid ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                  : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            {valid ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
            {valid ? 'Licencia vigente' : `Licencia no vigente${overview?.validation.reason ? ` · ${overview.validation.reason}` : ''}`}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[13px] text-foreground">{lic.keyMasked}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${LICENSE_STATUS_META[lic.status].cls}`}>
                {LICENSE_STATUS_META[lic.status].label}
              </span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{lic.plan}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            {[
              ['Inicia', fmtDate(lic.startsAt)],
              ['Vence', lic.expiresAt ? fmtDate(lic.expiresAt) : 'Perpetua'],
              ['Plan', lic.plan],
              ['Máx. usuarios', lic.maxUsers ?? 'Plan'],
              ['Máx. sucursales', lic.maxBranches ?? 'Plan'],
              ['Máx. dispositivos', lic.maxDevices ?? '∞'],
            ].map(([k, v]) => (
              <div key={k as string} className="flex flex-col">
                <span className="text-[11px] text-muted-foreground">{k}</span>
                <span className="text-[13px] font-semibold text-foreground">{v}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
            La gestión y renovación de la licencia la realiza el administrador de la plataforma Orbix.
          </p>
        </div>
      )}

      {/* Devices */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-[14px] font-bold text-foreground flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" /> Dispositivos
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {activeDevices.length} / {overview?.devices.max ?? '∞'} activos · La comandera se vincula escaneando un QR.
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => setShowEnroll(true)}
              disabled={overview?.devices.max != null && activeDevices.length >= overview.devices.max}
              title={overview?.devices.max != null && activeDevices.length >= overview.devices.max ? 'Alcanzaste el máximo de dispositivos de tu licencia' : undefined}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" /> Registrar dispositivo
            </button>
          )}
        </div>

        {devices.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-muted-foreground">
            <Smartphone className="w-8 h-8 mb-2 opacity-25" />
            <span className="text-[13px]">Sin dispositivos vinculados</span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {devices.map(d => (
              <div key={d.id} className={`flex items-center gap-3 px-5 py-3 ${d.status !== 'ACTIVE' ? 'opacity-50' : ''}`}>
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {DEVICE_TYPE_META[d.type].icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-foreground">{d.name ?? 'Dispositivo'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{DEVICE_TYPE_META[d.type].label}</span>
                    {d.status !== 'ACTIVE' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">Revocado</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">
                    {d.deviceId} · visto {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('es-MX') : '—'}
                  </div>
                </div>
                {canManage && d.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleRevoke(d)}
                    disabled={revoking === d.id}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 disabled:opacity-40 cursor-pointer"
                    title="Revocar dispositivo"
                  >
                    {revoking === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showEnroll && (
        <EnrollDeviceModal
          onClose={() => setShowEnroll(false)}
          onEnrolled={async () => { setShowEnroll(false); await load() }}
        />
      )}
    </div>
  )
}

// ─── RESTAURANTE SECTION ─────────────────────────────────────────────────────

const SERVICE_MODE_OPTIONS: { value: RestaurantServiceMode; label: string; desc: string }[] = [
  { value: 'TABLE_SERVICE',   label: 'Servicio por mesas',   desc: 'Solo órdenes ligadas a una mesa (meseros).' },
  { value: 'COUNTER_SERVICE', label: 'Servicio mostrador',   desc: 'Solo órdenes de mostrador, sin mesas.' },
  { value: 'HYBRID',          label: 'Híbrido',              desc: 'Mesas + mostrador en la misma sucursal.' },
]

function RestauranteSection({ canEdit }: { canEdit: boolean }) {
  const [mode, setMode] = useState<RestaurantServiceMode>('TABLE_SERVICE')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchTenantInfo()
      .then(info => setMode(info.restaurantServiceMode ?? 'TABLE_SERVICE'))
      .catch(() => setError('Error al cargar configuración'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false)
    try {
      await updateTenantInfo({ restaurantServiceMode: mode })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="text-base font-bold text-foreground mb-1">Restaurante</div>
      <div className="text-xs text-muted-foreground mb-6">Configura el modo de servicio para la comandera móvil.</div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
      ) : (
        <div className="max-w-lg flex flex-col gap-5">
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-3">Modo de servicio</div>
            <div className="flex flex-col gap-2">
              {SERVICE_MODE_OPTIONS.map(opt => (
                <label key={opt.value}
                  className={`flex items-start gap-3 px-4 py-3.5 border rounded-xl cursor-pointer transition-all
                    ${mode === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-muted/30'
                    } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="serviceMode"
                    value={opt.value}
                    checked={mode === opt.value}
                    onChange={() => canEdit && setMode(opt.value)}
                    className="mt-0.5 accent-primary"
                    disabled={!canEdit}
                  />
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">{opt.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          {canEdit && (
            <button onClick={handleSave} disabled={saving}
              className="self-start px-5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60 flex items-center gap-2">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</> : saved ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          )}
          {!canEdit && <p className="text-xs text-muted-foreground">Sin permiso para editar configuración de restaurante.</p>}
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function Configuracion() {
  const { enabledModules } = useAuthStore()
  const showBranches   = enabledModules.includes('branches')
  const showRestaurant = enabledModules.includes('dining-areas') || enabledModules.includes('restaurant')

  const [activeSection, setActiveSection] = useState("empresa")
  const sections = [
    { id: "empresa",        label: "Empresa" },
    { id: "pos",            label: "POS / Caja" },
    ...(showBranches    ? [{ id: "sucursales",  label: "Sucursales" }] : []),
    ...(showRestaurant  ? [{ id: "restaurante", label: "Restaurante" }] : []),
    { id: "impresoras",     label: "Impresoras" },
    { id: "licencia",       label: "Licencia y dispositivos" },
    { id: "facturacion",    label: "Facturación" },
    { id: "notificaciones", label: "Notificaciones" },
  ]

  // ─── Branches list (for printers section) ────────────────────────────────
  const [branchList, setBranchList] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    if (activeSection !== 'impresoras') return
    fetchBranches().then(bs => setBranchList(bs.map(b => ({ id: b.id, name: b.name })))).catch(() => {})
  }, [activeSection])

  // ─── Empresa / Branding ───────────────────────────────────────────────────
  const { setTenantBranding, loadTenantBranding } = useERPStore()
  const { permissions, user, plan } = useAuthStore()
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
    setInfoSaving(true); setInfoError(null); setInfoSaved(false)
    try {
      const updated = await updateTenantInfo(info)
      setInfo(updated); setTenantBranding(updated)
      setInfoSaved(true); setTimeout(() => setInfoSaved(false), 2500)
    } catch { setInfoError('Error al guardar información') }
    finally { setInfoSaving(false) }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImageError(null); setLogoUploading(true)
    try { const { logoUrl } = await uploadTenantLogo(file); setInfo(p => p ? { ...p, logoUrl } : p); await loadTenantBranding() }
    catch { setImageError('Error al subir logo') }
    finally { setLogoUploading(false); if (logoRef.current) logoRef.current.value = '' }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImageError(null); setBannerUploading(true)
    try { const { bannerUrl } = await uploadTenantBanner(file); setInfo(p => p ? { ...p, bannerUrl } : p); await loadTenantBranding() }
    catch { setImageError('Error al subir banner') }
    finally { setBannerUploading(false); if (bannerRef.current) bannerRef.current.value = '' }
  }

  async function handleDeleteLogo() {
    if (!confirm('¿Eliminar logo?')) return
    setImageError(null); setLogoUploading(true)
    try { await deleteTenantLogo(); setInfo(p => p ? { ...p, logoUrl: undefined } : p); await loadTenantBranding() }
    catch { setImageError('Error al eliminar logo') }
    finally { setLogoUploading(false) }
  }

  async function handleDeleteBanner() {
    if (!confirm('¿Eliminar banner?')) return
    setImageError(null); setBannerUploading(true)
    try { await deleteTenantBanner(); setInfo(p => p ? { ...p, bannerUrl: undefined } : p); await loadTenantBranding() }
    catch { setImageError('Error al eliminar banner') }
    finally { setBannerUploading(false) }
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
    setPosSaving(true); setPosError(null); setPosSaved(false)
    try { const updated = await updateSettings(posSettings); setPosSettings(updated); setPosSaved(true); setTimeout(() => setPosSaved(false), 2500) }
    catch { setPosError('Error al guardar configuración') }
    finally { setPosSaving(false) }
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
            <div className="text-xs text-muted-foreground mb-6">Branding, datos de contacto y configuración general.</div>

            {infoLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
            ) : (
              <div className="flex flex-col gap-7 max-w-2xl">
                {canBranding && (
                  <div>
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-3">Branding Visual</div>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Logo */}
                      <div>
                        <div className="text-xs font-semibold text-foreground mb-2">Logo</div>
                        <div className="relative rounded-xl border border-border bg-muted/20 overflow-hidden flex items-center justify-center" style={{ height: 120 }}>
                          {info?.logoUrl ? (
                            <>
                              <img src={info.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-3" />
                              {!logoUploading && (
                                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button onClick={() => logoRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs border border-white/20"><Upload className="w-3 h-3" /> Reemplazar</button>
                                  <button onClick={handleDeleteLogo} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/70 hover:bg-destructive/90 text-white text-xs border border-destructive/40"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              )}
                            </>
                          ) : (
                            <button onClick={() => logoRef.current?.click()} disabled={logoUploading} className="flex flex-col items-center gap-2 p-4 text-center cursor-pointer disabled:cursor-not-allowed w-full h-full">
                              <Building2 className="w-8 h-8 text-muted-foreground/30" />
                              <span className="text-xs text-muted-foreground">Subir logo</span>
                              <span className="text-[10px] text-muted-foreground/60">PNG, JPG, WebP · 400×400</span>
                            </button>
                          )}
                          {logoUploading && <div className="absolute inset-0 bg-background/70 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}
                        </div>
                        <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoUpload} />
                        {!info?.logoUrl && <button onClick={() => logoRef.current?.click()} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors cursor-pointer"><Upload className="w-3 h-3" /> Subir logo</button>}
                      </div>
                      {/* Banner */}
                      <div>
                        <div className="text-xs font-semibold text-foreground mb-2">Banner / Imagen representativa</div>
                        <div className="relative rounded-xl border border-border bg-muted/20 overflow-hidden flex items-center justify-center" style={{ height: 120 }}>
                          {info?.bannerUrl ? (
                            <>
                              <img src={info.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                              {!bannerUploading && (
                                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button onClick={() => bannerRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs border border-white/20"><Upload className="w-3 h-3" /> Reemplazar</button>
                                  <button onClick={handleDeleteBanner} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/70 hover:bg-destructive/90 text-white text-xs border border-destructive/40"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              )}
                            </>
                          ) : (
                            <button onClick={() => bannerRef.current?.click()} disabled={bannerUploading} className="flex flex-col items-center gap-2 p-4 text-center cursor-pointer disabled:cursor-not-allowed w-full h-full">
                              <Building2 className="w-8 h-8 text-muted-foreground/30" />
                              <span className="text-xs text-muted-foreground">Subir banner</span>
                              <span className="text-[10px] text-muted-foreground/60">PNG, JPG, WebP · 1200px</span>
                            </button>
                          )}
                          {bannerUploading && <div className="absolute inset-0 bg-background/70 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}
                        </div>
                        <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBannerUpload} />
                        {!info?.bannerUrl && <button onClick={() => bannerRef.current?.click()} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors cursor-pointer"><Upload className="w-3 h-3" /> Subir banner</button>}
                      </div>
                    </div>
                    {imageError && <p className="text-xs text-destructive mt-2">{imageError}</p>}
                  </div>
                )}

                <div>
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-3">Datos Generales</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                    <Field label="Nombre empresa" value={info?.name ?? ''} disabled={!canEdit} onChange={v => setField('name', v)} />
                    <Field label="Nombre a mostrar" value={info?.displayName ?? ''} disabled={!canEdit} onChange={v => setField('displayName', v)} placeholder="Alias o nombre corto" />
                    <Field label="RFC" value={info?.rfc ?? ''} disabled={!canEdit} onChange={v => setField('rfc', v)} />
                    <Field label="Teléfono" value={info?.phone ?? ''} disabled={!canEdit} onChange={v => setField('phone', v)} />
                    <Field label="Email" type="email" value={info?.email ?? ''} disabled={!canEdit} onChange={v => setField('email', v)} />
                    <Field label="Moneda base" value={info?.currency ?? ''} disabled={!canEdit} onChange={v => setField('currency', v)} placeholder="MXN" />
                    <div className="col-span-2"><Field label="Dirección" value={info?.address ?? ''} disabled={!canEdit} onChange={v => setField('address', v)} /></div>
                    <div className="col-span-2"><Field label="Zona horaria" value={info?.timezone ?? ''} disabled={!canEdit} onChange={v => setField('timezone', v)} placeholder="America/Mexico_City" /></div>
                  </div>
                </div>

                {infoError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{infoError}</div>}
                {canEdit && (
                  <button onClick={handleSaveInfo} disabled={infoSaving} className="self-start px-5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60 flex items-center gap-2">
                    {infoSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</> : infoSaved ? '✓ Guardado' : 'Guardar cambios'}
                  </button>
                )}
                {!canEdit && <p className="text-xs text-muted-foreground">Sin permiso para editar información de empresa.</p>}
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
            ) : (
              <div className="max-w-sm flex flex-col gap-5">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Moneda de cambio en efectivo</label>
                  <select value={posSettings.cashChangeCurrency ?? 'MXN'} onChange={e => setPosSettings(p => ({ ...p, cashChangeCurrency: e.target.value as 'MXN' | 'USD' }))}
                    className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary">
                    <option value="MXN">MXN — Pesos mexicanos</option>
                    <option value="USD">USD — Dólares</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Define en qué moneda se entrega el cambio en efectivo.</p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Plazo de reembolso de apartados (horas)</label>
                  <input type="number" min={0} step={1} value={posSettings.layawayRefundWindowHours ?? 24}
                    onChange={e => setPosSettings(p => ({ ...p, layawayRefundWindowHours: Number(e.target.value) }))}
                    className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary" />
                  <p className="text-[11px] text-muted-foreground mt-1.5">Horas desde la creación del apartado en que se puede reembolsar sin autorización adicional. Usa 0 para sin límite.</p>
                </div>
                {posError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{posError}</div>}
                <button onClick={handleSavePosSettings} disabled={posSaving} className="self-start px-5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60 flex items-center gap-2">
                  {posSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</> : posSaved ? '✓ Guardado' : 'Guardar cambios'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── SUCURSALES ───────────────────────────────────────────────────── */}
        {activeSection === "sucursales" && showBranches && (
          <SucursalesSection plan={plan ?? 'PRO'} />
        )}

        {/* ── RESTAURANTE ──────────────────────────────────────────────────── */}
        {activeSection === "restaurante" && showRestaurant && (
          <RestauranteSection canEdit={canEdit} />
        )}

        {/* ── IMPRESORAS ───────────────────────────────────────────────────── */}
        {activeSection === "impresoras" && (
          <PrintersSection branches={branchList} />
        )}

        {/* ── LICENCIA Y DISPOSITIVOS ──────────────────────────────────────── */}
        {activeSection === "licencia" && (
          <LicenciaSection canManage={canEdit} />
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

function Field({ label, value, onChange, disabled = false, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={placeholder}
        className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed" />
    </div>
  )
}
