/**
 * Text input primitive.
 *
 * Focus and error states are animated on the UI thread: the border colour
 * interpolates and a focus ring fades in, reproducing the prototype's
 * `box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 25%, transparent)`
 * with a border overlay (React Native has no spread-radius shadow).
 */
import { forwardRef, useCallback } from 'react';
import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/**
 * RN 0.81 renamed the focus/blur payloads (`FocusEvent` / `BlurEvent`), so the
 * handler signatures are derived from `TextInputProps` instead of being spelled
 * out — that keeps them correct across upgrades.
 */
type FocusHandler = NonNullable<TextInputProps['onFocus']>;
type BlurHandler = NonNullable<TextInputProps['onBlur']>;

export interface OrbixInputProps extends Omit<TextInputProps, 'style'> {
  hasError?: boolean;
  /** Rendered inside the field, on the right — e.g. the show/hide toggle. */
  rightAdornment?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  height?: number;
}

export const OrbixInput = forwardRef<TextInput, OrbixInputProps>(function OrbixInput(
  {
    hasError = false,
    rightAdornment,
    containerStyle,
    height = 44,
    onFocus,
    onBlur,
    editable = true,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const focus = useSharedValue(0);
  const error = useDerivedValue(() => withTiming(hasError ? 1 : 0, { duration: 150 }), [hasError]);

  const handleFocus = useCallback<FocusHandler>(
    (event) => {
      focus.value = withTiming(1, { duration: 150 });
      onFocus?.(event);
    },
    [focus, onFocus],
  );

  const handleBlur = useCallback<BlurHandler>(
    (event) => {
      focus.value = withTiming(0, { duration: 150 });
      onBlur?.(event);
    },
    [focus, onBlur],
  );

  const borderStyle = useAnimatedStyle(() => {
    // Error wins over focus: a focused invalid field must still read as invalid.
    const focusColor = interpolateColor(
      focus.value,
      [0, 1],
      [theme.colors.border, theme.colors.ring],
    );
    return {
      borderColor: interpolateColor(error.value, [0, 1], [focusColor, theme.colors.dangerFg]),
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: focus.value * (1 - error.value) * 0.25,
  }));

  return (
    <View style={containerStyle}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: -3,
            left: -3,
            right: -3,
            bottom: -3,
            borderRadius: theme.radius.lg + 3,
            backgroundColor: theme.colors.ring,
          },
          ringStyle,
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            height,
            borderWidth: 1,
            borderRadius: theme.radius.lg,
            backgroundColor: editable ? theme.colors.card : theme.colors.muted,
            paddingHorizontal: theme.spacing.md,
          },
          borderStyle,
        ]}
      >
        <TextInput
          ref={ref}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={editable}
          placeholderTextColor={theme.colors.mutedForeground}
          selectionColor={theme.colors.primary}
          allowFontScaling
          maxFontSizeMultiplier={1.3}
          accessibilityState={{ disabled: !editable }}
          style={{
            flex: 1,
            height: '100%',
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.md,
            color: theme.colors.foreground,
            // Android centres text oddly without this.
            paddingVertical: 0,
          }}
          {...rest}
        />
        {rightAdornment ? <View style={{ marginLeft: theme.spacing.sm }}>{rightAdornment}</View> : null}
      </Animated.View>
    </View>
  );
});
