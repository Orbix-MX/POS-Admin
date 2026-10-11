/**
 * Floating "cobrar" bar — the only way into checkout once the cart is non-empty.
 *
 * Slides up on first appearance so the operator notices the cart went from
 * empty to actionable without the grid shifting under their finger.
 */
import { memo, useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { OrbixGradient, OrbixText } from '@/components';
import { ShoppingBagIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';

interface CartBarProps {
  countLabel: string;
  totalLabel: string;
  chargeLabel: string;
  disabled?: boolean;
  onPress: () => void;
}

function CartBarComponent({ countLabel, totalLabel, chargeLabel, disabled, onPress }: CartBarProps) {
  const theme = useTheme();
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 250 });
  }, [enter]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 70 }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: theme.spacing.lg,
          right: theme.spacing.lg,
          bottom: theme.spacing['2xl'],
        },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${chargeLabel}, ${countLabel}, ${totalLabel}`}
        accessibilityState={{ disabled: Boolean(disabled) }}
        // Objeto estático, no `style={({pressed}) => …}`: con nativewind +
        // React Compiler esa forma se descarta entera (ver `google-button.tsx`),
        // así que ni el 50% de `disabled` llegaba a aplicarse.
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        <OrbixGradient
          variant="primary"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: 14,
            borderRadius: theme.radius['2xl'],
          }}
        >
          <Animated.View
            style={{
              width: 34,
              height: 34,
              borderRadius: theme.radius.full,
              backgroundColor: 'rgba(255,255,255,0.22)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingBagIcon size={16} color={theme.colors.onDark} />
          </Animated.View>

          <Animated.View style={{ flex: 1 }}>
            <OrbixText size="xs" weight="semibold" tone="onDarkMuted">
              {countLabel}
            </OrbixText>
            <OrbixText size="xl" weight="bold" tone="onDark">
              {totalLabel}
            </OrbixText>
          </Animated.View>

          <OrbixText size="md" weight="bold" tone="onDark" style={{ paddingRight: 4 }}>
            {chargeLabel}
          </OrbixText>
        </OrbixGradient>
      </Pressable>
    </Animated.View>
  );
}

export const CartBar = memo(CartBarComponent);
