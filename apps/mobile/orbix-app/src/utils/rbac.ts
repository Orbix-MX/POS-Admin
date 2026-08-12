/**
 * Phase 8 — RBAC helpers (pure functions).
 *
 * These operate on plain arrays so they're trivially testable and usable
 * outside React. The session-bound versions live in `useRbac()`
 * (src/hooks/use-rbac.ts), which feeds them the current user's data.
 *
 * Permission keys follow the API convention `module:action` (e.g. `orders:create`),
 * and module keys match the `SystemModule` enum from `@orbix/types`.
 */
import type { SystemModule } from '@orbix/types';

export type PermissionMatch = 'any' | 'all';

/** Roles that bypass all permission/module checks (platform super-admins). */
const BYPASS_ROLES = new Set(['SUPER_ADMIN']);

export function isBypassRole(role?: string | null): boolean {
  return !!role && BYPASS_ROLES.has(role);
}

/**
 * True if `permissions` satisfies `required`. With multiple required keys,
 * `mode: 'all'` (default) needs every key; `mode: 'any'` needs at least one.
 */
export function hasPermission(
  permissions: string[],
  required: string | string[],
  mode: PermissionMatch = 'all',
): boolean {
  const keys = Array.isArray(required) ? required : [required];
  if (keys.length === 0) return true;
  const set = new Set(permissions);
  return mode === 'all' ? keys.every((k) => set.has(k)) : keys.some((k) => set.has(k));
}

/** True if `module` is among the tenant's effective modules. */
export function hasModule(
  modules: string[],
  required: string | SystemModule | (string | SystemModule)[],
  mode: PermissionMatch = 'any',
): boolean {
  const keys = (Array.isArray(required) ? required : [required]) as string[];
  if (keys.length === 0) return true;
  const set = new Set(modules);
  return mode === 'all' ? keys.every((k) => set.has(k)) : keys.some((k) => set.has(k));
}

/** True if `role` is one of the allowed roles. */
export function hasRole(role: string | undefined | null, allowed: string | string[]): boolean {
  if (!role) return false;
  const list = Array.isArray(allowed) ? allowed : [allowed];
  return list.includes(role);
}
