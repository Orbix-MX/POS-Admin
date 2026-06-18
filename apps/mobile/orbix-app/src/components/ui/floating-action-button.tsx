/**
 * FloatingActionButton — the elevated brand action (e.g. "Nueva comanda").
 * Used standalone and as the center action in the phone bottom nav.
 */
import { Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/theme-provider';
import { Icon, type IconName } from './icon';

export interface FloatingActionButtonProps {
  onPress?: () => void;
  icon?: IconName;
  size?: number;
}

export function FloatingActionButton({ onPress, icon = 'plus', size = 54 }: FloatingActionButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }, theme.shadows.fab]}
    >
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryStrong]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: theme.radius.lg + 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={28} color={theme.colors.onPrimary} />
      </LinearGradient>
    </Pressable>
  );
}
