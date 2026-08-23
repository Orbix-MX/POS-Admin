/**
 * Inline radio choice — label on the left, check on the right when selected.
 * Same visual language as the option rows inside `OrbixSelect`'s bottom
 * sheet, but laid out flat in the screen body instead of behind a sheet:
 * used for short, always-visible choice sets like "ordenar por" where
 * opening a sheet for two options would be one tap too many.
 *
 * Style is a static object + `Ripple` overlay, not `Pressable`'s
 * function-style prop (`style={({pressed}) => ({...})}`) — on this project's
 * current RN/React Compiler combination that function form silently drops
 * the computed style (`flexDirection` included), collapsing the row to a
 * stacked column. `SettingsRow` hit the same thing and was fixed the same
 * way; this mirrors it instead of reintroducing the bug.
 */
import { memo, useCallback } from 'react';
import { Pressable, type GestureResponderEvent } from 'react-native';

import { Ripple, useRipple } from '@/components/animations/ripple';
import { CheckIcon } from '@/components/ui/icons';
import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';

export interface SettingsOptionRowProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  isLast?: boolean;
  onPress?: () => void;
}

function SettingsOptionRowComponent({ label, selected, disabled = false, isLast = false, onPress }: SettingsOptionRowProps) {
  const theme = useTheme();
  const ripple = useRipple();
  const interactive = Boolean(onPress) && !disabled;

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!interactive) return;
      ripple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY);
    },
    [interactive, ripple],
  );

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      disabled={disabled || !onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 48,
        paddingVertical: theme.spacing.sm + 2,
        paddingHorizontal: theme.spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      <OrbixText size="base" tone={disabled ? 'mutedForeground' : 'foreground'}>
        {label}
      </OrbixText>
      {selected ? <CheckIcon size={11} color={disabled ? theme.colors.mutedForeground : theme.colors.primary} /> : null}
      {interactive ? <Ripple {...ripple} color={theme.colors.brandBlue300} borderRadius={0} /> : null}
    </Pressable>
  );
}

export const SettingsOptionRow = memo(SettingsOptionRowComponent);
