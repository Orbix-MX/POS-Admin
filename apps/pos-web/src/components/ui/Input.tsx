import { useState, forwardRef, type InputHTMLAttributes } from 'react'

/**
 * Port TypeScript de `components/forms/Input.jsx` del Orbix Design System.
 *
 * El design system define 32px de alto; las pantallas del POS piden 40–44px
 * por ser táctiles, así que el alto se pasa vía `style` desde cada pantalla
 * en lugar de introducir una escala nueva.
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ style, onFocus, onBlur, ...rest }, ref) {
    const [focus, setFocus] = useState(false)
    return (
      <input
        ref={ref}
        onFocus={(e) => {
          setFocus(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocus(false)
          onBlur?.(e)
        }}
        style={{
          height: 32,
          width: '100%',
          boxSizing: 'border-box',
          paddingInline: 10,
          fontSize: 13,
          fontFamily: 'var(--font-sans)',
          color: 'var(--foreground)',
          background: 'var(--card)',
          border: `1px solid ${focus ? 'var(--ring)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)',
          outline: 'none',
          boxShadow: focus ? '0 0 0 3px color-mix(in oklch, var(--ring) 25%, transparent)' : 'none',
          transition: 'all .15s ease',
          ...style,
        }}
        {...rest}
      />
    )
  },
)
