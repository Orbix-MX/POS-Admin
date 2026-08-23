import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { checkPasswordResetToken, resetPassword } from '@/services/core/auth-service'
import { PasswordRequirements } from '@/components/shared/password-requirements'
import { isPasswordValid } from '@/lib/password-policy'

type Stage = 'loading' | 'invalid' | 'form' | 'success'

function errMessage(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
}

/**
 * Completa el reseteo de contraseña. Pública, fuera del gate de sesión: quien
 * llega aquí puede no tener ninguna sesión iniciada — el token del correo es
 * la única credencial que hace falta.
 */
export function RestablecerContrasena() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [stage, setStage] = useState<Stage>('loading')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) { setStage('invalid'); return }
    setStage('loading')
    try {
      await checkPasswordResetToken(token)
      setStage('form')
    } catch {
      setStage('invalid')
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (!isPasswordValid(password)) {
      setSubmitError('La contraseña no cumple los requisitos indicados.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      await resetPassword(token, password)
      setStage('success')
    } catch (e) {
      // Puede llegar aquí si el token caducó justo entre el check y el envío
      // (poco probable con 1h de vida, pero posible) — se recomprueba en vez
      // de mostrar un error genérico sobre un formulario ya inútil.
      await load()
      setSubmitError(errMessage(e, 'No se pudo restablecer la contraseña.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (stage === 'loading') {
    return (
      <Centered>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </Centered>
    )
  }

  if (stage === 'invalid') {
    return (
      <Centered>
        <Card>
          <div className="flex flex-col items-center text-center gap-3">
            <XCircle className="w-10 h-10 text-red-500" />
            <h1 className="text-[16px] font-bold text-foreground">Enlace no válido</h1>
            <p className="text-[13px] text-muted-foreground">
              Este enlace ya se usó, caducó, o nunca fue válido. Pide uno nuevo.
            </p>
            <Link
              to="/recuperar-contrasena"
              className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold"
            >
              Pedir un enlace nuevo
            </Link>
          </div>
        </Card>
      </Centered>
    )
  }

  if (stage === 'success') {
    return (
      <Centered>
        <Card>
          <div className="flex flex-col items-center text-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
            <h1 className="text-[16px] font-bold text-foreground">Contraseña actualizada</h1>
            <p className="text-[13px] text-muted-foreground">
              Ya puedes iniciar sesión con tu nueva contraseña. Por seguridad, cerramos
              cualquier otra sesión que tuvieras abierta.
            </p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="mt-2 w-full py-2.5 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-bold cursor-pointer"
            >
              Iniciar sesión
            </button>
          </div>
        </Card>
      </Centered>
    )
  }

  // stage === 'form'
  return (
    <Centered>
      <Card>
        <h1 className="text-[16px] font-bold text-foreground mb-0.5">Elige tu nueva contraseña</h1>
        <p className="text-[13px] text-muted-foreground mb-5">
          Al confirmar, se cerrará cualquier otra sesión activa de tu cuenta.
        </p>

        {submitError && (
          <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900 rounded-lg text-[13px] text-red-700 dark:text-red-400">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                required
                className="w-full px-3.5 py-2.5 pr-10 border border-border rounded-lg bg-muted text-foreground text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground bg-transparent border-none cursor-pointer p-0">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordRequirements password={password} alwaysVisible />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-bold cursor-pointer disabled:opacity-60"
          >
            {submitting ? 'Guardando…' : 'Restablecer contraseña'}
          </button>
        </form>
      </Card>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px] flex flex-col gap-4">
        {children}
        <p className="text-center text-[11px] text-muted-foreground/60">
          Powered by Orbix ERP
        </p>
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-card border border-border rounded-2xl p-7 shadow-sm">{children}</div>
}
