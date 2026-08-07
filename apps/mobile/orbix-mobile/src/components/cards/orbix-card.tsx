/**
 * Surface primitive: bordered card, matching `--card` / `--border` / `--radius-xl`.
 *
 * `floating` adds the slow vertical drift the prototype gives its hero cards;
 * it is skipped when the OS reports "reduce motion".
 */
import { memo, useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

export interface OrbixCardProps {
  children: ReactNode;
  /** `none` for flat rows inside a list, `md` for standalone cards. */
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  padded?: boolean;
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
}

function OrbixCardComponent({
  children,
  elevation = 'none',
  padded = true,
  floating = false,
  style,
}: OrbixCardProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!floating || reduceMotion) return;
    drift.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [floating, reduceMotion, drift]);

  const driftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * drift.value }],
  }));

  const base: ViewStyle = {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    padding: padded ? theme.spacing.lg : 0,
    overflow: 'hidden',
  };

  const shadow = elevation === 'none' ? null : theme.shadows[elevation];

  if (!floating) {
    return <View style={[base, shadow, style]}>{children}</View>;
  }

  return <Animated.View style={[base, shadow, driftStyle, style]}>{children}</Animated.View>;
}

export const OrbixCard = memo(OrbixCardComponent);
