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
import { useNavRoutes } from '@/hooks/use-nav-routes';
import { TAB_ROUTES, FAB_TARGET_ROUTE } from '@/constants/navigation';

export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name;

  // Fixed 5-column grid: 2 slots | FAB | 2 slots. The FAB stays dead-center
  // regardless of how many tabs are visible — empty sides render spacers.
  const SIDE_SLOTS = 2;
  const items = useNavRoutes().filter((r) => r.inBottomNav);
  const left = items.slice(0, SIDE_SLOTS);
  const right = items.slice(SIDE_SLOTS, SIDE_SLOTS * 2);

  const renderItem = (item: (typeof TAB_ROUTES)[number]) => {
    const active = item.name === activeRoute;
    const tint = active ? theme.colors.primary : theme.colors.textMuted;
    return (
      <Pressable
        key={item.name}
        onPress={() => navigation.navigate(item.name)}
        style={{ flex: 1, alignItems: 'center', gap: 3 }}
      >
        <Icon name={item.icon} size={22} color={tint} />
        <Text variant="caption" style={{ fontSize: 9 }} color={tint}>
          {item.label}
        </Text>
      </Pressable>
    );
  };

  // Pad each side to SIDE_SLOTS so the FAB column never shifts off-center.
  const renderSide = (side: typeof left, keyPrefix: string) =>
    Array.from({ length: SIDE_SLOTS }, (_, i) =>
      side[i] ? renderItem(side[i]) : <View key={`${keyPrefix}-${i}`} style={{ flex: 1 }} />,
    );

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
      {renderSide(left, 'left')}
      <View style={{ width: 64, alignItems: 'center' }}>
        <View style={{ transform: [{ translateY: -20 }] }}>
          <FloatingActionButton icon="plus" size={52} onPress={() => navigation.navigate(FAB_TARGET_ROUTE)} />
        </View>
      </View>
      {renderSide(right, 'right')}
    </View>
  );
}
