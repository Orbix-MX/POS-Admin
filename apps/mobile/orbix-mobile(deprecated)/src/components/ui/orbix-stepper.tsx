/**
 * Segmented progress bar for the company wizard.
 *
 * Each segment animates its fill independently (the prototype swaps
 * `background` between `--grad-primary` and `--border` with a 0.2 s transition),
 * so going back un-fills only the segment that was left behind.
 */
import { memo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { OrbixGradient } from '@/components/ui/orbix-gradient';
import { useTheme } from '@/hooks/use-theme';

export interface OrbixStepperProps {
  /** 1-based. */
  current: number;
  total: number;
  accessibilityLabel: string;
}

const Segment = memo(function Segment({ filled }: { filled: boolean }) {
  const theme = useTheme();

  const style = useAnimatedStyle(() => ({
    opacity: withTiming(filled ? 1 : 0, { duration: 200 }),
  }));

  return (
    <View
      style={{
        flex: 1,
        height: 4,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      <Animated.View style={[{ flex: 1 }, style]}>
        <OrbixGradient variant="primary" style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
});

function OrbixStepperComponent({ current, total, accessibilityLabel }: OrbixStepperProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={{ flexDirection: 'row', gap: theme.spacing.xs + 2 }}
    >
      {Array.from({ length: total }, (_, index) => (
        <Segment key={index} filled={index < current} />
      ))}
    </View>
  );
}

export const OrbixStepper = memo(OrbixStepperComponent);

/** Dot indicator used by the onboarding carousel (active dot widens to 22 px). */
export const OrbixDots = memo(function OrbixDots({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  const theme = useTheme();

  return (
    <View
      style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xs + 2 }}
      accessibilityRole="tablist"
    >
      {Array.from({ length: count }, (_, index) => (
        <Dot key={index} active={index === activeIndex} />
      ))}
    </View>
  );
});

const Dot = memo(function Dot({ active }: { active: boolean }) {
  const theme = useTheme();

  const style = useAnimatedStyle(() => ({
    width: withTiming(active ? 22 : 8, { duration: 250 }),
    backgroundColor: withTiming(active ? theme.colors.primary : theme.colors.border, {
      duration: 250,
    }),
  }));

  return <Animated.View style={[{ height: 8, borderRadius: theme.radius.full }, style]} />;
});
