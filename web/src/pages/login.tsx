import { useState } from 'react'
import { Monitor, Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md">
            <Monitor className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-[20px] font-extrabold text-foreground leading-tight">TiendaPro</div>
            <div className="text-[11px] text-muted-foreground">Sistema de Gestión ERP</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-7 shadow-sm">
          <h1 className="text-[22px] font-extrabold text-foreground mb-1">Iniciar sesión</h1>
          <p className="text-[13px] text-muted-foreground mb-6">Ingresa tus credenciales para acceder al sistema</p>

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
                  {showPassword
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-1 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-bold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                : 'Ingresar al sistema'
              }
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-5">
          TiendaPro ERP · v2.0.1 · © 2026
        </p>
      </div>
    </div>
  )
}
