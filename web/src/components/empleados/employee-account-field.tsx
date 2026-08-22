import { NUEVA_CUENTA } from '@/hooks/core/use-empleados'
import type { TenantMemberOption } from '@/services/core/empleados-service'

const SELECT_CLS =
  'w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary'

interface Props {
  /** '' = sin cuenta, NUEVA_CUENTA = crear una, o el id de una existente. */
  value: string
  onChange: (value: string) => void
  /** Contraseña inicial, solo cuando se crea una cuenta nueva. */
  password: string
  onPasswordChange: (value: string) => void
  /** Cuentas de la empresa aún no vinculadas a ningún empleado. */
  cuentas: TenantMemberOption[]
  /** Crear cuentas solo se ofrece en el alta. */
  allowCreate?: boolean
  passwordError?: string
}

/**
 * Cuenta de acceso al back-office de un empleado.
 *
 * La mayoría del personal no necesita ninguna: opera con PIN en el POS y nunca
 * entra al panel. Por eso el valor por defecto es «sin cuenta» y el bloque de
 * contraseña solo aparece si se pide crear una.
 */
export function EmployeeAccountField({
  value,
  onChange,
  password,
  onPasswordChange,
  cuentas,
  allowCreate = false,
  passwordError,
}: Props) {
  const creating = value === NUEVA_CUENTA

  return (
    <div className="col-span-2 mt-1 pt-3 border-t border-border">
      <div className="mb-2">
        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Cuenta de acceso
        </label>
        <select value={value} onChange={e => onChange(e.target.value)} className={SELECT_CLS}>
          <option value="">Sin cuenta — solo PIN en el punto de venta</option>
          {allowCreate && <option value={NUEVA_CUENTA}>Crear una cuenta nueva…</option>}
          {cuentas.map(c => (
            <option key={c.id} value={c.id}>
              {c.nombre} · {c.email}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
          {creating
            ? 'Se creará con el correo del empleado y sin permisos: asígnaselos después desde Usuarios.'
            : 'Vincula a esta persona con su cuenta para entrar al panel. No hace falta para operar el POS.'}
        </p>
      </div>

      {creating && (
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Contraseña inicial *
          </label>
          <input
            type="password"
            value={password}
            onChange={e => onPasswordChange(e.target.value)}
            autoComplete="new-password"
            className={SELECT_CLS}
            placeholder="Mínimo 12 caracteres"
          />
          {passwordError ? (
            <p className="mt-1 text-[11px] text-red-500 leading-snug">{passwordError}</p>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              Al menos 12 caracteres, con mayúscula, minúscula y número.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
