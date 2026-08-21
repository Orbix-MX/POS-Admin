import { useEffect, useState } from 'react'
import { Dialog } from '~/components/ui/Dialog'
import { Button } from '~/components/ui/Button'
import { Input } from '~/components/ui/Input'
import { money, round2, toNumber } from '~/utils/money'

/**
 * Descuento sobre la venta.
 *
 * El backend solo acepta descuento **por línea** (`items[].discount`) o cupón;
 * el importe capturado aquí se reparte proporcionalmente entre las líneas al
 * cobrar (`distributeOrderDiscount`) y es el servidor quien lo aplica y lo
 * refleja en `order.discount`.
 *
 * El diseño incluye además una autorización por PIN de encargado; el backend no
 * expone ningún mecanismo equivalente, así que no se simula — ver
 * BACKEND-GAPS.md, «Autorización de descuento».
 */
export function DiscountDialog({
  open,
  onClose,
  onApply,
  currentDiscount,
  subtotal,
}: {
  open: boolean
  onClose: () => void
  onApply: (amount: number) => void
  currentDiscount: number
  subtotal: number
}) {
  const [mode, setMode] = useState<'amount' | 'percent'>('amount')
  const [raw, setRaw] = useState('')

  useEffect(() => {
    if (open) {
      setMode('amount')
      setRaw(currentDiscount > 0 ? String(currentDiscount) : '')
    }
  }, [open, currentDiscount])

  const value = toNumber(raw)
  const computed = mode === 'percent' ? round2((subtotal * Math.min(value, 100)) / 100) : round2(value)
  const capped = Math.min(computed, subtotal)
  const exceeds = computed > subtotal

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Descuento sobre la venta"
      description="Se reparte entre las líneas y el servidor lo aplica al registrar la venta."
      footer={
        <>
          <Button variant="ghost" style={{ height: 38 }} onClick={onClose}>
            Cancelar
          </Button>
          {currentDiscount > 0 && (
            <Button
              variant="outline"
              style={{ height: 38 }}
              onClick={() => {
                onApply(0)
                onClose()
              }}
            >
              Quitar descuento
            </Button>
          )}
          <Button
            style={{ height: 38, fontWeight: 700 }}
            disabled={capped <= 0}
            onClick={() => {
              onApply(capped)
              onClose()
            }}
          >
            Aplicar {money(capped)}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 3, background: 'var(--muted)', borderRadius: 11, padding: 3 }}>
        <ModeTab active={mode === 'amount'} label="Importe" onClick={() => setMode('amount')} />
        <ModeTab active={mode === 'percent'} label="Porcentaje" onClick={() => setMode('percent')} />
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted-foreground)' }}>
          {mode === 'amount' ? 'Descuento en pesos' : 'Porcentaje sobre el subtotal'}
        </span>
        <Input
          autoFocus
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value.replace(/[^\d.]/g, ''))}
          placeholder={mode === 'amount' ? '0.00' : '10'}
          style={{ height: 44, fontSize: 18, fontWeight: 700 }}
        />
      </label>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted-foreground)' }}>
        <span>Subtotal de la venta</span>
        <span className="tabular" style={{ fontWeight: 600, color: 'var(--foreground)' }}>
          {money(subtotal)}
        </span>
      </div>

      {exceeds && (
        <div
          role="alert"
          style={{ background: 'var(--semantic-yellow-bg)', color: 'var(--semantic-yellow-fg)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 600 }}
        >
          El descuento no puede superar el subtotal; se aplicará {money(capped)}.
        </div>
      )}
    </Dialog>
  )
}

function ModeTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        cursor: 'pointer',
        fontFamily: 'inherit',
        height: 34,
        borderRadius: 9,
        border: 'none',
        background: active ? 'var(--card)' : 'transparent',
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        fontSize: 12.5,
        fontWeight: 700,
        boxShadow: active ? '0 1px 2px oklch(0.15 0.01 250 / 0.08)' : 'none',
      }}
    >
      {label}
    </button>
  )
}
