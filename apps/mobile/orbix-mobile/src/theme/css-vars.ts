/**
 * Bridges the runtime theme into NativeWind.
 *
 * `tailwind.config.js` resolves every colour to `var(--color-*)`; this maps an
 * `OrbixTheme` onto those variables so a Tailwind class like `bg-primary`
 * re-renders with the tenant's palette without a rebuild.
 */
import { vars } from 'nativewind';

import type { OrbixTheme } from './types';

export function themeToVars(theme: OrbixTheme): ReturnType<typeof vars> {
  const { colors, radius } = theme;

  return vars({
    '--color-background': colors.background,
    '--color-foreground': colors.foreground,
    '--color-card': colors.card,
    '--color-card-foreground': colors.cardForeground,
    '--color-popover': colors.popover,
    '--color-popover-foreground': colors.popoverForeground,
    '--color-primary': colors.primary,
    '--color-primary-foreground': colors.primaryForeground,
    '--color-secondary': colors.secondary,
    '--color-secondary-foreground': colors.secondaryForeground,
    '--color-muted': colors.muted,
    '--color-muted-foreground': colors.mutedForeground,
    '--color-accent': colors.accent,
    '--color-accent-foreground': colors.accentForeground,
    '--color-destructive': colors.destructive,
    '--color-destructive-foreground': colors.destructiveForeground,
    '--color-border': colors.border,
    '--color-input': colors.input,
    '--color-ring': colors.ring,
    '--color-success': colors.successFg,
    '--color-success-bg': colors.successBg,
    '--color-warning': colors.warningFg,
    '--color-warning-bg': colors.warningBg,
    '--color-danger': colors.dangerFg,
    '--color-danger-bg': colors.dangerBg,
    '--color-info': colors.infoFg,
    '--color-info-bg': colors.infoBg,
    '--radius-sm': `${radius.sm}px`,
    '--radius-md': `${radius.md}px`,
    '--radius-lg': `${radius.lg}px`,
    '--radius-xl': `${radius.xl}px`,
    '--radius-2xl': `${radius['2xl']}px`,
    '--radius-3xl': `${radius['3xl']}px`,
  });
}
