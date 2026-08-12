/**
 * Theme-aware gradient surface.
 *
 * CSS gradients carry an angle; `expo-linear-gradient` takes start/end points.
 * `angleToPoints` converts between them so the tokens can stay in CSS terms and
 * match the prototype exactly (135° for the primary gradient, 160° for the wash).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { memo, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { ThemeGradient } from '@/theme/types';

/**
 * CSS `linear-gradient(Ndeg, …)` measures clockwise from "to top". Expo wants
 * unit-square coordinates, so we project the angle onto the [0,1] box.
 */
export function angleToPoints(angle: number): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  const radians = ((angle - 90) * Math.PI) / 180;
  const dx = Math.cos(radians) / 2;
  const dy = Math.sin(radians) / 2;
  return {
    start: { x: 0.5 - dx, y: 0.5 - dy },
    end: { x: 0.5 + dx, y: 0.5 + dy },
  };
}

export interface OrbixGradientProps {
  /** Named theme gradient. Ignored when `gradient` is given. */
  variant?: 'primary' | 'wash' | 'splash' | 'progress';
  /** Explicit gradient, for one-off surfaces. */
  gradient?: ThemeGradient;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

function OrbixGradientComponent({
  variant = 'primary',
  gradient,
  style,
  children,
  pointerEvents,
}: OrbixGradientProps) {
  const theme = useTheme();
  const resolved = gradient ?? theme.gradients[variant];
  const { start, end } = angleToPoints(resolved.angle);

  return (
    <LinearGradient
      colors={resolved.colors as unknown as readonly [string, string, ...string[]]}
      locations={resolved.locations as unknown as readonly [number, number, ...number[]] | undefined}
      start={start}
      end={end}
      style={style}
      pointerEvents={pointerEvents}
    >
      {children}
    </LinearGradient>
  );
}

export const OrbixGradient = memo(OrbixGradientComponent);
