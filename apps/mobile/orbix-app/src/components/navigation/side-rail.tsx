/**
 * SideRail — fixed 84px tablet navigation. Logo on top, rail tabs, avatar at the
 * bottom. Driven by Expo Router's tab bar props.
 */
import { View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/providers/theme-provider';
import { Text, Icon } from '@/components/ui';
import { TAB_ROUTES } from '@/constants/navigation';

export function SideRail({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const activeRoute = state.routes[state.index]?.name;
  const railItems = TAB_ROUTES.filter((r) => r.inRail);

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

      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryStrong]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ marginTop: 'auto', width: 42, height: 42, borderRadius: theme.radius.full, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text variant="caption" color={theme.colors.onPrimary} style={{ fontFamily: theme.fontFamily.extrabold }}>
          CM
        </Text>
      </LinearGradient>
    </View>
  );
}
