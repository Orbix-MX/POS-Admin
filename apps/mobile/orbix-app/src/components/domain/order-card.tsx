/**
 * OrderCard — a status row for the kitchen flow / alerts (leading marker +
 * title + subtitle + trailing status dot). Tinted by status. Presentational.
 */
import { View, Pressable } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { Text, StatusDot } from '@/components/ui';
import type { StatusKey } from '@/constants/theme';

export interface OrderCardProps {
  title: string;
  subtitle?: string;
  status: StatusKey;
  /** Leading marker, e.g. step number "1" or "✕". */
  leading?: string;
  /** Tint the row background with the status color (default true). */
  tinted?: boolean;
  onPress?: () => void;
}

export function OrderCard({ title, subtitle, status, leading, tinted = true, onPress }: OrderCardProps) {
  const theme = useTheme();
  const tone = theme.colors.status[status];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderWidth: 1,
        borderColor: tinted ? tone.border : theme.colors.border,
        backgroundColor: tinted ? tone.tint : theme.colors.card,
        borderRadius: theme.radius.lg,
        opacity: pressed ? 0.96 : 1,
      })}
    >
      {leading != null && (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: theme.radius.sm + 2,
            backgroundColor: theme.colors.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="bodyStrong" style={{ color: tone.text }}>
            {leading}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text variant="label" style={{ color: tone.text }}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="small" style={{ color: tone.text, opacity: 0.85, marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      <StatusDot status={status} size={10} />
    </Pressable>
  );
}
