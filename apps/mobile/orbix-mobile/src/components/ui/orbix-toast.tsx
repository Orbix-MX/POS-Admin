/**
 * Toast configuration for `react-native-toast-message`.
 *
 * The visual is the prototype's snackbar: dark pill, white label, optional
 * action on the right. Rendering it through a config (rather than a bespoke
 * component per call site) means `toast.error(...)` works from anywhere,
 * including outside the React tree.
 */
import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';
import type { OrbixTheme } from '@/theme/types';

interface ToastProps {
  actionLabel?: string;
  onAction?: () => void;
}

type Params = ToastConfigParams<ToastProps>;

function accentFor(type: string, theme: OrbixTheme): string | null {
  if (type === 'success') return theme.colors.successFg;
  if (type === 'error') return theme.colors.dangerFg;
  if (type === 'info') return theme.colors.primary;
  return null;
}

function ToastBody({ type, text1, text2, props }: Params) {
  const theme = useTheme();
  const accent = accentFor(type, theme);

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(160)}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          marginHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.foreground,
        },
        theme.shadows.md,
      ]}
    >
      {accent ? (
        <View
          style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: accent }}
        />
      ) : null}

      <View style={{ flex: 1 }}>
        <OrbixText size="base" tone="onDark" numberOfLines={2}>
          {text1}
        </OrbixText>
        {text2 ? (
          <OrbixText size="sm" tone="onDarkMuted" numberOfLines={2}>
            {text2}
          </OrbixText>
        ) : null}
      </View>

      {props?.actionLabel ? (
        <Pressable
          onPress={props.onAction}
          accessibilityRole="button"
          accessibilityLabel={props.actionLabel}
          hitSlop={8}
        >
          <OrbixText size="sm" weight="semibold" tone="onDarkMuted">
            {props.actionLabel}
          </OrbixText>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

export const toastConfig: ToastConfig = {
  success: (params) => <ToastBody {...(params as Params)} />,
  error: (params) => <ToastBody {...(params as Params)} />,
  info: (params) => <ToastBody {...(params as Params)} />,
};

/**
 * Mount once at the app root, *outside* the navigator so a toast survives
 * navigation, and below the safe area so it clears the notch.
 */
export function OrbixToast() {
  const insets = useSafeAreaInsets();
  return <Toast config={toastConfig} topOffset={insets.top + 8} />;
}

/** Imperative API — usable from services and interceptors, not just components. */
export const toast = {
  success(message: string, description?: string): void {
    Toast.show({ type: 'success', text1: message, text2: description });
  },
  error(message: string, description?: string): void {
    Toast.show({ type: 'error', text1: message, text2: description, visibilityTime: 5000 });
  },
  info(message: string, action?: { label: string; onPress: () => void }): void {
    Toast.show({
      type: 'info',
      text1: message,
      props: action ? { actionLabel: action.label, onAction: action.onPress } : undefined,
    });
  },
  hide(): void {
    Toast.hide();
  },
} as const;
