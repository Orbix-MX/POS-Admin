import { useState } from 'react'
import { Loader2, ShieldCheck, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'

/**
 * Segundo paso del login cuando el usuario tiene MFA activo. Contraseña (o
 * Google) ya se validó — esto solo pide el código de 6 dígitos o un backup
 * code, y canjea el ticket emitido por `AuthService.completeLogin`.
 */
export function MfaChallenge() {
  const { loading, error, verifyMfa, cancelMfa } = useAuthStore()
  const [code, setCode] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    await verifyMfa(code.trim())
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[380px] flex flex-col gap-6">
        <div className="bg-card border border-border rounded-2xl p-7 shadow-sm">
          <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-[18px] font-bold text-foreground mb-0.5">Verificación en dos pasos</h1>
          <p className="text-[13px] text-muted-foreground mb-6">
            Ingresa el código de tu app de autenticación, o uno de tus códigos de respaldo.
          </p>

          {error && (
            <div className="mb-5 px-3.5 py-2.5 bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900 rounded-lg text-[13px] text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Código</label>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="123456"
                autoFocus
                required
                className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-muted text-foreground text-[15px] tracking-[0.3em] text-center font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-bold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                : 'Verificar'
              }
            </button>

            <button
              type="button"
              onClick={cancelMfa}
              className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
