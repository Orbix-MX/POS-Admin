import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from '~/components/ui/Dialog'
import { Button } from '~/components/ui/Button'
import { Spinner } from '~/components/shared/StateBlock'
import { useAuthStore } from '~/stores/session-store'
import { useCashStore, getTerminalRegisterId, isSellable } from '~/stores/cash-store'
import { listCashRegisters, type CashRegister } from '~/services/orbix'
import { sessionLabel } from '~/utils/cash-session-label'

/**
 * Cambio de caja sin cerrar el turno.
 *
 * La caja es del puesto, y la terminal la recuerda — pero un relevo que llega en
 * otro equipo, o alguien que se sienta en otra estación, necesita apuntar a la
 * caja que le toca. Elegir aquí solo cambia a qué caja mira esta terminal: la
 * sesión de la caja anterior sigue abierta y quien la tenga la sigue operando.
 *
 * Una caja abierta se puede elegir (es justo el caso del relevo). Una libre
 * lleva a la pantalla de apertura.
 */
export function CashRegisterPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const branch = useAuthStore((s) => s.currentBranch)
  const switchRegister = useCashStore((s) => s.switchRegister)

  const [registers, setRegisters] = useState<CashRegister[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const current = getTerminalRegisterId()

  useEffect(() => {
    if (!open) return
    setRegisters(null)
    setError(null)
    listCashRegisters()
      .then(setRegisters)
      .catch(() => setError('No se pudieron cargar las cajas de la sucursal'))
  }, [open])

  const pick = async (register: CashRegister) => {
    setBusy(true)
    const session = await switchRegister({ id: register.id, name: register.name }, branch?.id)
    setBusy(false)
    onClose()
    // Tener sesión no es poder vender: una caja EN_ARQUEO está viva pero parada.
    // Mandarla al POS hacía que el guard rebotara la navegación y la pantalla se
    // quedaba en blanco. Cada estado tiene su destino:
    //   vendible → punto de venta · viva pero parada → caja · sin sesión → apertura
    if (isSellable(session)) navigate('/pos', { replace: true })
    else navigate(session ? '/caja' : '/caja/apertura', { replace: true })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cambiar de caja"
      description={`Cajas de ${branch?.name ?? 'la sucursal'}. Cambiar de caja no cierra ninguna sesión.`}
      width="480px"
    >
      {error && <div style={{ fontSize: 13, color: 'var(--semantic-red-fg)' }}>{error}</div>}

      {!registers && !error && (
        <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
          <Spinner />
        </div>
      )}

      {registers?.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
          Esta sucursal todavía no tiene cajas dadas de alta.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {registers?.map((r) => {
          const live = r.sessions[0]
          const selected = r.id === current
          return (
            <button
              key={r.id}
              type="button"
              disabled={busy}
              onClick={() => void pick(r)}
              style={{
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: 12,
                fontFamily: 'inherit',
                cursor: busy ? 'wait' : 'pointer',
                background: selected ? 'var(--brand-blue-50)' : 'var(--card)',
                border: `1px solid ${selected ? 'var(--brand-blue-300)' : 'var(--hairline)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>
                  {live
                    ? `${sessionLabel(live.status)} · ${live.openedBy?.email ?? 'otro usuario'}`
                    : 'Sin sesión abierta'}
                </div>
              </div>
              {selected && (
                <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: 'var(--brand-blue-700)' }}>
                  Esta terminal
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </Dialog>
  )
}
