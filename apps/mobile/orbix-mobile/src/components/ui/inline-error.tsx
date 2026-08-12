/**
 * Form-level error banner — the red `--semantic-red-bg` block from the
 * prototype's sign-up screen, animated in with `orbixFadeUp`.
 *
 * Used for errors that belong to the submission as a whole (bad credentials, a
 * duplicate email); per-field problems render under their own input instead.
 */
import { memo } from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';

export interface InlineErrorProps {
  message?: string | null;
}

function InlineErrorComponent({ message }: InlineErrorProps) {
  const theme = useTheme();

  if (!message) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOut.duration(140)}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{
        backgroundColor: theme.colors.dangerBg,
        borderRadius: theme.radius.lg,
        paddingVertical: theme.spacing.sm + 2,
        paddingHorizontal: theme.spacing.md,
      }}
    >
      <OrbixText size="sm" tone="dangerFg" leading="snug">
        {message}
      </OrbixText>
    </Animated.View>
  );
}

export const InlineError = memo(InlineErrorComponent);
