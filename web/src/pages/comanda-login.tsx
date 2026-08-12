import { useState } from 'react'
import { UtensilsCrossed, Loader2, Building2, MapPin, ChevronRight, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  MEMBER: 'Miembro',
  VIEWER: 'Lector',
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-8">
        {children}
      </div>
    </div>
  )
}

export function ComandaLogin() {
  const {
    login, confirmTenant, confirmBranch, logout,
    availableTenants, needsBranchSelection, availableBranches,
    loading, error, user,
  } = useAuthStore()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')

  // ── Step: branch selection ───────────────────────────────────────────────────
  if (needsBranchSelection && availableBranches) {
    const active = availableBranches.filter(b => b.status === 'ACTIVE')
    return (
      <CardShell>
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-extrabold text-foreground">Selecciona una sucursal</h1>
            {user && (
              <p className="text-[13px] text-muted-foreground">
                Hola <span className="font-semibold text-foreground">{user.firstName}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {active.map(b => (
              <button
                key={b.id}
                onClick={() => confirmBranch(b.id)}
                disabled={loading}
                className="w-full flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary hover:bg-primary/5 cursor-pointer disabled:opacity-50 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <span className="flex-1 font-semibold text-[14px] text-foreground">{b.name}</span>
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                }
              </button>
            ))}
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground bg-transparent border-none cursor-pointer hover:text-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Cambiar cuenta
          </button>
        </div>
      </CardShell>
    )
  }

  // ── Step: tenant selection ───────────────────────────────────────────────────
  if (availableTenants) {
    return (
      <CardShell>
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-extrabold text-foreground">Selecciona tu empresa</h1>
            {user && (
              <p className="text-[13px] text-muted-foreground">
                Hola <span className="font-semibold text-foreground">{user.firstName}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {availableTenants.map(t => (
              <button
                key={t.id}
                onClick={() => confirmTenant(t.slug)}
                disabled={loading}
                className="w-full flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary hover:bg-primary/5 cursor-pointer disabled:opacity-50 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {t.name?.[0]?.toUpperCase() ?? 'T'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] text-foreground truncate">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {ROLE_LABEL[t.memberRole] ?? t.memberRole}
                  </div>
                </div>
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                }
              </button>
            ))}
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground bg-transparent border-none cursor-pointer hover:text-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Cambiar cuenta
          </button>
        </div>
      </CardShell>
    )
  }

  // ── Step: credentials ────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login(email, password)
  }

  return (
    <CardShell>
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <UtensilsCrossed className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Comandas</h1>
          <p className="text-[13px] text-muted-foreground">Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground block mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              autoFocus
              required
              className="w-full px-4 py-3 border border-border rounded-xl text-[14px] bg-muted text-foreground outline-none focus:border-primary focus:bg-card transition-colors"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground block mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 border border-border rounded-xl text-[14px] bg-muted text-foreground outline-none focus:border-primary focus:bg-card transition-colors"
            />
          </div>

          {error && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-[15px] font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando sesión…</>
              : <>Iniciar sesión <ChevronRight className="w-4 h-4" /></>
            }
          </button>
        </form>
      </div>
    </CardShell>
  )
}
