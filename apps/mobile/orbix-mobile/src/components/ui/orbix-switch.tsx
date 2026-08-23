/**
 * Boolean toggle — missing from the Claude Design prototype, added here
 * because the settings redesign needs it (`docs/adr/ods-extensions.md`
 * pending: track ODS gaps as they're filled). Track: `radius.full`, 44×26.
 * Thumb slides on the UI thread; track colour cross-fades primary↔muted so it
 * never pops between the two states.
 */
import { memo, useCallback, useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const THUMB_SIZE = 22;
const THUMB_INSET = (TRACK_HEIGHT - THUMB_SIZE) / 2;

export interface OrbixSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

function OrbixSwitchComponent({ value, onValueChange, disabled = false, accessibilityLabel }: OrbixSwitchProps) {
  const theme = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 160 });
  }, [value, progress]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    onValueChange(!value);
  }, [disabled, onValueChange, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [theme.colors.muted, theme.colors.primary]),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: THUMB_INSET + progress.value * (TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2) }],
  }));

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      <Animated.View
        style={[
          { width: TRACK_WIDTH, height: TRACK_HEIGHT, borderRadius: theme.radius.full, justifyContent: 'center' },
          trackStyle,
          disabled ? { opacity: 0.5 } : null,
        ]}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.card,
            },
            theme.shadows.sm,
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export const OrbixSwitch = memo(OrbixSwitchComponent);
