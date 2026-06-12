/**
 * BottomNav — phone navigation: thumb-reachable tabs with an elevated center FAB
 * ("Nueva comanda"). Tabs split evenly around the FAB. Driven by Expo Router's
 * tab bar props.
 */
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/providers/theme-provider';
import { Text, Icon, FloatingActionButton } from '@/components/ui';
import { TAB_ROUTES, FAB_TARGET_ROUTE } from '@/constants/navigation';

export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name;

  const items = TAB_ROUTES.filter((r) => r.inBottomNav);
  const mid = Math.ceil(items.length / 2);
  const left = items.slice(0, mid);
  const right = items.slice(mid);

  const renderItem = (item: (typeof TAB_ROUTES)[number]) => {
    const active = item.name === activeRoute;
    return (
      <Pressable
        key={item.name}
        onPress={() => navigation.navigate(item.name)}
        style={{ flex: 1, alignItems: 'center', gap: 3 }}
      >
        <Icon name={item.icon} size={22} color={active ? theme.colors.primary : theme.colors.textMuted} />
        <Text variant="caption" style={{ fontSize: 9 }} color={active ? theme.colors.primary : theme.colors.textMuted}>
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: theme.colors.card,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingTop: 11,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingHorizontal: theme.spacing.sm,
      }}
    >
      {left.map(renderItem)}
      <View style={{ width: 64, alignItems: 'center' }}>
        <View style={{ transform: [{ translateY: -20 }] }}>
          <FloatingActionButton icon="plus" size={52} onPress={() => navigation.navigate(FAB_TARGET_ROUTE)} />
        </View>
      </View>
      {right.map(renderItem)}
    </View>
  );
}
