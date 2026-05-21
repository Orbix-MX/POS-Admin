import { Monitor, Loader2, MapPin, ChevronRight, LogOut, Star } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'

export function SelectBranch() {
  const { availableBranches, user, confirmBranch, loading, error, logout } = useAuthStore()

  if (!availableBranches) return null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[440px]">
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
          <div className="flex items-start justify-between mb-1">
            <h1 className="text-[20px] font-extrabold text-foreground">Seleccionar sucursal</h1>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-[11px] text-muted-foreground bg-transparent border-none cursor-pointer hover:text-foreground transition-colors mt-1"
            >
              <LogOut className="w-3.5 h-3.5" /> Salir
            </button>
          </div>
          <p className="text-[13px] text-muted-foreground mb-6">
            Hola <span className="font-semibold text-foreground">{user?.firstName}</span>, elige la sucursal en la que vas a operar.
          </p>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900 rounded-lg text-[13px] text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {availableBranches.map(branch => (
              <button
                key={branch.id}
                onClick={() => confirmBranch(branch.id)}
                disabled={loading}
                className="w-full flex items-center gap-3.5 p-4 border border-border rounded-xl bg-card hover:bg-muted/50 hover:border-primary transition-all cursor-pointer text-left disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-[10px] flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-bold text-foreground leading-tight">{branch.name}</span>
                    {branch.isMain && (
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {branch.code}{branch.city ? ` · ${branch.city}` : ''}
                  </div>
                </div>
                <div className="shrink-0">
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  }
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-5">
          TiendaPro ERP · v2.0.1 · © 2026
        </p>
      </div>
    </div>
  )
}
