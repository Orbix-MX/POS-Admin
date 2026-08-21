import { googleAuthUrl } from '@web/services/core/auth-service'

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

/**
 * Entrada por Google en el POS. Navegación completa del navegador —el flujo de
 * redirect no se puede seguir desde un XHR—, de vuelta a `/auth/callback`.
 */
export function GoogleSignInButton({ disabled }: { disabled?: boolean }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <div style={{ height: 1, flex: 1, background: 'var(--hairline)' }} />
        <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>o</span>
        <div style={{ height: 1, flex: 1, background: 'var(--hairline)' }} />
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => window.location.assign(googleAuthUrl())}
        style={{
          height: 44,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: 'var(--card)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          fontSize: 14.5,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <GoogleMark />
        Continuar con Google
      </button>
    </>
  )
}
