import type { ReactNode } from 'react'
import { Button } from '~/components/ui/Button'

/**
 * Bloques de estado compartidos: cargando, error y vacío. Toda pantalla que
 * consume el API debe cubrir los tres — el POS nunca debe quedarse en blanco.
 */

export function Spinner({ size = 20, color = 'var(--primary)' }: { size?: number; color?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${Math.max(2, Math.round(size / 10))}px solid color-mix(in oklch, ${color} 25%, transparent)`,
        borderTopColor: color,
        animation: 'orbix-spin .7s linear infinite',
      }}
    />
  )
}

function Shell({ children, minHeight }: { children: ReactNode; minHeight: number | string }) {
  return (
    <div
      style={{
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 32,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}

export function LoadingState({ label = 'Cargando…', minHeight = 240 }: { label?: string; minHeight?: number | string }) {
  return (
    <Shell minHeight={minHeight}>
      <Spinner size={26} />
      <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{label}</div>
    </Shell>
  )
}

export function ErrorState({
  title = 'No se pudo cargar',
  message,
  onRetry,
  minHeight = 240,
}: {
  title?: string
  message?: string | null
  onRetry?: () => void
  minHeight?: number | string
}) {
  return (
    <Shell minHeight={minHeight}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: 'var(--semantic-red-bg)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--semantic-red-fg)" strokeWidth="1.9" strokeLinecap="round">
          <path d="M12 7v6" />
          <path d="M12 17h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      {message && <div style={{ fontSize: 13, color: 'var(--muted-foreground)', maxWidth: 380 }}>{message}</div>}
      {onRetry && (
        <div style={{ marginTop: 6 }}>
          <Button variant="outline" size="lg" style={{ height: 40 }} onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )}
    </Shell>
  )
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  minHeight = 240,
}: {
  icon?: ReactNode
  title: string
  message?: string
  action?: ReactNode
  minHeight?: number | string
}) {
  return (
    <Shell minHeight={minHeight}>
      {icon && (
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--muted)', display: 'grid', placeItems: 'center' }}>
          {icon}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      {message && <div style={{ fontSize: 13, color: 'var(--muted-foreground)', maxWidth: 340 }}>{message}</div>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </Shell>
  )
}
