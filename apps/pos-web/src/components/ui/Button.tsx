import { useState, type ButtonHTMLAttributes, type CSSProperties } from 'react'

/**
 * Port TypeScript de `components/forms/Button.jsx` del Orbix Design System.
 * Los tamaños, variantes y transiciones son los del design system: no
 * introducir escalas nuevas aquí.
 */

export type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
export type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'

interface Dims {
  height: number | string
  width?: number
  paddingInline: number
  fontSize: number
  gap: number
}

const SIZES: Record<ButtonSize, Dims> = {
  default: { height: 32, paddingInline: 10, fontSize: 13, gap: 6 },
  xs: { height: 24, paddingInline: 8, fontSize: 12, gap: 4 },
  sm: { height: 28, paddingInline: 10, fontSize: 13, gap: 4 },
  lg: { height: 36, paddingInline: 10, fontSize: 13, gap: 6 },
  icon: { height: 32, width: 32, paddingInline: 0, fontSize: 13, gap: 0 },
  'icon-sm': { height: 28, width: 28, paddingInline: 0, fontSize: 13, gap: 0 },
  'icon-lg': { height: 36, width: 36, paddingInline: 0, fontSize: 13, gap: 0 },
}

function variantStyle(variant: ButtonVariant, hover: boolean): CSSProperties {
  switch (variant) {
    case 'outline':
      return { background: hover ? 'var(--muted)' : 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)' }
    case 'secondary':
      return { background: 'var(--secondary)', color: 'var(--secondary-foreground)', opacity: hover ? 0.85 : 1, border: '1px solid transparent' }
    case 'ghost':
      return { background: hover ? 'var(--muted)' : 'transparent', color: 'var(--foreground)', border: '1px solid transparent' }
    case 'destructive':
      return {
        background: hover
          ? 'color-mix(in oklch, var(--destructive) 20%, transparent)'
          : 'color-mix(in oklch, var(--destructive) 10%, transparent)',
        color: 'var(--destructive)',
        border: '1px solid transparent',
      }
    case 'link':
      return {
        background: 'transparent',
        color: 'var(--primary)',
        border: '1px solid transparent',
        textDecoration: hover ? 'underline' : 'none',
        textUnderlineOffset: 4,
        paddingInline: 0,
        height: 'auto',
      }
    default:
      return { background: 'var(--primary)', color: 'var(--primary-foreground)', opacity: hover ? 0.85 : 1, border: '1px solid transparent' }
  }
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** `block` estira el botón al ancho del contenedor, como en las pantallas del POS. */
  block?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export function Button({
  variant = 'default',
  size = 'default',
  block = false,
  disabled,
  style,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const dims = SIZES[size] ?? SIZES.default
  const vs = variantStyle(variant, hover)

  return (
    <button
      type={type}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setActive(false)
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: dims.height,
        width: block ? '100%' : dims.width,
        gap: dims.gap,
        paddingInline: dims.paddingInline,
        fontSize: dims.fontSize,
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        borderRadius: 'var(--radius-lg)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all .15s ease',
        outline: 'none',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        opacity: disabled ? 0.5 : ((vs.opacity as number | undefined) ?? 1),
        transform: active && !disabled ? 'translateY(1px)' : 'none',
        ...vs,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
