/**
 * StatusDot + StatusBadge — the design's "color before text" status language.
 * Both read the active theme's status triad (solid / tint / text).
 */
import { View } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { Text } from './text';
import { STATUS_LABELS } from '@/constants/status';
import type { StatusKey } from '@/constants/theme';

export function StatusDot({ status, size = 8 }: { status: StatusKey; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.status[status].solid,
      }}
    />
  );
}

export interface StatusBadgeProps {
  status: StatusKey;
  /** Override the default label (e.g. "Ocupada · 24′"). */
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const theme = useTheme();
  const tone = theme.colors.status[status];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: tone.tint,
        borderWidth: 1,
        borderColor: tone.border,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: 6,
        borderRadius: theme.radius.full,
      }}
    >
      <StatusDot status={status} size={7} />
      <Text variant="caption" color={tone.text}>
        {label ?? STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
