/** Stepper — bordered − / value / + control for quantities. */
import { View, Pressable } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { Text } from './text';

export interface StepperProps {
  value: number;
  onChange?: (value: number) => void;
  min?: number;
  size?: 'md' | 'lg';
}

export function Stepper({ value, onChange, min = 0, size = 'md' }: StepperProps) {
  const theme = useTheme();
  const dim = size === 'lg' ? 52 : 44;

  const step = (delta: number) => onChange?.(Math.max(min, value + delta));

  const btn = (label: string, onPress: () => void, active?: boolean) => (
    <Pressable
      onPress={onPress}
      style={{
        width: dim,
        height: dim,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? theme.colors.primarySoft : 'transparent',
      }}
    >
      <Text variant="title" tone="primary">
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderWidth: 1.5,
        borderColor: theme.colors.borderStrong,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
      }}
    >
      {btn('−', () => step(-1))}
      <View style={{ minWidth: 44, alignItems: 'center' }}>
        <Text variant="mono">{value}</Text>
      </View>
      {btn('+', () => step(1), true)}
    </View>
  );
}
