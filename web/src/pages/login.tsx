import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { GoogleSignInButton } from '@/components/google-sign-in-button'

// White-label hook: future ENTERPRISE plans can set VITE_WHITE_LABEL=true to hide Orbix branding
const SHOW_PLATFORM_BRAND = import.meta.env.VITE_WHITE_LABEL !== 'true'

export function Login() {
  const { login, loading, error } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login(email, password)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[380px] flex flex-col gap-6">

        {/* Platform brand */}
        {SHOW_PLATFORM_BRAND && (
          <div className="flex flex-col items-center gap-3">
            {/* Logo mark */}
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

        {/* Login card */}
        <div className="bg-card border border-border rounded-2xl p-7 shadow-sm">
          <h1 className="text-[18px] font-bold text-foreground mb-0.5">Iniciar sesión</h1>
          <p className="text-[13px] text-muted-foreground mb-6">Ingresa tus credenciales para continuar</p>

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

            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 border border-border rounded-lg bg-muted text-foreground text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-muted-foreground/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground bg-transparent border-none cursor-pointer p-0"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Link
                to="/recuperar-contrasena"
                className="mt-1.5 inline-block text-[12px] text-muted-foreground hover:text-primary"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-1 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-bold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                : 'Ingresar'
              }
            </button>
          </form>

          <GoogleSignInButton disabled={loading} />
        </div>

        {/* Footer */}
        {SHOW_PLATFORM_BRAND && (
          <p className="text-center text-[11px] text-muted-foreground/60">
            Orbix ERP · v{__APP_VERSION__} · © {new Date().getFullYear()}
          </p>
        )}
      </div>
    </div>
  )
}
