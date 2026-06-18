/**
 * Color tokens — extracted from "Orbix Comandera" design (inherits Orbix ERP DNA).
 * Raw palette → semantic light/dark themes. State colors come as triads
 * (dot · tint background · strong text) so status UI stays legible in both modes.
 */

// ─── Raw palette ─────────────────────────────────────────────────────────────
const palette = {
  blue: '#2563EB', // Orbix Blue (brand / primary)
  blue700: '#1D4ED8',
  blue900: '#1E3A8A',
  blueSoft: '#EFF6FF',
  blueSoftBorder: '#DBEAFE',

  ink: '#0F172A',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',

  canvas: '#EEF1F6',
  card: '#FFFFFF',
  surfaceMuted: '#F4F6F9',
  surfaceMuted2: '#F1F5F9',
  border: '#E6EAF0',
  borderStrong: '#E2E7EF',

  white: '#FFFFFF',

  // semantics
  green: '#16A34A',
  greenText: '#15803D',
  greenSoft: '#E9F8EF',
  greenSoftBorder: '#A7E3C0',

  amber: '#F59E0B',
  amberText: '#B45309',
  amberSoft: '#FEF6E6',
  amberSoftBorder: '#FDE3AE',

  red: '#DC2626',
  redText: '#B91C1C',
  redSoft: '#FDECEC',
  redSoftBorder: '#F4C2C2',

  indigo: '#6366F1',

  // dark
  darkCanvas: '#0B1220',
  darkSurface: '#111B2E',
  darkCard: '#0F1A2E',
  darkBorder: '#1B2538',
  darkTextSecondary: '#94A3B8',
} as const;

/** Status triad used by chips, table cards and order rows. */
export interface StatusTone {
  solid: string; // dot / accent bar
  tint: string; // soft background
  border: string; // soft border
  text: string; // readable foreground on tint
}

export type StatusKey =
  | 'available' // disponible / libre
  | 'occupied' // ocupada
  | 'preparing' // preparando (cocina)
  | 'ready' // listo / por cobrar
  | 'rejected'; // rechazada

export interface ThemeColors {
  // brand
  primary: string;
  primaryStrong: string;
  primarySoft: string;
  primarySoftBorder: string;
  onPrimary: string;

  // surfaces
  canvas: string;
  card: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;

  // text
  text: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;

  // accents
  info: string;
  success: string;
  warning: string;
  danger: string;
  dangerSoft: string;
  onDangerSoft: string;

  status: Record<StatusKey, StatusTone>;
}

export const lightColors: ThemeColors = {
  primary: palette.blue,
  primaryStrong: palette.blue700,
  primarySoft: palette.blueSoft,
  primarySoftBorder: palette.blueSoftBorder,
  onPrimary: palette.white,

  canvas: palette.canvas,
  card: palette.card,
  surfaceMuted: palette.surfaceMuted,
  border: palette.border,
  borderStrong: palette.borderStrong,

  text: palette.ink,
  textSecondary: palette.slate500,
  textMuted: palette.slate400,
  textOnPrimary: palette.white,

  info: palette.indigo,
  success: palette.green,
  warning: palette.amber,
  danger: palette.red,
  dangerSoft: palette.redSoft,
  onDangerSoft: palette.redText,

  status: {
    available: { solid: palette.slate500, tint: palette.surfaceMuted2, border: palette.borderStrong, text: palette.slate600 },
    occupied: { solid: palette.blue, tint: '#F5F9FF', border: '#BFDBFE', text: palette.blue700 },
    preparing: { solid: palette.amber, tint: '#FFFBF4', border: palette.amberSoftBorder, text: palette.amberText },
    ready: { solid: palette.green, tint: '#F2FBF6', border: palette.greenSoftBorder, text: palette.greenText },
    rejected: { solid: palette.red, tint: '#FFF6F6', border: palette.redSoftBorder, text: palette.redText },
  },
};

export const darkColors: ThemeColors = {
  primary: palette.blue,
  primaryStrong: palette.blue700,
  primarySoft: '#16233D',
  primarySoftBorder: '#1E3A8A',
  onPrimary: palette.white,

  canvas: palette.darkCanvas,
  card: palette.darkCard,
  surfaceMuted: palette.darkSurface,
  border: palette.darkBorder,
  borderStrong: '#243049',

  text: '#F1F5F9',
  textSecondary: palette.darkTextSecondary,
  textMuted: palette.slate500,
  textOnPrimary: palette.white,

  info: palette.indigo,
  success: palette.green,
  warning: palette.amber,
  danger: palette.red,
  dangerSoft: '#2A1416',
  onDangerSoft: '#FCA5A5',

  status: {
    available: { solid: palette.slate500, tint: '#16202F', border: '#243049', text: palette.slate400 },
    occupied: { solid: palette.blue, tint: '#13233F', border: '#1E3A8A', text: '#93C5FD' },
    preparing: { solid: palette.amber, tint: '#2A2113', border: '#5A4516', text: '#FCD34D' },
    ready: { solid: palette.green, tint: '#13271C', border: '#1E5235', text: '#6EE7A0' },
    rejected: { solid: palette.red, tint: '#2A1416', border: '#5A2222', text: '#FCA5A5' },
  },
};

export { palette };
