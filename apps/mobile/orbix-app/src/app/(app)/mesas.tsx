import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Screen, Text, Grid, SegmentedControl, StatusBadge } from '@/components/ui';
import { AppHeader } from '@/components/navigation';
import { TableCard } from '@/components/domain';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import type { StatusKey } from '@/constants/theme';

const ZONES = [
  { value: 'todas', label: 'Todas' },
  { value: 'salon', label: 'Salón' },
  { value: 'terraza', label: 'Terraza' },
  { value: 'barra', label: 'Barra' },
];

// Static placeholder data — UI foundation only.
const TABLES: { code: string; status: StatusKey; statusLabel: string; detail: string; items?: number; amount?: string }[] = [
  { code: 'M1', status: 'occupied', statusLabel: 'Ocupada', detail: '4 personas · 24′', items: 7, amount: '$486' },
  { code: 'M2', status: 'ready', statusLabel: 'Cobrar', detail: '2 personas · 51′', items: 4, amount: '$312' },
  { code: 'M3', status: 'preparing', statusLabel: 'Cocina', detail: '4 personas · 8′', items: 5, amount: '$198' },
  { code: 'M4', status: 'available', statusLabel: 'Libre', detail: '6 personas' },
  { code: 'M5', status: 'available', statusLabel: 'Libre', detail: '4 personas' },
  { code: 'T5', status: 'occupied', statusLabel: 'Ocupada', detail: '2 personas · 12′', items: 3, amount: '$154' },
  { code: 'T6', status: 'available', statusLabel: 'Libre', detail: '4 personas' },
  { code: 'B2', status: 'rejected', statusLabel: 'Rechazo', detail: '1 persona · barra', items: 1, amount: '$110' },
];

export default function TablesScreen() {
  const theme = useTheme();
  const { select } = useResponsive();
  const [zone, setZone] = useState('todas');
  const cols = select({ phone: 2, tablet: 5 });

  return (
    <Screen>
      <AppHeader branchName="Sucursal Centro" searchPlaceholder="Buscar mesa" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.md }}>
          <Text variant="h2">Mesas</Text>
          <Text variant="label" tone="secondary">
            Sucursal Centro · 14 mesas
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
          <SegmentedControl options={ZONES} value={zone} onChange={setZone} />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <StatusBadge status="occupied" label="Ocupada · 5" />
            <StatusBadge status="ready" label="Por cobrar · 2" />
            <StatusBadge status="available" label="Libre · 5" />
          </View>
        </View>

        <Grid data={TABLES} columns={cols} keyExtractor={(t) => t.code} renderItem={(t) => <TableCard {...t} />} />
      </ScrollView>
    </Screen>
  );
}
