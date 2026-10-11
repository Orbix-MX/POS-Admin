/**
 * The splash screen's 120×3 loading bar (`@keyframes orbixLoad`: scaleX 0 → 1,
 * transform-origin left, 1.9 s ease-in-out) and the animated success check
 * (`orbixCheckDraw` + `orbixCheckScale`).
 */
import { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { OrbixGradient } from '@/components/ui/orbix-gradient';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface AnimatedProgressBarProps {
  width?: number;
  duration?: number;
  onComplete?: () => void;
}

export const AnimatedProgressBar = memo(function AnimatedProgressBar({
  width = 120,
  duration = 1900,
}: AnimatedProgressBarProps) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: reduceMotion ? 0 : duration,
      easing: Easing.inOut(Easing.ease),
    });
  }, [progress, duration, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    // scaleX from a left origin: translate by half the shrunken width first.
    transform: [
      { translateX: (-width * (1 - progress.value)) / 2 },
      { scaleX: progress.value },
    ],
  }));

  return (
    <View
      accessibilityRole="progressbar"
      style={{
        width,
        height: 3,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.14)',
        overflow: 'hidden',
      }}
    >
      <Animated.View style={[{ flex: 1 }, style]}>
        <OrbixGradient variant="progress" style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
});

export interface AnimatedSuccessCheckProps {
  size?: number;
  color?: string;
}

/** Circle springs in, then the check strokes itself over 0.5 s. */
export const AnimatedSuccessCheck = memo(function AnimatedSuccessCheck({
  size = 42,
  color,
}: AnimatedSuccessCheckProps) {
  const theme = useTheme();
  const draw = useSharedValue(0);
  const scale = useSharedValue(0.6);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      draw.value = 1;
      scale.value = 1;
      return;
    }
    scale.value = withSequence(
      withTiming(1.08, { duration: 300, easing: Easing.out(Easing.ease) }),
      withSpring(1, { damping: 14, stiffness: 260 }),
    );
    draw.value = withDelay(250, withTiming(1, { duration: 500, easing: Easing.ease }));
  }, [draw, scale, reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, scale.value),
    transform: [{ scale: scale.value }],
  }));

  // Path length is 40 in the prototype's `stroke-dasharray`.
  const pathProps = useAnimatedProps(() => ({ strokeDashoffset: 40 * (1 - draw.value) }));

  return (
    <Animated.View style={containerStyle}>
      <Svg width={size} height={size} viewBox="0 0 42 42" fill="none">
        <AnimatedPath
          d="M11 22l7 7 14-16"
          stroke={color ?? theme.colors.primaryForeground}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={40}
          animatedProps={pathProps}
        />
      </Svg>
    </Animated.View>
  );
});
