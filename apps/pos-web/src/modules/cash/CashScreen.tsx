import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, useHasPermission } from '~/stores/session-store'
import { useCashStore, expectedCash } from '~/stores/cash-store'
import { Button } from '~/components/ui/Button'
import { Input } from '~/components/ui/Input'
import { Dialog } from '~/components/ui/Dialog'
import { Spinner } from '~/components/shared/StateBlock'
import { PosTopbar } from '~/modules/pos/components/PosTopbar'
import { PosNav } from '~/modules/pos/components/PosNav'
import { toast } from '~/components/ui/Toast'
import { sessionLabel } from '~/utils/cash-session-label'
import { AuthorizePinDialog } from './AuthorizePinDialog'
import { amount, money, toNumber } from '~/utils/money'

/**
 * Caja del turno: retiro, arqueo de control y corte, desde la propia terminal.
 *
 * Antes todo esto vivía solo en el Admin Web, así que el cajero tenía que salir
 * del POS —y en la práctica pedirle a otra persona— para cerrar su propio turno.
 * El Admin Web lo conserva: el dueño necesita poder cortar una caja a distancia
 * cuando alguien se fue sin hacerlo.
 *
 * El corte cierra también la sesión del usuario: terminado el turno, la terminal
 * queda libre para quien entra, sin arrastrar la sesión del que se fue.
 */
