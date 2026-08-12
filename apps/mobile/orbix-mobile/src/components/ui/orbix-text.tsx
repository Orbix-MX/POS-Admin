/**
 * The only text primitive in the app.
 *
 * Centralising it guarantees three things every screen would otherwise have to
 * remember: the DM Sans family per weight, theme colours instead of literals,
 * and `allowFontScaling` so Dynamic Type actually works.
 */
import { memo } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { ThemeColors, ThemeTypography } from '@/theme/types';

type Weight = keyof ThemeTypography['fontFamily'];
type Size = keyof ThemeTypography['fontSize'];

/** Colour roles text is allowed to use. */
export type TextTone =
  | 'foreground'
  | 'mutedForeground'
  | 'primary'
  | 'primaryForeground'
  | 'destructive'
  | 'successFg'
  | 'warningFg'
  | 'dangerFg'
  | 'onDark'
  | 'onDarkMuted';

export interface OrbixTextProps extends Omit<TextProps, 'style'> {
  size?: Size;
  weight?: Weight;
  tone?: TextTone;
  /** Multiplier applied to `size`; defaults to the `snug` leading token. */
  leading?: keyof ThemeTypography['lineHeight'];
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
}

function OrbixTextComponent({
  size = 'base',
  weight = 'regular',
  tone = 'foreground',
  leading = 'snug',
  align,
  style,
  children,
  ...rest
}: OrbixTextProps) {
  const theme = useTheme();
  const fontSize = theme.typography.fontSize[size];

  return (
    <Text
      // Capped rather than disabled: unbounded scaling breaks the fixed-height
      // rows in the prototype, but users still get meaningful enlargement.
      allowFontScaling
      maxFontSizeMultiplier={1.4}
      style={[
        {
          fontFamily: theme.typography.fontFamily[weight],
          fontSize,
          lineHeight: Math.round(fontSize * theme.typography.lineHeight[leading]),
          color: theme.colors[tone as keyof ThemeColors],
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

export const OrbixText = memo(OrbixTextComponent);
