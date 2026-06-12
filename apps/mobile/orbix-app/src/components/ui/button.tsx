/**
 * Button — primary / secondary / ghost / danger. Primary carries the brand
 * shadow. Heights respect the design's ≥52px touch target (lg = 56).
 */
import { Pressable, ActivityIndicator, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { Text } from './text';
import { Icon, type IconName } from './icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth,
  disabled,
  loading,
}: ButtonProps) {
  const theme = useTheme();
  const height = size === 'lg' ? 56 : 52;

  const surfaces: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: theme.colors.primary, ...theme.shadows.primary },
    secondary: { backgroundColor: theme.colors.card, borderWidth: 1.5, borderColor: theme.colors.borderStrong },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: theme.colors.dangerSoft },
  };
  const labelColor: Record<ButtonVariant, string> = {
    primary: theme.colors.textOnPrimary,
    secondary: theme.colors.text,
    ghost: theme.colors.primaryStrong,
    danger: theme.colors.onDangerSoft,
  };

  const color = labelColor[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: theme.spacing.xl,
          borderRadius: theme.radius.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
        },
        surfaces[variant],
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {icon && iconPosition === 'left' && <Icon name={icon} size={20} color={color} />}
          <Text variant="bodyStrong" color={color}>
            {label}
          </Text>
          {icon && iconPosition === 'right' && <Icon name={icon} size={20} color={color} />}
        </View>
      )}
    </Pressable>
  );
}
