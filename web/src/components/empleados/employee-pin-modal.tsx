import { useEffect, useState } from 'react'
import { Loader2, KeyRound, Trash2 } from 'lucide-react'
import { FormModal } from '@/components/shared/form-modal'
import { assignEmployeePin, clearEmployeePin } from '@/services/core/staff-service'
import { fetchRoles, type Rol } from '@/services/core/roles-service'
import type { Empleado } from '@/types/erp'

const INPUT_CLS =
  'w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary'

interface Props {
  empleado: Empleado
  onClose: () => void
  onSaved: () => void
}

/**
 * Assign / replace / clear an employee's comandera PIN. The PIN is write-only
 * (the backend stores only a hash and never returns it); we just show whether
 * one is set. The optional role sources the operator's permissions in the app.
 */
export function EmployeePinModal({ empleado, onClose, onSaved }: Props) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [roleId, setRoleId] = useState(empleado.roleId ?? '')
  const [roles, setRoles] = useState<Rol[]>([])
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRoles().then(setRoles).catch(() => {})
  }, [])

  const pinValid = /^\d{4,6}$/.test(pin)
  const canSave = pinValid && pin === confirm

  async function handleSave() {
    if (!canSave) {
      setError(pin !== confirm ? 'Los PIN no coinciden.' : 'El PIN debe tener entre 4 y 6 dígitos.')
      return
    }
    setSaving(true); setError(null)
    try {
      await assignEmployeePin(empleado.id, pin, roleId || undefined)
      onSaved()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo guardar el PIN.')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!window.confirm('¿Quitar el PIN de este empleado? No podrá iniciar sesión en la comandera.')) return
    setClearing(true); setError(null)
    try {
      await clearEmployeePin(empleado.id)
      onSaved()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo quitar el PIN.')
    } finally {
      setClearing(false)
    }
  }

  return (
    <FormModal open onClose={onClose} title="PIN de comandera">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5 p-3 bg-muted rounded-lg">
          <KeyRound className="w-4 h-4 text-primary shrink-0" />
          <div className="text-[12px] text-muted-foreground leading-snug">
            {empleado.nombre} {empleado.hasPin
              ? <>· <span className="text-green-600 font-semibold">PIN asignado</span></>
              : <>· <span className="text-amber-600 font-semibold">sin PIN</span></>}
            <div>El mesero entra a la app con este PIN (4–6 dígitos). No usa correo ni contraseña.</div>
          </div>
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 rounded-lg text-[12px] text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Nuevo PIN *</label>
            <input
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              className={`${INPUT_CLS} tracking-[0.4em] text-center font-mono`}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Confirmar PIN *</label>
            <input
              value={confirm}
              onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              className={`${INPUT_CLS} tracking-[0.4em] text-center font-mono`}
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Rol operativo (permisos)</label>
          <select value={roleId} onChange={e => setRoleId(e.target.value)} className={INPUT_CLS}>
            <option value="">— Sin rol (sin permisos especiales) —</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">Define qué puede hacer el mesero en la comandera.</p>
        </div>

        <div className="flex items-center justify-between gap-2.5 pt-1">
          {empleado.hasPin ? (
            <button
              onClick={handleClear}
              disabled={clearing || saving}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Quitar PIN
            </button>
          ) : <span />}
          <div className="flex gap-2.5">
            <button onClick={onClose} className="px-4.5 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={saving || clearing || !canSave}
              className="flex items-center gap-1.5 px-4.5 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
              {empleado.hasPin ? 'Cambiar PIN' : 'Asignar PIN'}
            </button>
          </div>
        </div>
      </div>
    </FormModal>
  )
}
