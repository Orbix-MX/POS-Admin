import { useState } from 'react'
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react'
import { usePlatformAuthStore } from '@/store/platform-auth-store'

export function PlatformLogin() {
  const { login, loading, error } = usePlatformAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login(email, password)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/40">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-[20px] font-extrabold text-white leading-tight">Platform Admin</div>
            <div className="text-[11px] text-zinc-500">SaaS Management Console</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 shadow-xl">
          <h1 className="text-[20px] font-extrabold text-white mb-1">Acceso restringido</h1>
          <p className="text-[13px] text-zinc-500 mb-6">Solo administradores de plataforma</p>

          {error && (
            <div className="mb-5 px-3.5 py-2.5 bg-red-950/50 border border-red-900 rounded-lg text-[13px] text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-400 mb-1.5 block">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@plataforma.com"
                required
                autoFocus
                className="w-full px-3.5 py-2.5 border border-zinc-700 rounded-lg bg-zinc-800 text-white text-[13px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 mb-1.5 block">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 border border-zinc-700 rounded-lg bg-zinc-800 text-white text-[13px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 bg-transparent border-none cursor-pointer p-0"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-1 bg-indigo-600 text-white border-none rounded-lg text-[13px] font-bold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                : 'Ingresar al panel'
              }
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-zinc-600 mt-5">
          Platform Admin Console · Acceso restringido
        </p>
      </div>
    </div>
  )
}
