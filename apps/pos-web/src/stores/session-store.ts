/**
 * Sesión de Orbix POS.
 *
 * No hay store de autenticación propio: el POS usa **el mismo** `useAuthStore`
 * del Admin Web (token en localStorage, selección de tenant, selección de
 * sucursal, capabilities y permisos). Aquí solo se reexporta y se añaden los
 * selectores que necesita el POS.
 */
export { useAuthStore } from '@web/store/auth-store'

import { useAuthStore } from '@web/store/auth-store'

/** Permisos: se consultan contra los que devolvió `/auth/me`, sin listas locales. */
export function useHasPermission(permission: string): boolean {
  return useAuthStore((s) => s.permissions.includes(permission))
}

export function hasPermission(permission: string): boolean {
  return useAuthStore.getState().permissions.includes(permission)
}

/** Módulos habilitados por plan/vertical, tal como los reporta `/auth/me/capabilities`. */
export function useHasModule(moduleId: string): boolean {
  return useAuthStore((s) => s.enabledModules.includes(moduleId))
}

export function useDisplayName(): string {
  return useAuthStore((s) => {
    const u = s.user
    if (!u) return ''
    return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email
  })
}

export function useInitials(): string {
  return useAuthStore((s) => {
    const u = s.user
    if (!u) return '—'
    const a = (u.firstName ?? '').trim()[0] ?? ''
    const b = (u.lastName ?? '').trim()[0] ?? ''
    const initials = `${a}${b}`.toUpperCase()
    return initials || (u.email[0] ?? '?').toUpperCase()
  })
}

/** Nombre corto para la barra superior: "Gerardo S." */
export function useShortName(): string {
  return useAuthStore((s) => {
    const u = s.user
    if (!u) return ''
    const first = (u.firstName ?? '').trim()
    const lastInitial = (u.lastName ?? '').trim()[0]
    if (!first) return u.email
    return lastInitial ? `${first} ${lastInitial}.` : first
  })
}
