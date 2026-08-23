import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { requestPasswordReset } from '@/services/core/auth-service'

const SHOW_PLATFORM_BRAND = import.meta.env.VITE_WHITE_LABEL !== 'true'

/**
 * Solicitud de reseteo de contraseña.
 *
 * La respuesta del API es idéntica exista o no el correo, así que esta
 * pantalla muestra el mismo mensaje de éxito en ambos casos — nunca "correo
 * no encontrado", que confirmaría qué cuentas existen en la plataforma.
 */
export function RecuperarContrasena() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      // Un fallo de red no debe verse igual que "correo enviado" — pero
      // tampoco distinguir entre "no existe" (eso ya lo resuelve el 201
      // genérico del API) y un error real.
      setError('No se pudo procesar la solicitud. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[380px] flex flex-col gap-6">
        {SHOW_PLATFORM_BRAND && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="9" height="9" rx="2" fill="currentColor" className="text-primary-foreground" />
                <rect x="15" y="2" width="9" height="9" rx="2" fill="currentColor" className="text-primary-foreground" opacity="0.6" />
                <rect x="2" y="15" width="9" height="9" rx="2" fill="currentColor" className="text-primary-foreground" opacity="0.6" />
                <rect x="15" y="15" width="9" height="9" rx="2" fill="currentColor" className="text-primary-foreground" />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-[22px] font-extrabold text-foreground tracking-tight leading-none">Orbix ERP</div>
              <div className="text-[12px] text-muted-foreground mt-1">Business Management Platform</div>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-7 shadow-sm">
          {sent ? (
            <div className="flex flex-col items-center text-center gap-3">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
              <h1 className="text-[16px] font-bold text-foreground">Revisa tu correo</h1>
              <p className="text-[13px] text-muted-foreground">
                Si <strong>{email}</strong> tiene una cuenta, te llegó un enlace para
                restablecer la contraseña. Caduca en una hora.
              </p>
              <Link
                to="/"
                className="mt-2 text-[13px] font-semibold text-primary hover:underline"
              >
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-[18px] font-bold text-foreground mb-0.5">Recuperar contraseña</h1>
              <p className="text-[13px] text-muted-foreground mb-6">
                Ingresa tu correo y te mandamos un enlace para restablecerla.
              </p>

              {error && (
                <div className="mb-5 px-3.5 py-2.5 bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900 rounded-lg text-[13px] text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    required
                    autoFocus
                    className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-muted text-foreground text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-muted-foreground/60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 mt-1 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-bold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                    : 'Enviar enlace'
                  }
                </button>
              </form>

              <Link
                to="/"
                className="block mt-4 text-center text-[12px] text-muted-foreground hover:text-foreground"
              >
                Volver a iniciar sesión
              </Link>
            </>
          )}
        </div>

        {SHOW_PLATFORM_BRAND && (
          <p className="text-center text-[11px] text-muted-foreground/60">
            Orbix ERP · v{__APP_VERSION__} · © {new Date().getFullYear()}
          </p>
        )}
      </div>
    </div>
  )
}
