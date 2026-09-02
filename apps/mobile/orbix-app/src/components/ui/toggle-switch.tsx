/**
 * ToggleSwitch — on/off pill, same shape as the web Panel de Permisos switch.
 * Controlled; caller owns persistence (optimistic update + revert on error).
 */
import { Pressable, View } from 'react-native';
import { useTheme } from '@/providers/theme-provider';

export interface ToggleSwitchProps {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ value, onChange, disabled }: ToggleSwitchProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      hitSlop={8}
      style={{
        width: 46,
        height: 28,
        borderRadius: theme.radius.full,
        padding: 3,
        backgroundColor: value ? theme.colors.primary : theme.colors.surfaceMuted,
        borderWidth: value ? 0 : 1,
        borderColor: theme.colors.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.card,
          transform: [{ translateX: value ? 18 : 0 }],
          ...theme.shadows.primary,
        }}
      />
    </Pressable>
  );
}
