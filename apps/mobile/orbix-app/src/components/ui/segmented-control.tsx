/**
 * SegmentedControl — pill toggle (e.g. Salón / Terraza / Barra). The design
 * shows two flavors; this uses the muted-track style with a raised active chip.
 */
import { View, Pressable } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { Text } from './text';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange?: (value: T) => void;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.md,
        padding: 4,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange?.(opt.value)}
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: 9,
              borderRadius: theme.radius.sm + 1,
              backgroundColor: active ? theme.colors.card : 'transparent',
              ...(active ? theme.shadows.card : null),
            }}
          >
            <Text variant="caption" tone={active ? 'default' : 'secondary'}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
