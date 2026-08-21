import { useState } from 'react'

/**
 * Teclado numérico táctil del POS. Lo comparten la apertura de caja y el cobro.
 * Mantiene el valor como string para respetar el comportamiento del diseño
 * (`C` limpia, `⌫` borra el último dígito, un solo punto decimal).
 */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as const

export function applyKey(current: string, key: string, maxLength = 9): string {
  if (key === '⌫') return current.slice(0, -1)
  if (key === 'C') return ''
  if (key === '.') return current.includes('.') ? current : (current === '' ? '0.' : current + '.')
  const next = (current + key).replace(/^0+(?=\d)/, '')
  // Como máximo dos decimales, igual que la moneda.
  const [, dec] = next.split('.')
  if (dec !== undefined && dec.length > 2) return current
  return next.slice(0, maxLength)
}

interface KeyButtonProps {
  label: string
  height: number
  onPress: () => void
}

function KeyButton({ label, height, onPress }: KeyButtonProps) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)
  return (
    <button
      type="button"
      onClick={onPress}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setActive(false)
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        height,
        cursor: 'pointer',
        background: hover ? 'var(--muted)' : 'var(--card)',
        border: '1px solid var(--hairline)',
        borderRadius: 12,
        fontSize: height >= 64 ? 21 : 20,
        fontWeight: 700,
        fontFamily: 'inherit',
        color: 'var(--foreground)',
        transform: active ? 'translateY(1px)' : 'none',
        transition: 'background .12s ease',
      }}
    >
      {label}
    </button>
  )
}

export interface NumericKeypadProps {
  value: string
  onChange: (next: string) => void
  /** Alto de cada tecla. 62px en apertura de caja, 64px en cobro. */
  keyHeight?: number
  maxLength?: number
}

export function NumericKeypad({ value, onChange, keyHeight = 62, maxLength = 9 }: NumericKeypadProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
      {KEYS.map((k) => (
        <KeyButton key={k} label={k} height={keyHeight} onPress={() => onChange(applyKey(value, k, maxLength))} />
      ))}
    </div>
  )
}

export interface QuickAmountsProps {
  amounts: { label: string; value: string }[]
  onPick: (value: string) => void
  /** `pill` en apertura de caja, `stretch` en el cobro. */
  layout?: 'pill' | 'stretch'
}

export function QuickAmounts({ amounts, onPick, layout = 'pill' }: QuickAmountsProps) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {amounts.map((a) => (
        <QuickAmountButton key={a.label} label={a.label} layout={layout} onPress={() => onPick(a.value)} />
      ))}
    </div>
  )
}

function QuickAmountButton({ label, layout, onPress }: { label: string; layout: 'pill' | 'stretch'; onPress: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onPress}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer',
        background: hover ? 'var(--muted)' : 'var(--card)',
        border: '1px solid var(--hairline)',
        borderRadius: 10,
        color: 'var(--foreground)',
        fontFamily: 'inherit',
        ...(layout === 'stretch'
          ? { flex: 1, height: 42, fontSize: 13, fontWeight: 700 }
          : { padding: '9px 14px', fontSize: 13, fontWeight: 600 }),
      }}
    >
      {label}
    </button>
  )
}
