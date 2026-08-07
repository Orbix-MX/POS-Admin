/**
 * Loading affordances: the ring spinner and the shimmer skeleton, both matching
 * the prototype's `orbixSpin` and `orbixShimmer` keyframes.
 */
import { memo, useEffect } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { OrbixGradient } from '@/components/ui/orbix-gradient';
import { useTheme } from '@/hooks/use-theme';

/** `border-top-color: primary` ring spinning at 0.7 s per turn. */
export const OrbixSpinner = memo(function OrbixSpinner({
  size = 20,
  color,
  trackColor,
}: {
  size?: number;
  color?: string;
  trackColor?: string;
}) {
  const theme = useTheme();
  const rotation = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    rotation.value = withRepeat(withTiming(360, { duration: 700, easing: Easing.linear }), -1);
  }, [rotation, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(2, size / 8),
          borderColor: trackColor ?? theme.colors.border,
          borderTopColor: color ?? theme.colors.primary,
        },
        style,
      ]}
    />
  );
});

/** Shimmering placeholder bar. */
export const OrbixSkeleton = memo(function OrbixSkeleton({
  width = '100%',
  height = 10,
  radius,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.ease }), -1);
  }, [progress, reduceMotion]);

  const shimmerStyle = useAnimatedStyle(() => ({
    // Sweeps a highlight across the bar, as `background-position: -200px → 200px`.
    transform: [{ translateX: -200 + progress.value * 400 }],
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="loading"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.muted,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View style={[{ width: 200, height: '100%' }, shimmerStyle]}>
        <OrbixGradient
          gradient={{
            colors: [theme.colors.muted, theme.colors.border, theme.colors.muted],
            locations: [0, 0.5, 1],
            angle: 90,
          }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
});

/** Full-screen loader used while the session is being restored. */
export const OrbixLoading = memo(function OrbixLoading() {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}
    >
      <OrbixSpinner size={28} />
    </View>
  );
});
