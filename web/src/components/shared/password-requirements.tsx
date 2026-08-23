import { checkPassword } from '@/lib/password-policy'

interface Props {
  password: string
  /** Muestra la lista solo cuando el usuario ya empezó a escribir. */
  alwaysVisible?: boolean
}

/**
 * Lista de requisitos de la contraseña, marcados en vivo mientras se escribe.
 *
 * Se muestran todos a la vez en vez de un único mensaje de error: así se sabe
 * qué falta antes de intentar guardar, en lugar de descubrirlo de uno en uno.
 */
export function PasswordRequirements({ password, alwaysVisible = false }: Props) {
  const rules = checkPassword(password)

  if (!alwaysVisible && !password) return null

  return (
    <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5" aria-label="Requisitos de la contraseña">
      {rules.map(rule => (
        <li
          key={rule.id}
          className={`flex items-center gap-1.5 text-[11px] leading-snug ${
            rule.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
          }`}
        >
          {/* aria-hidden: el estado ya lo comunica el texto de más abajo. */}
          <span aria-hidden="true" className="w-3 shrink-0 text-center font-bold">
            {rule.ok ? '✓' : '·'}
          </span>
          <span>{rule.label}</span>
          <span className="sr-only">{rule.ok ? ' (cumplido)' : ' (pendiente)'}</span>
        </li>
      ))}
    </ul>
  )
}
