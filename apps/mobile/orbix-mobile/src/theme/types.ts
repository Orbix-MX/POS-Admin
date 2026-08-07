/**
 * Shape of an Orbix theme.
 *
 * A theme is data, never code: the default value mirrors the Claude Design
 * prototype, and a tenant can override any subset of it from the backend
 * (white-label). Components must read these values through `useTheme()` —
 * literal colours in a component are a lint-level mistake.
 */

export type ColorSchemeName = 'light' | 'dark';
export type ThemeMode = ColorSchemeName | 'system';

/** Semantic colour roles. Names match the design-system token file 1:1. */
export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;

  /** Brand ramp — used by gradients, splash and icon chips. */
  brandBlue50: string;
  brandBlue100: string;
  brandBlue300: string;
  brandBlue500: string;
  brandBlue600: string;
  brandBlue700: string;
  brandTeal400: string;
  accentPurple: string;
  accentPink: string;

  /** Status colours (badges, inline validation, toasts). */
  successBg: string;
  successFg: string;
  warningBg: string;
  warningFg: string;
  dangerBg: string;
  dangerFg: string;
  infoBg: string;
  infoFg: string;
  neutralBg: string;
  neutralFg: string;

  /** Surfaces that stay dark regardless of scheme (splash, snackbars). */
  splashBackground: string;
  onDark: string;
  onDarkMuted: string;
}

/** A gradient is an ordered colour stop list plus an angle in degrees. */
export interface ThemeGradient {
  colors: readonly [string, string, ...string[]];
  /** Stop positions in [0,1]; must match `colors.length` when provided. */
  locations?: readonly [number, number, ...number[]];
  /** CSS-style angle in degrees (135 = top-left → bottom-right). */
  angle: number;
}

export interface ThemeGradients {
  /** Primary brand gradient: blue → purple → pink. Buttons, selected cards. */
  primary: ThemeGradient;
  /** Very light tint of `primary`, used as a full-screen background wash. */
  wash: ThemeGradient;
  /** Dark hero gradient used by the splash screen. */
  splash: ThemeGradient;
  /** Loading bar gradient (blue → teal). */
  progress: ThemeGradient;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
  '3xl': number;
  '4xl': number;
  '5xl': number;
}

export interface ThemeRadius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
  '3xl': number;
  full: number;
}

export interface ThemeShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface ThemeShadows {
  sm: ThemeShadow;
  md: ThemeShadow;
  lg: ThemeShadow;
  /** Coloured glow under primary-gradient buttons. */
  primary: ThemeShadow;
  /** Stronger coloured glow for the selected business-type card / success ring. */
  primaryStrong: ThemeShadow;
}

export interface ThemeTypography {
  fontFamily: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
    extrabold: string;
  };
  fontSize: {
    xs: number;
    sm: number;
    base: number;
    md: number;
    lg: number;
    xl: number;
    '2xl': number;
    '3xl': number;
  };
  lineHeight: {
    tight: number;
    snug: number;
    normal: number;
  };
}

export interface OrbixTheme {
  scheme: ColorSchemeName;
  colors: ThemeColors;
  gradients: ThemeGradients;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  shadows: ThemeShadows;
  typography: ThemeTypography;
}

/**
 * Partial theme as delivered by the backend for a tenant (white-label).
 * Every field is optional; unspecified values fall back to the Orbix default.
 */
export interface TenantThemeOverride {
  colors?: Partial<ThemeColors>;
  gradients?: Partial<ThemeGradients>;
  radius?: Partial<ThemeRadius>;
  spacing?: Partial<ThemeSpacing>;
  typography?: {
    fontFamily?: Partial<ThemeTypography['fontFamily']>;
    fontSize?: Partial<ThemeTypography['fontSize']>;
    lineHeight?: Partial<ThemeTypography['lineHeight']>;
  };
}

/** What the backend stores per tenant: one override per colour scheme. */
export interface TenantBranding {
  tenantId: string;
  /** Remote logo URL; falls back to the bundled Orbix mark when absent. */
  logoUrl?: string;
  light?: TenantThemeOverride;
  dark?: TenantThemeOverride;
  /** Scheme the tenant forces on its users; `system` follows the device. */
  defaultMode?: ThemeMode;
  /** Server-side revision, used to invalidate the local cache. */
  updatedAt?: string;
}
