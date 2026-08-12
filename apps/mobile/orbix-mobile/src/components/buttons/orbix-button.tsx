/**
 * The app's primary action component.
 *
 * Matches the prototype's button exactly: 48 px tall, `radius-lg`, the brand
 * gradient with its purple glow, and — for the disabled state — opacity 0.45
 * rather than a greyed-out fill, because the gradient has no neutral variant.
 *
 * Press feedback is a spring on the UI thread (scale + 1 px translate, the RN
 * equivalent of the prototype's `:active { transform: translateY(1px) }`) plus
 * a ripple seeded at the touch point.
 */
import { memo, useCallback, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Ripple, useRipple } from '@/components/animations/ripple';
import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';
import type { OrbixTheme } from '@/theme/types';

import { OrbixGradient } from '../ui/orbix-gradient';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const HEIGHTS: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 48 };

export interface OrbixButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Stretches to the container width. Default `true` — most buttons are blocks. */
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

interface VariantStyle {
  background: string | null; // null = gradient
  border: string | null;
  textTone: 'primaryForeground' | 'foreground' | 'primary';
  rippleColor: string;
  shadow: keyof OrbixTheme['shadows'] | null;
}

function resolveVariant(variant: ButtonVariant, theme: OrbixTheme): VariantStyle {
  switch (variant) {
    case 'primary':
      return {
        background: null,
        border: null,
        textTone: 'primaryForeground',
        rippleColor: '#ffffff',
        shadow: 'primary',
      };
    case 'secondary':
      return {
        background: theme.colors.secondary,
        border: null,
        textTone: 'foreground',
        rippleColor: theme.colors.primary,
        shadow: null,
      };
    case 'outline':
      return {
        background: theme.colors.card,
        border: theme.colors.border,
        textTone: 'foreground',
        rippleColor: theme.colors.primary,
        shadow: null,
      };
    case 'ghost':
      return {
        background: 'transparent',
        border: null,
        textTone: 'foreground',
        rippleColor: theme.colors.primary,
        shadow: null,
      };
    case 'destructive':
      return {
        background: theme.colors.destructive,
        border: null,
        textTone: 'primaryForeground',
        rippleColor: '#ffffff',
        shadow: null,
      };
    case 'link':
      return {
        background: 'transparent',
        border: null,
        textTone: 'primary',
        rippleColor: theme.colors.primary,
        shadow: null,
      };
  }
}

function OrbixButtonComponent({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  fullWidth = true,
  leftIcon,
  rightIcon,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: OrbixButtonProps) {
  const theme = useTheme();
  const ripple = useRipple();
  const pressed = useSharedValue(0);

  const isInteractive = !disabled && !loading;
  const variantStyle = resolveVariant(variant, theme);
  const height = HEIGHTS[size];

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      pressed.value = withSpring(1, { damping: 18, stiffness: 320 });
      ripple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY);
    },
    [pressed, ripple],
  );

  const handlePressOut = useCallback(() => {
    pressed.value = withSpring(0, { damping: 18, stiffness: 320 });
  }, [pressed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 - pressed.value * 0.02 },
      { translateY: pressed.value }, // mirrors `translateY(1px)` from the prototype
    ],
    opacity: withTiming(isInteractive ? 1 : 0.45, { duration: 120 }),
  }));

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        height,
      }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variantStyle.textTone === 'primaryForeground'
              ? theme.colors.primaryForeground
              : theme.colors.primary
          }
        />
      ) : (
        <>
          {leftIcon}
          <OrbixText
            size={size === 'sm' ? 'base' : 'lg'}
            weight="semibold"
            tone={variantStyle.textTone}
          >
            {label}
          </OrbixText>
          {rightIcon}
        </>
      )}
    </View>
  );

  const surface = variantStyle.background === null ? (
    <OrbixGradient
      variant="primary"
      style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}
    >
      {content}
      <Ripple {...ripple} color={variantStyle.rippleColor} borderRadius={theme.radius.lg} />
    </OrbixGradient>
  ) : (
    <View
      style={{
        backgroundColor: variantStyle.background,
        borderRadius: theme.radius.lg,
        borderWidth: variantStyle.border ? 1 : 0,
        borderColor: variantStyle.border ?? undefined,
        overflow: 'hidden',
      }}
    >
      {content}
      <Ripple {...ripple} color={variantStyle.rippleColor} borderRadius={theme.radius.lg} />
    </View>
  );

  return (
    <Animated.View
      style={[
        fullWidth ? { width: '100%' } : { alignSelf: 'flex-start' },
        variantStyle.shadow ? theme.shadows[variantStyle.shadow] : null,
        animatedStyle,
        style,
      ]}
    >
      <Pressable
        onPress={isInteractive ? onPress : undefined}
        onPressIn={isInteractive ? handlePressIn : undefined}
        onPressOut={isInteractive ? handlePressOut : undefined}
        disabled={!isInteractive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !isInteractive, busy: loading }}
        // 48 px is already above the 44 px minimum; `sm` gets padded by hitSlop.
        hitSlop={size === 'sm' ? 6 : 0}
        testID={testID}
      >
        {surface}
      </Pressable>
    </Animated.View>
  );
}

export const OrbixButton = memo(OrbixButtonComponent);
