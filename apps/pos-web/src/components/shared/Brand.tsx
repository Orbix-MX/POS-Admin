/** Lockup de marca "Orbix POS" tal como lo define el diseño. */
export function BrandLockup({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  if (size === 'sm') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src="/logo.svg" alt="" width={24} height={24} style={{ objectFit: 'contain' }} />
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>
          Orbix<span style={{ color: 'var(--primary)' }}> POS</span>
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <img
        src="/logo.svg"
        alt="Orbix"
        width={56}
        height={56}
        style={{ objectFit: 'contain', filter: 'drop-shadow(0 8px 20px oklch(0.52 0.18 250 / 0.25))' }}
      />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Orbix</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--primary)',
            border: '1px solid var(--brand-blue-100)',
            background: 'var(--brand-blue-50)',
            padding: '3px 8px',
            borderRadius: 999,
          }}
        >
          POS
        </span>
      </div>
    </div>
  )
}
