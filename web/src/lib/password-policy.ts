/**
 * Política de contraseñas, en espejo del backend.
 *
 * La autoridad es `api/src/common/validators/is-strong-password.decorator.ts`:
 * esto es solo para dar feedback inmediato al escribir y evitar un viaje al
 * servidor para descubrir algo que ya se sabe. Nunca sustituye a la validación
 * del API, que es la que realmente protege.
 *
 * Si cambian las reglas del backend, hay que cambiarlas aquí también.
 */

export const PASSWORD_MIN_LENGTH = 9
export const PASSWORD_MAX_LENGTH = 64

/** Las mismas que rechaza el backend por encabezar las listas de filtraciones. */
const COMMON_PASSWORDS = [
  'password', 'contrasena', 'contraseña', '123456', '12345678', '123456789',
  'qwerty', 'abc123', 'password1', 'admin123', 'iloveyou', 'welcome',
  'monkey', 'dragon', 'letmein', 'football', 'orbix', 'administrador',
]

export interface PasswordRule {
  id: string
  label: string
  ok: boolean
}

/**
 * Evalúa cada requisito por separado para poder mostrarlos como lista, en vez
 * de un único mensaje que solo revela el primer fallo.
 */
export function checkPassword(password: string): PasswordRule[] {
  const value = password ?? ''
  const normalized = value.toLowerCase()

  // Etiquetas cortas: la lista vive en la mitad de un modal, y un texto largo se
  // parte en tres líneas y desordena el formulario.
  return [
    {
      id: 'length',
      label: `${PASSWORD_MIN_LENGTH}+ caracteres`,
      ok: value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
    },
    { id: 'lower',  label: 'Una minúscula', ok: /[a-z]/.test(value) },
    { id: 'upper',  label: 'Una mayúscula', ok: /[A-Z]/.test(value) },
    { id: 'number', label: 'Un número',     ok: /[0-9]/.test(value) },
    { id: 'space',  label: 'Sin espacios',  ok: value.length > 0 && !value.includes(' ') },
    {
      id: 'common',
      label: 'No es común',
      ok: value.length > 0 && !COMMON_PASSWORDS.some((c) => normalized.includes(c)),
    },
  ]
}

/** True cuando la contraseña cumple todos los requisitos. */
export function isPasswordValid(password: string): boolean {
  return checkPassword(password).every((r) => r.ok)
}
