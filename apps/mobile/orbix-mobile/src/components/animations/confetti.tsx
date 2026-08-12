/**
 * The 14-piece confetti burst from the wizard's success screen.
 *
 * Geometry matches the prototype exactly: `left = (i * 7.3) % 100`, a 0.12 s
 * stagger cycling every 7 pieces, a 47°-per-index starting rotation, and a
 * 1.6 s fall of 300 px with a full turn. Skipped entirely under "reduce motion".
 */
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

const PIECE_COUNT = 14;
const FALL_DISTANCE = 300;
const DURATION = 1600;

interface PieceProps {
  leftPercent: number;
  delay: number;
  color: string;
  initialRotation: number;
}

const Piece = memo(function Piece({ leftPercent, delay, color, initialRotation }: PieceProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: DURATION, easing: Easing.in(Easing.ease) }),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateY: progress.value * FALL_DISTANCE },
      { rotate: `${initialRotation + progress.value * 360}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: -10,
          left: `${leftPercent}%`,
          width: 7,
          height: 12,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
});

function ConfettiComponent() {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  const pieces = useMemo(() => {
    const colors = [
      theme.colors.brandBlue500,
      theme.colors.accentPurple,
      theme.colors.accentPink,
      theme.colors.brandTeal400,
    ];
    return Array.from({ length: PIECE_COUNT }, (_, index) => ({
      key: index,
      leftPercent: (index * 7.3) % 100,
      delay: (index % 7) * 120,
      color: colors[index % colors.length] as string,
      initialRotation: (index * 47) % 360,
    }));
  }, [theme.colors]);

  if (reduceMotion) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      {pieces.map(({ key, ...piece }) => (
        <Piece key={key} {...piece} />
      ))}
    </View>
  );
}

export const Confetti = memo(ConfettiComponent);
