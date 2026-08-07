/**
 * Circular back button — the `36×36` muted disc from the prototype's headers.
 */
import { memo } from 'react';
import { Pressable } from 'react-native';

import { ChevronLeftIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';

export interface BackButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}

function BackButtonComponent({ onPress, accessibilityLabel, size = 36 }: BackButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      // The disc is under the 44 px minimum, so the target is padded outwards.
      hitSlop={(44 - size) / 2}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? theme.colors.border : theme.colors.muted,
      })}
    >
      <ChevronLeftIcon size={size * 0.42} color={theme.colors.foreground} />
    </Pressable>
  );
}

export const BackButton = memo(BackButtonComponent);
