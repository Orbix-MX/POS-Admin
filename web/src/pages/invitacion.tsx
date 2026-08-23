import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import {
  fetchInvitationPreview, acceptInvitation,
} from '@/services/core/invitations-service'
import type { InvitationPreview } from '@/services/core/invitations-service'
import { PasswordRequirements } from '@/components/shared/password-requirements'
import { isPasswordValid } from '@/lib/password-policy'

type Stage = 'loading' | 'error' | 'form' | 'wrong-account' | 'success'

function errMessage(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
}

function errCode(e: unknown): string | undefined {
  return (e as { response?: { data?: { code?: string } } })?.response?.data?.code
}

/**
 * Pantalla de aceptación de invitación, fuera del flujo normal de sesión: quien
 * llega aquí puede no tener cuenta todavía, o tenerla pero sin sesión iniciada.
 *
 * Dos caminos según la respuesta del preview:
 *  - la cuenta no existe → la persona fija su nombre y contraseña aquí mismo.
 *  - la cuenta existe → tiene que iniciar sesión con ESE correo. Si ya hay una
 *    sesión de otra cuenta, se le pide cerrarla primero: el enlace por sí solo
 *    no basta para entrar a la empresa ajena.
 */
export function InvitacionAceptar() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user, login, logout, init, loading: authLoading } = useAuthStore()

  // Esta página vive fuera del gate normal (TenantAuthGate), que es quien
  // llama a `init()` en el resto de la app. Sin esto, un token ya guardado en
  // localStorage deja `isAuthenticated: true` pero `user: null` para siempre
  // -mismatch invisible que solo se nota como "undefined" en el botón.
  useEffect(() => { init() }, [init])

  const [stage, setStage] = useState<Stage>('loading')
  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) { setStage('error'); setErrorMsg('Enlace de invitación inválido.'); return }
    setStage('loading')
    try {
      const data = await fetchInvitationPreview(token)
      setPreview(data)
      setStage('form')
    } catch (e) {
      setErrorMsg(errMessage(e, 'Esta invitación no es válida.'))
      setStage('error')
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // Cuando la cuenta ya existe y hay sesión de OTRA persona, no tiene sentido
  // mostrar un formulario: hay que resolver eso primero.
  useEffect(() => {
    if (stage !== 'form' || !preview?.accountExists) return
    if (isAuthenticated && user && user.email.toLowerCase() !== preview.email.toLowerCase()) {
      setStage('wrong-account')
    }
  }, [stage, preview, isAuthenticated, user])

  const doAccept = useCallback(async (body: { firstName?: string; lastName?: string; password?: string }) => {
    if (!token) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await acceptInvitation(token, body)
      setStage('success')
    } catch (e) {
      const code = errCode(e)
      if (code === 'LOGIN_REQUIRED' || code === 'WRONG_ACCOUNT') {
        // Alguien cerró sesión o cambió de cuenta entre el preview y el envío;
        // se relee el estado en vez de mostrar un error genérico.
        await load()
      } else {
        setSubmitError(errMessage(e, 'No se pudo aceptar la invitación.'))
      }
    } finally {
      setSubmitting(false)
    }
  }, [token, load])

  // Camino A: la cuenta no existe — se crea aquí mismo.
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isPasswordValid(password)) {
      setSubmitError('La contraseña no cumple los requisitos indicados.')
      return
    }
    await doAccept({ firstName, lastName, password })
  }

  // Camino B: la cuenta existe — primero login con ese correo, luego aceptar.
  const [loginPassword, setLoginPassword] = useState('')
  const handleLoginAndAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!preview) return
    await login(preview.email, loginPassword)
    // `login` deja el error en el store si falla; si tuvo éxito, isAuthenticated
    // ya es true y se acepta con la sesión recién creada.
    if (useAuthStore.getState().isAuthenticated) {
      await doAccept({})
    }
  }

  const handleAcceptWithCurrentSession = async () => {
    await doAccept({})
  }

  const handleSwitchAccount = async () => {
    await logout()
    setStage('form')
  }

  if (stage === 'loading') {
    return (
      <Centered>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </Centered>
    )
  }

  if (stage === 'error') {
    return (
      <Centered>
        <Card>
          <div className="flex flex-col items-center text-center gap-3">
            <XCircle className="w-10 h-10 text-red-500" />
            <h1 className="text-[16px] font-bold text-foreground">Invitación no válida</h1>
            <p className="text-[13px] text-muted-foreground">{errorMsg}</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="mt-2 px-4 py-2 border border-border rounded-lg bg-card text-[13px] text-muted-foreground cursor-pointer"
            >
              Ir al inicio
            </button>
          </div>
        </Card>
      </Centered>
    )
  }

  if (stage === 'success' && preview) {
    return (
      <Centered>
        <Card>
          <div className="flex flex-col items-center text-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
            <h1 className="text-[16px] font-bold text-foreground">Listo, ya eres parte de {preview.tenantName}</h1>
            <p className="text-[13px] text-muted-foreground">Ya puedes entrar con tu cuenta.</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="mt-2 w-full py-2.5 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-bold cursor-pointer"
            >
              Entrar
            </button>
          </div>
        </Card>
      </Centered>
    )
  }

  if (!preview) return null

  if (stage === 'wrong-account') {
    return (
      <Centered>
        <Card>
          <h1 className="text-[16px] font-bold text-foreground mb-1">Invitación para otra cuenta</h1>
          <p className="text-[13px] text-muted-foreground mb-5">
            Esta invitación es para <strong>{preview.email}</strong>, y tienes una sesión iniciada como{' '}
            <strong>{user?.email}</strong>. Cierra sesión para aceptarla con el correo correcto.
          </p>
          <button
            onClick={handleSwitchAccount}
            disabled={authLoading}
            className="w-full py-2.5 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-bold cursor-pointer disabled:opacity-60"
          >
            Cerrar sesión y continuar
          </button>
        </Card>
      </Centered>
    )
  }

  // stage === 'form'
  return (
    <Centered>
      <Card>
        <h1 className="text-[16px] font-bold text-foreground mb-0.5">
          Te invitaron a {preview.tenantName}
        </h1>
        <p className="text-[13px] text-muted-foreground mb-5">
          {preview.invitedByName ? `${preview.invitedByName} te invitó a unirte. ` : ''}
          {preview.email}
        </p>

        {submitError && (
          <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900 rounded-lg text-[13px] text-red-700 dark:text-red-400">
            {submitError}
          </div>
        )}

        {preview.accountExists ? (
          isAuthenticated ? (
            <button
              onClick={handleAcceptWithCurrentSession}
              disabled={submitting}
              className="w-full py-2.5 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-bold cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Uniendo…' : `Aceptar como ${user?.email}`}
            </button>
          ) : (
            <form onSubmit={handleLoginAndAccept} className="flex flex-col gap-4">
              <p className="text-[12px] text-muted-foreground -mt-2">
                Ya tienes cuenta. Inicia sesión para aceptar.
              </p>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    autoFocus
                    required
                    className="w-full px-3.5 py-2.5 pr-10 border border-border rounded-lg bg-muted text-foreground text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground bg-transparent border-none cursor-pointer p-0">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={authLoading || submitting}
                className="w-full py-2.5 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-bold cursor-pointer disabled:opacity-60"
              >
                {authLoading || submitting ? 'Verificando…' : 'Iniciar sesión y aceptar'}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">
            <p className="text-[12px] text-muted-foreground -mt-2">
              Es tu primera vez: crea tu cuenta para entrar.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Nombre</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} required autoFocus
                  className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-muted text-foreground text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Apellido</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} required
                  className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-muted text-foreground text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
              {submitting ? 'Creando cuenta…' : 'Crear cuenta y unirme'}
            </button>
          </form>
        )}
      </Card>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px] flex flex-col gap-4">
        {children}
        {/* La marca de la empresa que invita ya está en la card (tenantName);
            esto es branding de la plataforma, igual que el pie del login. */}
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
