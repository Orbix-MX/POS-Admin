/**
 * "Continue with Google" button.
 *
 * Renders nothing when no client ID is configured, so a checkout without
 * credentials shows a clean sign-in screen instead of a button that cannot work.
 *
 * Style is a static object + `Ripple` overlay, not `Pressable`'s function-style
 * prop (`style={({pressed}) => ({...})}`) — on this project's current
 * RN/React Compiler combination that function form silently drops the computed
 * style (`flexDirection`, border and background included), which collapsed this
 * button into an unstyled stacked column. `SettingsRow` and `SettingsOptionRow`
 * hit the same thing and were fixed the same way.
 */
import { memo, useCallback } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';

import { Ripple, useRipple } from '@/components/animations/ripple';
import { GoogleGlyph } from '@/components/ui/icons';
import { OrbixSpinner } from '@/components/ui/orbix-loading';
import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';

export interface GoogleButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  visible?: boolean;
}

function GoogleButtonComponent({ label, onPress, loading = false, visible = true }: GoogleButtonProps) {
  const theme = useTheme();
  const ripple = useRipple();

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (loading) return;
      ripple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY);
    },
    [loading, ripple],
  );

  if (!visible) return null;

  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      onPressIn={handlePressIn}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: loading }}
      style={{
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        opacity: loading ? 0.6 : 1,
        overflow: 'hidden',
      }}
    >
      {loading ? <OrbixSpinner size={16} /> : <GoogleGlyph size={18} />}
      <OrbixText size="md" weight="medium">
        {label}
      </OrbixText>
      {loading ? null : <Ripple {...ripple} color={theme.colors.primary} borderRadius={theme.radius.lg} />}
    </Pressable>
  );
}

export const GoogleButton = memo(GoogleButtonComponent);

/** "or continue with" divider. */
export const OrDivider = memo(function OrDivider({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm + 2 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
      <OrbixText size="xs" tone="mutedForeground">
        {label}
      </OrbixText>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
    </View>
  );
});
