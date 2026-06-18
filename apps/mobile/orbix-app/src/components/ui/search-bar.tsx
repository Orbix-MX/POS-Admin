/** SearchBar — muted rounded field with a leading search icon. */
import { View, TextInput } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { Icon } from './icon';

export interface SearchBarProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Buscar…' }: SearchBarProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        paddingHorizontal: theme.spacing.lg,
        height: 48,
      }}
    >
      <Icon name="search" size={18} color={theme.colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={{
          flex: 1,
          fontFamily: theme.fontFamily.regular,
          fontSize: 15,
          color: theme.colors.text,
          padding: 0,
        }}
      />
    </View>
  );
}
