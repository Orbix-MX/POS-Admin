/**
 * Escape hatch for translation keys that are only known at runtime.
 *
 * The i18next types are keyed on the literal union of the Spanish schema, which
 * is exactly what we want for hand-written keys. Catalog rows, however, carry
 * their key as data (`businessTypes.<id>` from the backend), so the cast has to
 * happen somewhere — doing it here once keeps it out of the components and
 * makes every dynamic lookup greppable.
 */
import type { TFunction } from 'i18next';

/** The untyped shape of `t`, before the literal-key constraint is applied. */
type LooseTranslate = (key: string) => string;

/** Translates a runtime key, falling back when the catalog has no entry. */
export function translateKey(t: TFunction, key: string, fallback?: string): string {
  const translated = (t as unknown as LooseTranslate)(key);
  // i18next echoes the key back when it cannot resolve it.
  if (translated === key && fallback) return fallback;
  return translated;
}
