/**
 * Text — typographic primitive. `variant` maps to the type scale; `tone` maps
 * to a semantic theme color. Use instead of bare RN <Text> so type + color stay
 * consistent with the design system.
 */
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import type { TypographyVariant } from '@/constants/theme';

export type TextTone =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'onPrimary';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: TextTone;
  /** Raw color override; wins over `tone`. */
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center';
}

export function Text({
  variant = 'body',
  tone = 'default',
  color,
  align,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();

  const toneColor: Record<TextTone, string> = {
    default: theme.colors.text,
    secondary: theme.colors.textSecondary,
    muted: theme.colors.textMuted,
    primary: theme.colors.primaryStrong,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
    onPrimary: theme.colors.textOnPrimary,
  };

  return (
    <RNText
      style={[theme.typography[variant], { color: color ?? toneColor[tone] }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}
