/**
 * SideRail — fixed 84px tablet navigation. Logo on top, rail tabs, avatar at the
 * bottom. Driven by Expo Router's tab bar props.
 */
import { View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/providers/theme-provider';
import { useDeviceSession } from '@/hooks/use-device-session';
import { Text, Icon } from '@/components/ui';
import { TAB_ROUTES } from '@/constants/navigation';

function getInitials(first?: string, last?: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

export function SideRail({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const { operator } = useDeviceSession();
  const activeRoute = state.routes[state.index]?.name;
  const railItems = TAB_ROUTES.filter((r) => r.inRail);
  const isPerfilActive = activeRoute === 'perfil';
  const initials = getInitials(operator?.employee.firstName, operator?.employee.lastName);

  return (
    <View
      style={{
        width: 84,
        backgroundColor: theme.colors.card,
        borderRightWidth: 1,
        borderRightColor: theme.colors.border,
        alignItems: 'center',
        paddingVertical: theme.spacing.lg,
        gap: 6,
      }}
    >
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryStrong]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 42, height: 42, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md }}
      >
        <Text variant="caption" color={theme.colors.onPrimary} style={{ fontFamily: theme.fontFamily.extrabold }}>
          OE
        </Text>
      </LinearGradient>

      {railItems.map((item) => {
        const active = item.name === activeRoute;
        return (
          <Pressable
            key={item.name}
            onPress={() => navigation.navigate(item.name)}
            style={{
              width: 64,
              paddingVertical: 10,
              borderRadius: theme.radius.md,
              alignItems: 'center',
              gap: 4,
              backgroundColor: active ? theme.colors.primarySoft : 'transparent',
            }}
          >
            <Icon name={item.icon} size={22} color={active ? theme.colors.primary : theme.colors.textMuted} />
            <Text variant="caption" style={{ fontSize: 9 }} color={active ? theme.colors.primary : theme.colors.textMuted}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}

      <Pressable
        onPress={() => navigation.navigate('perfil')}
        style={{ marginTop: 'auto', borderRadius: theme.radius.full }}
      >
        <LinearGradient
          colors={isPerfilActive
            ? [theme.colors.primaryStrong, theme.colors.primaryStrong]
            : [theme.colors.primary, theme.colors.primaryStrong]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 42,
            height: 42,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: isPerfilActive ? 2 : 0,
            borderColor: theme.colors.onPrimary,
          }}
        >
          <Text variant="caption" color={theme.colors.onPrimary} style={{ fontFamily: theme.fontFamily.extrabold }}>
            {initials}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
