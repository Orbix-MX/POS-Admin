/**
 * Touch ripple that runs on the UI thread.
 *
 * Android's `android_ripple` is not available on iOS and cannot be tinted per
 * variant, so the effect is drawn here instead: a circle seeded at the touch
 * point, expanded to cover the button and faded out. All values are shared
 * values, so the animation never crosses the JS bridge and holds 60 FPS even
 * while a mutation is in flight.
 */
import { memo, useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export interface RippleController {
  /** Call from `onPressIn` with the touch coordinates, relative to the button. */
  trigger: (x: number, y: number) => void;
}

interface RippleProps {
  color: string;
  progress: SharedValue<number>;
  originX: SharedValue<number>;
  originY: SharedValue<number>;
  /** Radius needed to cover the whole surface from the touch point. */
  radius: SharedValue<number>;
  onLayoutSize: (width: number, height: number) => void;
  borderRadius: number;
}

function RippleComponent({
  color,
  progress,
  originX,
  originY,
  radius,
  onLayoutSize,
  borderRadius,
}: RippleProps) {
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      onLayoutSize(width, height);
    },
    [onLayoutSize],
  );

  const circleStyle = useAnimatedStyle(() => {
    const size = radius.value * 2;
    return {
      width: size,
      height: size,
      borderRadius: radius.value,
      left: originX.value - radius.value,
      top: originY.value - radius.value,
      opacity: (1 - progress.value) * 0.28,
      transform: [{ scale: progress.value }],
    };
  });

  return (
    <View
      onLayout={handleLayout}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}
    >
      <Animated.View style={[{ position: 'absolute', backgroundColor: color }, circleStyle]} />
    </View>
  );
}

export const Ripple = memo(RippleComponent);

/** Shared values + the trigger, kept together so buttons stay declarative. */
export function useRipple() {
  const progress = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const radius = useSharedValue(0);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayoutSize = useCallback((width: number, height: number) => {
    setSize({ width, height });
  }, []);

  const trigger = useCallback(
    (x: number, y: number) => {
      // Farthest corner from the touch point — the circle must cover it.
      const dx = Math.max(x, size.width - x);
      const dy = Math.max(y, size.height - y);
      radius.value = Math.hypot(dx, dy);
      originX.value = x;
      originY.value = y;
      progress.value = 0;
      progress.value = withTiming(1, { duration: 420 });
    },
    [size.width, size.height, originX, originY, progress, radius],
  );

  return { progress, originX, originY, radius, onLayoutSize, trigger };
}
