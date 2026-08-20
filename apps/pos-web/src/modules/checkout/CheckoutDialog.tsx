import { useEffect } from 'react'
import { NumericKeypad, QuickAmounts } from '~/components/ui/NumericKeypad'
import { Button } from '~/components/ui/Button'
import { Icon, type IconName } from '~/components/shared/Icon'
import { Spinner } from '~/components/shared/StateBlock'
import { useNetworkStatus } from '~/app/providers/NetworkStatusProvider'
import { useCartStore } from '~/stores/cart-store'
import { PAYMENT_METHOD_LABELS, type MixedField, type PaymentMethod, type useCheckout } from '~/hooks/use-checkout'
import { amount, money } from '~/utils/money'

/**
 * Pantalla de cobro.
 *
 * Solo captura y valida lo mínimo de UI (que lo recibido cubra el total). El
 * cálculo del cambio se hace para mostrarlo y para enviarlo como `changeAmount`,
 * que es lo que el backend ya espera; los importes definitivos de la venta los
 * fija el servidor.
 */

const METHODS: { key: PaymentMethod; icon: IconName }[] = [
  { key: 'efectivo', icon: 'cash' },
  { key: 'tarjeta', icon: 'card' },
  { key: 'transferencia', icon: 'transfer' },
  { key: 'mixto', icon: 'split' },
]

const MIXED_FIELDS: MixedField[] = ['efectivo', 'tarjeta', 'transferencia']

