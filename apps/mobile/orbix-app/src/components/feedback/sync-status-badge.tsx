/**
 * SyncStatusBadge — compact pill showing the order sync state:
 * Offline · Pendiente sincronizar · Sincronizando · Sincronizado · Error.
 *
 * Reads `useSyncStatus()`. Use in the header and on order/comanda screens.
 */
import { View, ActivityIndicator } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { useSyncStatus, type SyncStatus } from '@/hooks/use-sync-status';

export interface SyncStatusBadgeProps {
  /** Hide the text and show only the dot (tight spaces like the header). */
  compact?: boolean;
}

export function SyncStatusBadge({ compact = false }: SyncStatusBadgeProps) {
  const theme = useTheme();
  const { status, label, pendingCount } = useSyncStatus();

  const color = colorFor(status, theme.colors);
  const text = status === 'pending' && pendingCount > 0 ? `${label} (${pendingCount})` : label;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        backgroundColor: theme.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.full,
        paddingHorizontal: theme.spacing.sm,
        height: 26,
      }}
    >
      {status === 'syncing'
        ? <ActivityIndicator size="small" color={color} />
        : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
      {!compact && (
        <Text variant="caption" style={{ color, fontWeight: '700' }} numberOfLines={1}>
          {text}
        </Text>
      )}
    </View>
  );
}

function colorFor(status: SyncStatus, colors: { success: string; warning: string; danger: string; primary: string; textMuted: string }): string {
  switch (status) {
    case 'synced': return colors.success;
    case 'pending': return colors.warning;
    case 'syncing': return colors.primary;
    case 'error': return colors.danger;
    case 'offline': return colors.textMuted;
  }
}
