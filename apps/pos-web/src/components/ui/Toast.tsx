import { create } from 'zustand'
import { useEffect } from 'react'

/**
 * Toast único, centrado abajo, como en el diseño. No sustituye al bloque de
 * error de una pantalla: sirve para confirmaciones efímeras (producto agregado,
 * venta suspendida) y para avisos que no bloquean la operación.
 */

export type ToastTone = 'neutral' | 'error'

interface ToastState {
  message: string | null
  tone: ToastTone
  show: (message: string, tone?: ToastTone) => void
  hide: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  tone: 'neutral',
  show: (message, tone = 'neutral') => set({ message, tone }),
  hide: () => set({ message: null }),
}))

/** Atajo para dispararlo desde fuera de un componente. */
export const toast = (message: string, tone: ToastTone = 'neutral') => useToastStore.getState().show(message, tone)

export function ToastHost() {
  const { message, tone, hide } = useToastStore()

  useEffect(() => {
    if (!message) return
    const t = setTimeout(hide, 2600)
    return () => clearTimeout(t)
  }, [message, hide])

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        background: tone === 'error' ? 'var(--semantic-red-fg)' : 'var(--neutral-900)',
        color: 'var(--neutral-0)',
        borderRadius: 12,
        padding: '13px 20px',
        fontSize: 13.5,
        fontWeight: 600,
        boxShadow: '0 10px 26px oklch(0.15 0.01 250 / 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'min(560px, calc(100vw - 48px))',
        animation: 'orbix-rise .18s ease-out',
      }}
    >
      <span>{message}</span>
    </div>
  )
}