export function CheckoutDialog({
  checkout,
  onClose,
  onCompleted,
}: {
  checkout: ReturnType<typeof useCheckout>
  onClose: () => void
  onCompleted: (orderId: string) => void
}) {
  const customer = useCartStore((s) => s.customer)
  const lineCount = useCartStore((s) => s.lines.length)
  const { online } = useNetworkStatus()

  const {
    method,
    selectMethod,
    mixed,
    activeMixedField,
    setActiveMixedField,
    keypadValue,
    setKeypadValue,
    totals,
    totalReceived,
    change,
    missing,
    canConfirm,
    submitting,
    error,
  } = checkout

  const confirm = async () => {
    const sale = await checkout.confirm()
    if (sale) onCompleted(sale.order.id)
  }

  // Enter cobra, Esc cierra: el flujo se puede completar sin soltar el teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
      if (e.key === 'Enter' && canConfirm) {
        e.preventDefault()
        void confirm()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const isCash = method === 'efectivo' || method === 'mixto'
  const changeLabel = missing > 0 ? 'Faltante' : 'Cambio'
  const changeValue = missing > 0 ? missing : change
  const changeFg = missing > 0 ? 'var(--semantic-red-fg)' : change > 0 ? 'var(--semantic-green-fg)' : 'var(--foreground)'
  const changeBg = missing > 0 ? 'var(--semantic-red-bg)' : change > 0 ? 'var(--semantic-green-bg)' : 'var(--neutral-0)'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cobro"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'oklch(0.15 0.01 250 / 0.45)',
        backdropFilter: 'blur(2px)',
        display: 'grid',
        placeItems: 'center',
        padding: 40,
      }}
    >
      <div
        style={{
          width: 'min(1060px, 100%)',
          maxHeight: 'calc(100vh - 80px)',
          background: 'var(--card)',
          borderRadius: 20,
          border: '1px solid var(--hairline)',
          boxShadow: '0 18px 50px oklch(0.15 0.01 250 / 0.22)',
          overflow: 'hidden',
        }}
        className="pos-split"
      >
        <div style={{ padding: '28px 30px', display: 'flex', flexDirection: 'column', overflow: 'auto' }} className="pos-scroll">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, gap: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>Cobro</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>
                {lineCount} {lineCount === 1 ? 'línea' : 'líneas'} · {customer?.nombre ?? 'Venta de mostrador'}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              aria-label="Cerrar cobro"
              style={{
                cursor: submitting ? 'not-allowed' : 'pointer',
                width: 34,
                height: 34,
                borderRadius: 10,
                border: '1px solid var(--hairline)',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: 16,
                color: 'var(--muted-foreground)',
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
            {METHODS.map((m) => {
              const on = method === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => selectMethod(m.key)}
                  style={{
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    padding: '14px 12px',
                    borderRadius: 12,
                    border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                    background: on ? 'var(--brand-blue-50)' : 'var(--card)',
                    color: on ? 'var(--brand-blue-700)' : 'var(--muted-foreground)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 8,
                    minHeight: 86,
                  }}
                >
                  <Icon name={m.icon} size={20} />
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{PAYMENT_METHOD_LABELS[m.key]}</span>
                </button>
              )
            })}
          </div>

          {method === 'mixto' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
              {MIXED_FIELDS.map((field) => {
                const on = activeMixedField === field
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => setActiveMixedField(field)}
                    style={{
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                      background: 'var(--card)',
                      boxShadow: on ? '0 0 0 3px oklch(0.52 0.18 250 / 0.15)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>
                      {PAYMENT_METHOD_LABELS[field]}
                    </div>
                    <div className="tabular" style={{ fontSize: 20, fontWeight: 800 }}>
                      ${amount(Number(mixed[field] || 0))}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div style={{ border: '1px solid var(--hairline)', borderRadius: 14, overflow: 'hidden' }}>
            <AmountRow label="Total" value={money(totals.total)} background="var(--neutral-0)" />
            <AmountRow label="Recibido" value={money(totalReceived)} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: changeBg,
                gap: 12,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: changeFg }}>
                {changeLabel}
              </span>
              <span className="tabular" style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em', color: changeFg }}>
                {money(changeValue)}
              </span>
            </div>
          </div>

          {error && (
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
              {error}
            </div>
          )}

          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--muted-foreground)' }}>
            <span
              style={{ width: 7, height: 7, borderRadius: '50%', background: online ? 'var(--semantic-green-fg)' : 'var(--semantic-red-fg)' }}
            />
            <span>
              {online
                ? 'La venta se registra en Orbix y se descuenta del inventario al confirmar.'
                : 'Sin conexión: no es posible registrar la venta hasta recuperar la red.'}
            </span>
          </div>
        </div>

        <div
          style={{
            background: 'var(--neutral-0)',
            borderLeft: '1px solid var(--hairline)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'auto',
          }}
          className="pos-scroll"
        >
          <QuickAmounts
            layout="stretch"
            amounts={[
              { label: 'Exacto', value: String(totals.total) },
              { label: '$200', value: '200' },
              { label: '$500', value: '500' },
              { label: '$1,000', value: '1000' },
            ]}
            onPick={setKeypadValue}
          />

          <NumericKeypad value={keypadValue} onChange={setKeypadValue} keyHeight={64} />

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={!canConfirm || !online}
              style={{
                height: 70,
                width: '100%',
                cursor: canConfirm && online ? 'pointer' : 'not-allowed',
                border: 'none',
                borderRadius: 13,
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                fontFamily: 'inherit',
                fontSize: 17,
                fontWeight: 800,
                letterSpacing: '0.04em',
                boxShadow: '0 4px 12px oklch(0.52 0.18 250 / 0.28)',
                opacity: canConfirm && online ? 1 : 0.45,
              }}
            >
              {submitting ? (
                <Spinner size={20} color="var(--primary-foreground)" />
              ) : missing > 0 ? (
                `FALTAN ${money(missing)}`
              ) : isCash && change > 0 ? (
                `COBRAR · CAMBIO ${money(change)}`
              ) : (
                'COBRAR'
              )}
            </button>
            <Button variant="ghost" block style={{ height: 40 }} disabled={submitting} onClick={onClose}>
              Cancelar cobro
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AmountRow({ label, value, background }: { label: string; value: string; background?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--hairline)',
        background: background ?? 'transparent',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
        {label}
      </span>
      <span className="tabular" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>
        {value}
      </span>
    </div>
  )
}
