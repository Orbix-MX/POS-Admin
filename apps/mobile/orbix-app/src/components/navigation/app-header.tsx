/**
 * AppHeader — top bar with the active-branch selector, optional search and
 * trailing icon actions. Presentational; wiring (branch switch, notifications)
 * comes later.
 */
import { View, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { Text, Icon, SearchBar, type IconName } from '@/components/ui';
import { SyncStatusBadge } from '@/components/feedback';

export interface AppHeaderProps {
  branchName?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  actions?: IconName[];
  showSyncStatus?: boolean;
  onPressBranch?: () => void;
  onPressAction?: (action: IconName) => void;
}

export function AppHeader({
  branchName = 'Sucursal',
  showSearch = true,
  searchPlaceholder = 'Buscar mesa, comanda…',
  actions = ['bell', 'settings'],
  showSyncStatus = true,
  onPressBranch,
  onPressAction,
}: AppHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();
  // En tablet Android activamos immersive mode (status bar oculta) — no agregar inset top
  const topInset = isTablet && Platform.OS === 'android' ? 0 : insets.top;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        paddingTop: topInset + theme.spacing.lg,
        paddingBottom: theme.spacing.lg,
        backgroundColor: theme.colors.card,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Pressable
        onPress={onPressBranch}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.surfaceMuted,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          height: 42,
        }}
      >
        <Icon name="location" size={16} color={theme.colors.primary} />
        <Text variant="label">{branchName}</Text>
        {onPressBranch && <Icon name="chevronDown" size={14} color={theme.colors.textMuted} />}
      </Pressable>

      {showSearch && (
        <View style={{ flex: 1, maxWidth: 320 }}>
          <SearchBar placeholder={searchPlaceholder} />
        </View>
      )}

      <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        {showSyncStatus && <SyncStatusBadge compact={!isTablet} />}
        {actions.map((action) => (
          <Pressable
            key={action}
            onPress={() => onPressAction?.(action)}
            style={{
              width: 42,
              height: 42,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surfaceMuted,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={action} size={20} color={theme.colors.textSecondary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
