import { useEffect, type ReactNode } from 'react'

/**
 * Port TypeScript de `components/overlays/Dialog.jsx` del Orbix Design System.
 * `width` permite los diálogos anchos que usa el POS sin cambiar el token de radio.
 */
export interface DialogProps {
  open: boolean
  onClose?: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: string
}

export function Dialog({ open, onClose, title, description, children, footer, width }: DialogProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'oklch(0.15 0.01 250 / 0.45)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: width ?? 'min(400px,calc(100% - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          overflow: 'auto',
          background: 'var(--popover)',
          color: 'var(--popover-foreground)',
          borderRadius: 'var(--radius-xl)',
          padding: 16,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          fontFamily: 'var(--font-sans)',
          position: 'relative',
        }}
      >
        {onClose && (
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              border: 'none',
              background: 'transparent',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--muted-foreground)',
              fontSize: 16,
            }}
          >
            ×
          </button>
        )}
        {(title || description) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 28 }}>
            {title && <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>}
            {description && <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{description}</div>}
          </div>
        )}
        {children}
        {footer && (
          <div
            style={{
              margin: '0 -16px -16px',
              padding: 16,
              borderTop: '1px solid var(--border)',
              background: 'color-mix(in oklch, var(--muted) 50%, transparent)',
              borderRadius: '0 0 var(--radius-xl) var(--radius-xl)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
