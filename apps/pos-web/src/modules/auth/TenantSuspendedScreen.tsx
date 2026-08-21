import { useAuthStore } from '~/stores/session-store'
import { Button } from '~/components/ui/Button'
import { BrandLockup } from '~/components/shared/Brand'

/**
 * El backend responde 403 `TENANT_SUSPENDED` cuando la cuenta está suspendida.
 * El POS no puede resolverlo: solo lo comunica y ofrece salir.
 */
export function TenantSuspendedScreen() {
  const logout = useAuthStore((s) => s.logout)

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--neutral-0)' }}>
      <div style={{ width: 'min(460px, 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <BrandLockup />
        <div
          style={{
            width: '100%',
            background: 'var(--card)',
            border: '1px solid var(--hairline)',
            borderRadius: 18,
            padding: 28,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Cuenta suspendida</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted-foreground)', marginBottom: 20 }}>
            Esta empresa está suspendida y no puede registrar ventas. Contacta al administrador de Orbix para reactivarla.
          </div>
          <Button variant="outline" size="lg" block style={{ height: 42 }} onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  )
}
