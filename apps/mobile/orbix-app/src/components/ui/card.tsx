/**
 * Card (AppCard) — white rounded surface with soft border, the base container
 * for stats, lists and panels across the design.
 */
import type { PropsWithChildren } from 'react';
import { View, Pressable, type ViewStyle } from 'react-native';
import { useTheme } from '@/providers/theme-provider';

export interface CardProps extends PropsWithChildren {
  /** Padding inside the card (defaults to lg = 16). */
  padding?: number;
  /** Soft drop shadow. */
  elevated?: boolean;
  /** Renders pressable when provided. */
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({ children, padding, elevated, onPress, style }: CardProps) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    padding: padding ?? theme.spacing.lg,
    ...(elevated ? theme.shadows.card : null),
  };

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.92 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
