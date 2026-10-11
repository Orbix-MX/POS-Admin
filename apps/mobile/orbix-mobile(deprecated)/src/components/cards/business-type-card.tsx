/**
 * Selectable business-type tile.
 *
 * Selection swaps the card to the brand gradient with its purple glow and pops
 * a white check badge in the corner — the prototype's `orbixCheckScale`. The
 * gradient layer is always mounted and cross-faded, because mounting a
 * `LinearGradient` on press causes a visible hitch on Android.
 */
import { memo, useCallback, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { OrbixGradient } from '@/components/ui/orbix-gradient';
import { OrbixText } from '@/components/ui/orbix-text';
import { CheckIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';

export interface BusinessTypeCardProps {
  icon: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

function BusinessTypeCardComponent({
  icon,
  label,
  selected,
  onPress,
  accessibilityLabel,
}: BusinessTypeCardProps) {
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const selection = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    selection.value = withTiming(selected ? 1 : 0, { duration: 150 });
  }, [selected, selection]);

  const handlePressIn = useCallback(() => {
    pressed.value = withSpring(1, { damping: 20, stiffness: 400 });
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withSpring(0, { damping: 20, stiffness: 400 });
  }, [pressed]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));

  const gradientStyle = useAnimatedStyle(() => ({ opacity: selection.value }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: selection.value,
    transform: [{ scale: 0.6 + selection.value * 0.4 }],
  }));

  return (
    <Animated.View
      style={[{ flex: 1 }, selected ? theme.shadows.primary : null, containerStyle]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={accessibilityLabel}
        style={{
          minHeight: 92,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.lg + 2,
          paddingHorizontal: theme.spacing.sm + 2,
          borderRadius: theme.radius.xl,
          borderWidth: 1.5,
          borderColor: selected ? 'transparent' : theme.colors.border,
          backgroundColor: theme.colors.card,
          overflow: 'hidden',
        }}
      >
        <Animated.View style={[{ position: 'absolute', inset: 0 }, gradientStyle]}>
          <OrbixGradient variant="primary" style={{ flex: 1 }} />
        </Animated.View>

        <OrbixText size="3xl" leading="tight" accessibilityElementsHidden>
          {icon}
        </OrbixText>
        <OrbixText
          size="sm"
          weight="semibold"
          align="center"
          tone={selected ? 'primaryForeground' : 'foreground'}
        >
          {label}
        </OrbixText>

        <Animated.View
          style={[
            {
              position: 'absolute',
              top: theme.spacing.sm,
              right: theme.spacing.sm,
              width: 18,
              height: 18,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.card,
            },
            badgeStyle,
          ]}
          pointerEvents="none"
        >
          <CheckIcon size={9} color={theme.colors.accentPurple} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export const BusinessTypeCard = memo(BusinessTypeCardComponent);

/** Row used by the home screen's "first steps" list. */
export const ListRow = memo(function ListRow({
  icon,
  label,
  onPress,
  isLast = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm + 2,
        minHeight: 48,
        paddingVertical: theme.spacing.md + 1,
        paddingHorizontal: theme.spacing.md + 2,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: theme.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.brandBlue50,
        }}
      >
        {icon}
      </View>
      <OrbixText size="base" weight="medium" style={{ flex: 1 }}>
        {label}
      </OrbixText>
    </Pressable>
  );
});
