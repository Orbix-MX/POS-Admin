import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '~/stores/session-store'
import { fetchTenantInfo, type TenantInfo } from '~/services/orbix'
import { Button } from '~/components/ui/Button'
import { Input } from '~/components/ui/Input'
import { BrandLockup } from '~/components/shared/Brand'
import { Spinner } from '~/components/shared/StateBlock'
import { translateMessage } from '~/utils/api-error'

/**
 * Inicio de sesión. Usa `useAuthStore.login` — el mismo del Admin Web — así que
 * comparte token, refresco y manejo de 401. No hay sesión paralela.
 *
 * Cuando el usuario pertenece a varias empresas, `login` deja `availableTenants`
 * y la selección se resuelve aquí mismo con `confirmTenant`, sin pantalla aparte.
 */
export function LoginScreen() {
  const { login, confirmTenant, loading, error, isAuthenticated, availableTenants } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    fetchTenantInfo()
      .then(setTenantInfo)
      .catch(() => setTenantInfo(null))
  }, [isAuthenticated])

  if (isAuthenticated) return <Navigate to="/seleccionar" replace />

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    void login(email.trim(), password)
  }

  const needsTenant = !!availableTenants && availableTenants.length > 1

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--neutral-0)', padding: 24 }}>
      <div style={{ width: 'min(420px, 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <BrandLockup />

        <div
          style={{
            width: '100%',
            background: 'var(--card)',
            border: '1px solid var(--hairline)',
            borderRadius: 18,
            boxShadow: '0 1px 2px oklch(0.15 0.01 250 / 0.06)',
            padding: 28,
          }}
        >
          {needsTenant ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Selecciona la empresa</div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 20 }}>
                Tu usuario opera en más de una empresa.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {availableTenants!.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={loading}
                    onClick={() => void confirmTenant(t.slug)}
                    style={{
                      textAlign: 'left',
                      cursor: loading ? 'wait' : 'pointer',
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>{t.slug}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <form onSubmit={onSubmit}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Iniciar sesión</div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 20 }}>
                Ingresa tus credenciales para continuar
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Usuario">
                  <Input
                    type="email"
                    autoComplete="username"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresa.mx"
                    style={{ height: 40, fontSize: 14 }}
                  />
                </Field>
                <Field label="Contraseña">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ height: 40, fontSize: 14 }}
                  />
                </Field>

                {translateMessage(error) && (
                  <div
                    role="alert"
                    style={{
                      background: 'var(--semantic-red-bg)',
                      color: 'var(--semantic-red-fg)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    {translateMessage(error)}
                  </div>
                )}

                <div style={{ marginTop: 6 }}>
                  <Button type="submit" size="lg" block disabled={loading || !email.trim() || !password} style={{ height: 44, fontSize: 15, fontWeight: 700 }}>
                    {loading ? <Spinner size={16} color="var(--primary-foreground)" /> : 'Ingresar'}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          {tenantInfo?.displayName ?? tenantInfo?.name ?? 'Orbix'} · Orbix POS 1.0
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted-foreground)' }}>{label}</span>
      {children}
    </label>
  )
}
