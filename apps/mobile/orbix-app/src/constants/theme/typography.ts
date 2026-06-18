import type { TextStyle } from 'react-native';

/**
 * Font family keys must match the names registered by @expo-google-fonts via
 * `useFonts` (see providers/theme-provider). Manrope = UI, JetBrains Mono =
 * numbers (prices, table IDs, folios, counters).
 */
export const fontFamily = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  monoRegular: 'JetBrainsMono_400Regular',
  mono: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
} as const;

export type TypographyVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'small'
  | 'caption'
  | 'eyebrow'
  | 'mono'
  | 'price';

export const typography: Record<TypographyVariant, TextStyle> = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 40, lineHeight: 44, letterSpacing: -1.4 },
  h1: { fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  h2: { fontFamily: fontFamily.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.8 },
  title: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.6 },
  subtitle: { fontFamily: fontFamily.extrabold, fontSize: 18, lineHeight: 24, letterSpacing: -0.4 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16 },
  // JetBrains-mono eyebrow label, uppercase, tracked — used as section kicker.
  eyebrow: { fontFamily: fontFamily.mono, fontSize: 11, lineHeight: 14, letterSpacing: 0.5, textTransform: 'uppercase' },
  mono: { fontFamily: fontFamily.mono, fontSize: 14, lineHeight: 18 },
  price: { fontFamily: fontFamily.monoSemibold, fontSize: 16, lineHeight: 20 },
};

/** Font assets to preload (passed to useFonts). */
export { fontFamily as fonts };
