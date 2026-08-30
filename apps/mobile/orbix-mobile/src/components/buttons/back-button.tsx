/**
 * Circular back button — the `36×36` muted disc from the prototype's headers.
 *
 * Style is a static object + `Ripple` overlay rather than `Pressable`'s
 * function-style prop, for the reason documented in `google-button.tsx`: that
 * form silently drops the computed style on this RN/React Compiler combination.
 */
import { memo, useCallback } from 'react';
import { Pressable, type GestureResponderEvent } from 'react-native';

import { Ripple, useRipple } from '@/components/animations/ripple';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';

export interface BackButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}

function BackButtonComponent({ onPress, accessibilityLabel, size = 36 }: BackButtonProps) {
  const theme = useTheme();
  const ripple = useRipple();

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      ripple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY);
    },
    [ripple],
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      // The disc is under the 44 px minimum, so the target is padded outwards.
      hitSlop={(44 - size) / 2}
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.muted,
        overflow: 'hidden',
      }}
    >
      <ChevronLeftIcon size={size * 0.42} color={theme.colors.foreground} />
      <Ripple {...ripple} color={theme.colors.primary} borderRadius={theme.radius.full} />
    </Pressable>
  );
}

export const BackButton = memo(BackButtonComponent);
