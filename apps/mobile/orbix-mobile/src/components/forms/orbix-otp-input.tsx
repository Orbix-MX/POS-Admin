/**
 * Six-box OTP field.
 *
 * Behaviour transcribed from the prototype: typing advances focus, backspace on
 * an empty box steps back, and the field auto-submits once all six digits are
 * present. Each box springs slightly when it receives a digit.
 *
 * `textContentType="oneTimeCode"` + `autoComplete="sms-otp"` enable the OS
 * autofill banner, which is what users actually expect on both platforms.
 */
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface OrbixOtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when the last digit lands, so the caller can verify immediately. */
  onComplete?: (value: string) => void;
  length?: number;
  hasError?: boolean;
  editable?: boolean;
  /** i18n-provided label builder for screen readers. */
  digitAccessibilityLabel: (index: number, total: number) => string;
}

function OrbixOtpInputComponent({
  value,
  onChange,
  onComplete,
  length = 6,
  hasError = false,
  editable = true,
  digitAccessibilityLabel,
}: OrbixOtpInputProps) {
  const theme = useTheme();
  const inputs = useRef<(TextInput | null)[]>([]);
  const digits = useMemo(
    () => Array.from({ length }, (_, index) => value[index] ?? ''),
    [value, length],
  );

  useEffect(() => {
    if (value.length === length) onComplete?.(value);
  }, [value, length, onComplete]);

  const setDigit = useCallback(
    (index: number, raw: string) => {
      const cleaned = raw.replace(/\D/g, '');
      if (!cleaned) {
        // Deletion: drop this position and everything after it.
        onChange(value.slice(0, index));
        return;
      }

      // Handles paste and autofill: a multi-character insert fills forward.
      const next = (value.slice(0, index) + cleaned).slice(0, length);
      onChange(next);

      const focusIndex = Math.min(next.length, length - 1);
      inputs.current[focusIndex]?.focus();
    },
    [value, length, onChange],
  );

  const handleKeyPress = useCallback(
    (index: number) => (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (event.nativeEvent.key !== 'Backspace') return;
      if (digits[index]) return;
      if (index === 0) return;
      onChange(value.slice(0, index - 1));
      inputs.current[index - 1]?.focus();
    },
    [digits, value, onChange],
  );

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {digits.map((digit, index) => (
        <OtpBox
          key={index}
          ref={(instance) => {
            inputs.current[index] = instance;
          }}
          digit={digit}
          hasError={hasError}
          editable={editable}
          autoFocus={index === 0}
          onChangeText={(text) => setDigit(index, text)}
          onKeyPress={handleKeyPress(index)}
          accessibilityLabel={digitAccessibilityLabel(index + 1, length)}
          theme={theme}
        />
      ))}
    </View>
  );
}

export const OrbixOtpInput = memo(OrbixOtpInputComponent);

/* ── Single box ──────────────────────────────────────────────────────────── */

interface OtpBoxProps {
  digit: string;
  hasError: boolean;
  editable: boolean;
  autoFocus: boolean;
  onChangeText: (text: string) => void;
  onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
  accessibilityLabel: string;
  theme: ReturnType<typeof useTheme>;
}

const OtpBox = memo(
  function OtpBox({
    ref,
    digit,
    hasError,
    editable,
    autoFocus,
    onChangeText,
    onKeyPress,
    accessibilityLabel,
    theme,
  }: OtpBoxProps & { ref?: React.Ref<TextInput> }) {
    const focus = useSharedValue(0);
    const pop = useSharedValue(0);

    // A short spring on arrival makes fast typing feel responsive.
    useEffect(() => {
      if (!digit) return;
      pop.value = withSequence(withSpring(1, { damping: 12, stiffness: 400 }), withSpring(0));
    }, [digit, pop]);

    const style = useAnimatedStyle(() => ({
      borderColor: hasError
        ? theme.colors.dangerFg
        : focus.value > 0.5
          ? theme.colors.ring
          : theme.colors.border,
      transform: [{ scale: 1 + pop.value * 0.06 }],
    }));

    return (
      <AnimatedTextInput
        ref={ref}
        value={digit}
        onChangeText={onChangeText}
        onKeyPress={onKeyPress}
        onFocus={() => {
          focus.value = withTiming(1, { duration: 150 });
        }}
        onBlur={() => {
          focus.value = withTiming(0, { duration: 150 });
        }}
        editable={editable}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        // maxLength 1 would silently drop a pasted/autofilled code.
        maxLength={6}
        selectTextOnFocus
        accessibilityLabel={accessibilityLabel}
        selectionColor={theme.colors.primary}
        style={[
          {
            width: 44,
            height: 52,
            textAlign: 'center',
            fontFamily: theme.typography.fontFamily.bold,
            fontSize: theme.typography.fontSize.xl + 2,
            color: theme.colors.foreground,
            borderWidth: 1.5,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.card,
          },
          style,
        ]}
      />
    );
  },
);
