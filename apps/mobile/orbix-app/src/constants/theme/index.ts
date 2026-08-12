/**
 * Theme entrypoint. Assembles the design tokens into `lightTheme` / `darkTheme`
 * objects consumed through `useTheme()` (see providers/theme-provider).
 */
import { lightColors, darkColors, type ThemeColors, type StatusKey, type StatusTone } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';
import { typography, fontFamily } from './typography';

export interface Theme {
  mode: 'light' | 'dark';
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
}

export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  spacing,
  radius,
  shadows,
  typography,
  fontFamily,
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  spacing,
  radius,
  shadows,
  typography,
  fontFamily,
};

export { spacing, radius, shadows, typography, fontFamily };
export { lightColors, darkColors };
export type { ThemeColors, StatusKey, StatusTone };
export type { TypographyVariant } from './typography';
export type { SpacingKey } from './spacing';
export type { RadiusKey } from './radius';