export function CashScreen() {
  const navigate = useNavigate()
  const branch = useAuthStore((s) => s.currentBranch)
  const logout = useAuthStore((s) => s.logout)
  const { session, registerName, working, checked, loading, refresh, withdraw, startCount, resume, count, close, reset } =
    useCashStore()

  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [countOpen, setCountOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)

  const canCount = useHasPermission('pos.cash:count')
  const canClose = useHasPermission('pos.cash:close')

  /**
   * Operación esperando el PIN de un supervisor. Se guarda la acción, no el
   * PIN: se ejecuta con él y se descarta en el mismo paso.
   */
  const [pending, setPending] = useState<{
    action: string
    run: (pin?: string) => Promise<string | null>
  } | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  /**
   * Ejecuta una operación de caja resolviendo antes quién la respalda: con
   * permiso propio va directa; sin él, abre el diálogo de PIN. El servidor
   * revalida en ambos casos — esto solo evita pedir el PIN cuando no hace falta.
   */
  const authorized = async (
    allowed: boolean,
    action: string,
    run: (pin?: string) => Promise<string | null>,
  ) => {
    if (allowed) {
      const err = await run()
      if (err) toast(err, 'error')
      return
    }
    setAuthError(null)
    setPending({ action, run })
  }

  // Esta pantalla no cuelga de `RequireOpenCash` —hay que poder operar una caja
  // EN_ARQUEO, que ese guard rechaza—, así que carga la sesión por su cuenta.
  // Sin esto, entrar por URL directa mostraba "sin caja abierta" con la caja abierta.
  useEffect(() => {
    if (!checked && !loading) void refresh(branch?.id)
  }, [checked, loading, refresh, branch?.id])

  const expected = expectedCash(session)

  if (!checked) {
    return (
      <Shell>
        <Card>
          <div style={{ display: 'grid', placeItems: 'center', padding: 20 }}>
            <Spinner />
          </div>
        </Card>
      </Shell>
    )
  }

  if (!session) {
    return (
      <Shell>
        <Card>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Sin caja abierta</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted-foreground)', marginBottom: 20 }}>
            Abre una caja para poder cobrar en esta terminal.
          </div>
          <Button onClick={() => navigate('/caja/apertura')}>Abrir caja</Button>
        </Card>
      </Shell>
    )
  }

  const inCount = session.status === 'EN_ARQUEO'

  return (
    <Shell>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{registerName ?? 'Caja'}</span>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 999,
              background: inCount ? 'var(--semantic-amber-bg, var(--secondary))' : 'var(--brand-blue-50)',
              color: inCount ? 'var(--semantic-amber-fg, var(--foreground))' : 'var(--brand-blue-700)',
            }}
          >
            {sessionLabel(session.status)}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 22 }}>
          {branch?.name ?? 'Sucursal'} · abierta por {session.openedBy?.email ?? '—'}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 1,
            background: 'var(--hairline)',
            border: '1px solid var(--hairline)',
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 24,
          }}
        >
          <Cell label="Efectivo esperado" value={expected != null ? money(expected) : '—'} strong />
          <Cell label="Fondo inicial" value={money(Number(session.openingAmount))} />
          <Cell label="Tipo de cambio" value={`$${amount(Number(session.exchangeRateUsdMxn))}/USD`} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {inCount ? (
            <Button
              disabled={working}
              onClick={() =>
                void authorized(canCount, 'Reanudar el cobro', async (pin) => {
                  const err = await resume(pin)
                  if (!err) toast('Caja reanudada')
                  return err
                })
              }
            >
              Reanudar cobro
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={working}
              onClick={() =>
                void authorized(canCount, 'El arqueo de caja', async (pin) => {
                  const err = await startCount(pin)
                  if (!err) setCountOpen(true)
                  return err
                })
              }
            >
              Arqueo de control
            </Button>
          )}

          <Button variant="outline" disabled={working || inCount} onClick={() => setWithdrawOpen(true)}>
            Retirar efectivo
          </Button>

          <Button variant="outline" disabled={working} onClick={() => setCountOpen(true)}>
            Registrar conteo
          </Button>

          <Button
            variant="destructive"
            disabled={working}
            style={{ marginLeft: 'auto' }}
            onClick={() => setCloseOpen(true)}
          >
            Corte de caja
          </Button>
        </div>

        {inCount && (
          <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--muted-foreground)' }}>
            La caja está congelada para contar: no se puede cobrar hasta reanudarla.
          </div>
        )}
      </Card>

      <WithdrawDialog
        open={withdrawOpen}
        working={working}
        onClose={() => setWithdrawOpen(false)}
        onSubmit={async (input) => {
          const err = await withdraw(input)
          if (!err) setWithdrawOpen(false)
          toast(err ?? 'Retiro registrado', err ? 'error' : undefined)
        }}
      />

      <CountDialog
        open={countOpen}
        working={working}
        expected={expected}
        onClose={() => setCountOpen(false)}
        onSubmit={(input) => {
          setCountOpen(false)
          void authorized(canCount, 'Registrar el conteo', async (pin) => {
            const { error } = await count({ ...input, ...(pin ? { authorizerPin: pin } : {}) })
            if (!error) toast('Conteo registrado')
            return error
          })
        }}
      />

      <CloseDialog
        open={closeOpen}
        working={working}
        expected={expected}
        onClose={() => setCloseOpen(false)}
        onSubmit={(input) => {
          setCloseOpen(false)
          void authorized(canClose, 'El corte de caja', async (pin) => {
            const err = await close({ ...input, ...(pin ? { authorizerPin: pin } : {}) })
            if (err) return err
            // Turno terminado: se cierra también la sesión del usuario para que
            // la terminal quede lista para quien entra.
            reset()
            await logout()
            return null
          })
        }}
      />

      <AuthorizePinDialog
        open={pending != null}
        title="Autorización requerida"
        action={pending?.action ?? ''}
        working={working}
        error={authError}
        onClose={() => setPending(null)}
        onConfirm={async (pin) => {
          const err = await pending?.run(pin)
          // El error se queda en el diálogo: con un PIN mal tecleado hay que
          // poder reintentar sin repetir el formulario de corte entero.
          if (err) setAuthError(err)
          else setPending(null)
        }}
      />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PosTopbar suspendedCount={0} onOpenSuspended={() => undefined} onOpenCash={() => undefined} />
      <div className="pos-layout">
        <PosNav />
        <div style={{ flex: 1, overflow: 'auto', display: 'grid', placeItems: 'start center', padding: 32 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 'min(680px, 100%)',
        background: 'var(--card)',
        border: '1px solid var(--hairline)',
        borderRadius: 18,
        padding: 28,
      }}
    >
      {children}
    </div>
  )
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ background: 'var(--card)', padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
        {label}
      </div>
      <div className="tabular" style={{ fontSize: strong ? 22 : 16, fontWeight: strong ? 800 : 700, marginTop: 4 }}>
        {value}
      </div>
    </div>
  )
}

