/**
 * TableCard — a table tile for the mesas grid. Status drives the border, the
 * left accent bar and the badge. Presentational only (data comes from props).
 */
import { View, Pressable } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { Text, StatusBadge } from '@/components/ui';
import { STATUS_LABELS } from '@/constants/status';
import type { StatusKey } from '@/constants/theme';

export interface TableCardProps {
  code: string; // e.g. "M1"
  status: StatusKey;
  /** Badge text override (e.g. "Ocupada"); defaults to status label. */
  statusLabel?: string;
  seats?: number;
  /** Footer detail, e.g. "4 personas · 24′". */
  detail?: string;
  items?: number;
  amount?: string; // formatted, e.g. "$486"
  onPress?: () => void;
}

export function TableCard({ code, status, statusLabel, detail, items, amount, onPress }: TableCardProps) {
  const theme = useTheme();
  const tone = theme.colors.status[status];
  const isAvailable = status === 'available';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: theme.colors.card,
        borderWidth: 1.5,
        borderColor: tone.border,
        borderRadius: theme.radius.xl,
        padding: theme.spacing.lg,
        overflow: 'hidden',
        opacity: pressed ? 0.95 : 1,
        ...(isAvailable ? null : theme.shadows.card),
      })}
    >
      {!isAvailable && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: theme.spacing.lg,
            bottom: theme.spacing.lg,
            width: 4,
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
            backgroundColor: tone.solid,
          }}
        />
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="h2" style={{ color: tone.text }}>
          {code}
        </Text>
        <StatusBadge status={status} label={statusLabel ?? STATUS_LABELS[status]} />
      </View>

      <Text variant="small" tone="secondary" style={{ marginTop: theme.spacing.sm }}>
        {detail ?? '—'}
      </Text>

      {isAvailable ? (
        <View
          style={{
            marginTop: theme.spacing.sm,
            height: 30,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: theme.colors.borderStrong,
            borderRadius: theme.radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="caption" tone="primary">
            + Abrir comanda
          </Text>
        </View>
      ) : (
        <View
          style={{
            marginTop: theme.spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="small" tone="muted">
            {items != null ? `${items} ítems` : ''}
          </Text>
          {amount && (
            <Text variant="price" style={{ color: tone.text }}>
              {amount}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}
