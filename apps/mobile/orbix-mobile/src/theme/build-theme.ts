/**
 * Composes the effective theme: Orbix defaults ← tenant override.
 *
 * Pure functions only — no storage, no network, no React. That keeps theming
 * trivially testable and lets both the provider and the persistence layer reuse
 * the exact same merge semantics.
 */
import { darkTheme, lightTheme } from './tokens';
import type {
  ColorSchemeName,
  OrbixTheme,
  TenantBranding,
  TenantThemeOverride,
  ThemeGradients,
} from './types';

/** Shallow-merges only the keys the override actually defines. */
function mergeDefined<T extends object>(base: T, override: Partial<T> | undefined): T {
  if (!override) return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined && value !== null) {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}

function mergeGradients(
  base: ThemeGradients,
  override: Partial<ThemeGradients> | undefined,
): ThemeGradients {
  if (!override) return base;
  return {
    primary: override.primary ?? base.primary,
    wash: override.wash ?? base.wash,
    splash: override.splash ?? base.splash,
    progress: override.progress ?? base.progress,
    productTile: override.productTile ?? base.productTile,
  };
}

/** Applies a single override on top of one of the two default schemes. */
export function applyOverride(base: OrbixTheme, override?: TenantThemeOverride): OrbixTheme {
  if (!override) return base;

  return {
    scheme: base.scheme,
    colors: mergeDefined(base.colors, override.colors),
    gradients: mergeGradients(base.gradients, override.gradients),
    spacing: mergeDefined(base.spacing, override.spacing),
    radius: mergeDefined(base.radius, override.radius),
    shadows: base.shadows,
    typography: {
      fontFamily: mergeDefined(base.typography.fontFamily, override.typography?.fontFamily),
      fontSize: mergeDefined(base.typography.fontSize, override.typography?.fontSize),
      lineHeight: mergeDefined(base.typography.lineHeight, override.typography?.lineHeight),
    },
  };
}

/**
 * Resolves the theme for a scheme, applying the tenant's branding when present.
 * `branding` being undefined is the normal case before a tenant is selected.
 */
export function buildTheme(scheme: ColorSchemeName, branding?: TenantBranding | null): OrbixTheme {
  const base = scheme === 'dark' ? darkTheme : lightTheme;
  const override = scheme === 'dark' ? branding?.dark : branding?.light;
  return applyOverride(base, override);
}