function WithdrawDialog({
  open,
  working,
  onClose,
  onSubmit,
}: {
  open: boolean
  working: boolean
  onClose: () => void
  onSubmit: (input: { amount: number; reason: string }) => void
}) {
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const parsed = toNumber(value)

  return (
    <Dialog open={open} onClose={onClose} title="Retirar efectivo" description="Baja el efectivo esperado del cajón y queda en la bitácora." width="420px">
      <Field label="Monto">
        <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" autoFocus />
      </Field>
      <Field label="Motivo">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Traslado a caja fuerte" />
      </Field>
      <DialogActions>
        <Button variant="secondary" onClick={onClose} disabled={working}>Cancelar</Button>
        <Button disabled={working || parsed <= 0 || !reason.trim()} onClick={() => onSubmit({ amount: parsed, reason: reason.trim() })}>
          {working ? <Spinner size={16} color="var(--primary-foreground)" /> : 'Retirar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function CountDialog({
  open,
  working,
  expected,
  onClose,
  onSubmit,
}: {
  open: boolean
  working: boolean
  expected: number | null
  onClose: () => void
  onSubmit: (input: { countedMxn: number; countedUsd?: number; reason?: string }) => void
}) {
  const [mxn, setMxn] = useState('')
  const [usd, setUsd] = useState('')
  const [reason, setReason] = useState('')
  const counted = toNumber(mxn)
  const diff = expected == null ? null : counted - expected

  return (
    <Dialog open={open} onClose={onClose} title="Registrar conteo" description="Cuenta el efectivo del cajón sin cerrar el turno." width="420px">
      <Field label="Contado MXN">
        <Input inputMode="decimal" value={mxn} onChange={(e) => setMxn(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" autoFocus />
      </Field>
      <Field label="Contado USD (opcional)">
        <Input inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" />
      </Field>
      <Field label="Motivo (opcional)">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Arqueo de medio turno" />
      </Field>

      {diff != null && mxn !== '' && (
        <Difference diff={diff} />
      )}

      <DialogActions>
        <Button variant="secondary" onClick={onClose} disabled={working}>Cancelar</Button>
        <Button
          disabled={working || mxn === ''}
          onClick={() =>
            onSubmit({
              countedMxn: counted,
              ...(usd !== '' ? { countedUsd: toNumber(usd) } : {}),
              ...(reason.trim() ? { reason: reason.trim() } : {}),
            })
          }
        >
          {working ? <Spinner size={16} color="var(--primary-foreground)" /> : 'Registrar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function CloseDialog({
  open,
  working,
  expected,
  onClose,
  onSubmit,
}: {
  open: boolean
  working: boolean
  expected: number | null
  onClose: () => void
  onSubmit: (input: { cashCounted: number; cashCountedUsd?: number; differenceReason?: string }) => void
}) {
  const [mxn, setMxn] = useState('')
  const [usd, setUsd] = useState('')
  const [reason, setReason] = useState('')
  const counted = toNumber(mxn)
  const diff = expected == null ? null : counted - expected

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Corte de caja"
      description="Cierra el turno con el efectivo contado. Al terminar se cerrará tu sesión."
      width="420px"
    >
      <Field label="Efectivo contado MXN">
        <Input inputMode="decimal" value={mxn} onChange={(e) => setMxn(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" autoFocus />
      </Field>
      <Field label="Efectivo contado USD (opcional)">
        <Input inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" />
      </Field>

      {diff != null && mxn !== '' && <Difference diff={diff} />}

      {/* El servidor exige motivo cuando la diferencia pasa el umbral del tenant;
          se ofrece siempre para no obligar a un segundo intento. */}
      <Field label="Motivo de la diferencia">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Obligatorio si la diferencia es grande" />
      </Field>

      <DialogActions>
        <Button variant="secondary" onClick={onClose} disabled={working}>Cancelar</Button>
        <Button
          variant="destructive"
          disabled={working || mxn === ''}
          onClick={() =>
            onSubmit({
              cashCounted: counted,
              ...(usd !== '' ? { cashCountedUsd: toNumber(usd) } : {}),
              ...(reason.trim() ? { differenceReason: reason.trim() } : {}),
            })
          }
        >
          {working ? <Spinner size={16} color="var(--primary-foreground)" /> : 'Cortar y salir'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Difference({ diff }: { diff: number }) {
  const ok = Math.abs(diff) < 0.005
  return (
    <div
      style={{
        marginTop: 4,
        marginBottom: 4,
        fontSize: 13,
        fontWeight: 700,
        color: ok ? 'var(--semantic-green-fg)' : 'var(--semantic-red-fg)',
      }}
    >
      {ok ? 'Sin diferencia' : `${diff > 0 ? 'Sobrante' : 'Faltante'} de ${money(Math.abs(diff))}`}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

function DialogActions({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>{children}</div>
}
