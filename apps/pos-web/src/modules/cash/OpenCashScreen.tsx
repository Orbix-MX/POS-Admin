import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, useDisplayName } from '~/stores/session-store'
import { useCashStore } from '~/stores/cash-store'
import { Button } from '~/components/ui/Button'
import { Input } from '~/components/ui/Input'
import { NumericKeypad, QuickAmounts } from '~/components/ui/NumericKeypad'
import { Spinner } from '~/components/shared/StateBlock'
import { amount, money, toNumber } from '~/utils/money'

/**
 * Paso 3 de 3: apertura de caja.
 *
 * Envía `POST /cash-sessions` con el fondo inicial y el tipo de cambio del
 * turno. El TC es obligatorio para el backend y queda fijo durante toda la
 * sesión, así que se captura aquí y no se recalcula después.
 */
export function OpenCashScreen() {
  const navigate = useNavigate()
  const branch = useAuthStore((s) => s.currentBranch)
  const displayName = useDisplayName()
  const { session, checked, refresh, open, opening, openError } = useCashStore()

  const [fondo, setFondo] = useState('')
  const [rate, setRate] = useState('')
  const [now] = useState(() => new Date())

  useEffect(() => {
    if (!checked) void refresh(branch?.id)
  }, [checked, refresh, branch?.id])

  // Si la caja ya está abierta (otro equipo del mismo turno), no se abre otra.
  useEffect(() => {
    if (session?.status === 'ABIERTA') navigate('/pos', { replace: true })
  }, [session, navigate])

  const fondoValue = toNumber(fondo)
  const rateValue = toNumber(rate)
  const canOpen = rateValue > 0 && fondoValue >= 0 && !opening

  const fecha = useMemo(
    () => now.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    [now],
  )

  const onOpen = async () => {
    const created = await open({
      exchangeRateUsdMxn: rateValue,
      openingAmount: fondoValue,
      ...(branch?.id ? { branchId: branch.id } : {}),
    })
    if (created) navigate('/pos', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 48 }}>
      <div
        style={{
          width: 'min(980px, 100%)',
          background: 'var(--card)',
          border: '1px solid var(--hairline)',
          borderRadius: 18,
          overflow: 'hidden',
        }}
        className="pos-split--narrow"
      >
        <div style={{ padding: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 8 }}>
            Paso 3 de 3
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 6 }}>Apertura de caja</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted-foreground)', marginBottom: 28 }}>
            Registra el fondo con el que inicias el turno. Sin caja abierta no puedes cobrar.
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1,
              background: 'var(--hairline)',
              border: '1px solid var(--hairline)',
              borderRadius: 12,
              overflow: 'hidden',
              marginBottom: 28,
            }}
          >
            <InfoCell label="Usuario" value={displayName || '—'} />
            <InfoCell label="Fecha y hora" value={fecha} />
            <InfoCell label="Sucursal" value={branch?.name ?? '—'} />
            <InfoCell label="Tipo de cambio USD/MXN">
              <Input
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="17.20"
                aria-label="Tipo de cambio USD a MXN"
                style={{ height: 34, fontSize: 14, fontWeight: 600 }}
              />
            </InfoCell>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 10 }}>
            Fondo inicial
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              border: '1px solid var(--hairline)',
              borderRadius: 12,
              padding: '18px 20px',
              background: 'var(--neutral-0)',
            }}
          >
            <span style={{ fontSize: 34, fontWeight: 700, color: 'var(--muted-foreground)' }}>$</span>
            <span className="tabular" style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {amount(fondoValue)}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted-foreground)' }}>Usa el teclado numérico</span>
          </div>

          <div style={{ marginTop: 14 }}>
            <QuickAmounts
              amounts={[
                { label: '$500', value: '500' },
                { label: '$1,000', value: '1000' },
                { label: '$1,500', value: '1500' },
                { label: '$2,000', value: '2000' },
              ]}
              onPick={setFondo}
            />
          </div>

          {openError && (
            <div
              role="alert"
              style={{
                marginTop: 18,
                background: 'var(--semantic-red-bg)',
                color: 'var(--semantic-red-fg)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {openError}
            </div>
          )}

          {rateValue <= 0 && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--muted-foreground)' }}>
              Captura el tipo de cambio del turno para poder abrir la caja.
            </div>
          )}
        </div>

        <div
          style={{
            background: 'var(--neutral-0)',
            borderLeft: '1px solid var(--hairline)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <NumericKeypad value={fondo} onChange={setFondo} keyHeight={62} />

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              disabled={!canOpen}
              onClick={() => void onOpen()}
              style={{
                height: 64,
                width: '100%',
                cursor: canOpen ? 'pointer' : 'not-allowed',
                border: 'none',
                borderRadius: 12,
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                fontFamily: 'inherit',
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: '0.01em',
                boxShadow: '0 4px 10px oklch(0.52 0.18 250 / 0.25)',
                opacity: canOpen ? 1 : 0.5,
              }}
            >
              {opening ? <Spinner size={18} color="var(--primary-foreground)" /> : `Abrir caja con ${money(fondoValue)}`}
            </button>
            <Button variant="ghost" block style={{ height: 40 }} onClick={() => navigate('/seleccionar')}>
              Regresar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCell({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', padding: '14px 16px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 3 }}>{label}</div>
      {children ?? <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>}
    </div>
  )
}
