/**
 * KPI tile from the design system (`OrbixDesignSystem.KpiCard`): label, big
 * value, and a signed delta chip.
 */
import { memo } from 'react';
import { View } from 'react-native';

import { OrbixCard } from '@/components/cards/orbix-card';
import { OrbixText } from '@/components/ui/orbix-text';
import { OrbixSkeleton } from '@/components/ui/orbix-loading';
import { useTheme } from '@/hooks/use-theme';

export interface KpiCardProps {
  label: string;
  value: string;
  change?: string;
  up?: boolean;
  loading?: boolean;
}

function KpiCardComponent({ label, value, change, up = true, loading = false }: KpiCardProps) {
  const theme = useTheme();

  return (
    <OrbixCard style={{ flex: 1, minHeight: 96, justifyContent: 'space-between' }}>
      <OrbixText size="sm" tone="mutedForeground" numberOfLines={1}>
        {label}
      </OrbixText>

      {loading ? (
        <OrbixSkeleton width="60%" height={22} />
      ) : (
        <OrbixText size="2xl" weight="bold" leading="tight">
          {value}
        </OrbixText>
      )}

      {change && !loading ? (
        <View
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 2,
            borderRadius: theme.radius.full,
            backgroundColor: up ? theme.colors.successBg : theme.colors.dangerBg,
          }}
        >
          <OrbixText size="xs" weight="semibold" tone={up ? 'successFg' : 'dangerFg'}>
            {up ? '↑' : '↓'} {change}
          </OrbixText>
        </View>
      ) : null}
    </OrbixCard>
  );
}

export const KpiCard = memo(KpiCardComponent);
