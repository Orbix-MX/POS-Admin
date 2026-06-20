/**
 * SyncStatusBadge — compact pill showing the order sync state:
 * Offline · Pendiente sincronizar · Sincronizando · Sincronizado · Error.
 *
 * Reads `useSyncStatus()`. Use in the header and on order/comanda screens.
 */
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { useSyncStatus, type SyncStatus } from '@/hooks/use-sync-status';

export interface SyncStatusBadgeProps {
  /** Hide the text and show only the dot (tight spaces like the header). */
  compact?: boolean;
  /** Called when the user taps the badge (e.g. to open the failed-ops sheet). */
  onPress?: () => void;
}

export function SyncStatusBadge({ compact = false, onPress }: SyncStatusBadgeProps) {
  const theme = useTheme();
  const { status, label, pendingCount, failedCount } = useSyncStatus();

  const color = colorFor(status, theme.colors);
  let text = status === 'pending' && pendingCount > 0 ? `${label} (${pendingCount})` : label;
  if (failedCount > 0) text = `${failedCount} fallida${failedCount > 1 ? 's' : ''}`;

  const effectiveColor = failedCount > 0 ? theme.colors.danger : color;

  const inner = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        backgroundColor: theme.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: failedCount > 0 ? theme.colors.danger : theme.colors.border,
        borderRadius: theme.radius.full,
        paddingHorizontal: theme.spacing.sm,
        height: 26,
      }}
    >
      {status === 'syncing' && failedCount === 0
        ? <ActivityIndicator size="small" color={effectiveColor} />
        : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: effectiveColor }} />}
      {!compact && (
        <Text variant="caption" style={{ color: effectiveColor, fontWeight: '700' }} numberOfLines={1}>
          {text}
        </Text>
      )}
    </View>
  );

  if (onPress && failedCount > 0) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>;
  }
  return inner;
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
