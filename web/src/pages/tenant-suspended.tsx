import { useAuthStore } from '@/store/auth-store'
import { AlertTriangle } from 'lucide-react'

export function TenantSuspended() {
  const logout = useAuthStore((s) => s.logout)

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 max-w-md text-center px-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground">Empresa suspendida</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tu empresa se encuentra suspendida temporalmente. Por favor contacta al administrador
            de la plataforma para reactivar el acceso.
          </p>
        </div>

        <button
          onClick={logout}
          className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  )
}
