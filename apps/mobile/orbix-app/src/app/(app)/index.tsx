import { ScrollView, View } from 'react-native';

import { Screen, Card, Text, Grid } from '@/components/ui';
import { AppHeader } from '@/components/navigation';
import { StatCard, TableCard, OrderCard } from '@/components/domain';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import type { StatusKey } from '@/constants/theme';

// Static placeholder data — UI foundation only (no data layer yet).
const STATS = [
  { label: 'Mis mesas activas', value: '4', hint: 'de 6 asignadas', hintTone: 'primary' as const },
  { label: 'Comandas abiertas', value: '6', hint: '2 en cocina', hintTone: 'warning' as const },
  { label: 'Por cobrar', value: '$1,260', hint: '2 mesas listas', hintTone: 'success' as const, mono: true },
  { label: 'Ticket promedio', value: '$315', hint: 'turno noche', mono: true },
];

const MY_TABLES: { code: string; status: StatusKey; detail: string; amount?: string; items?: number }[] = [
  { code: 'M1', status: 'occupied', detail: 'Ocupada · 24′', amount: '$486', items: 7 },
  { code: 'M2', status: 'ready', detail: 'Por cobrar', amount: '$312', items: 4 },
  { code: 'M3', status: 'preparing', detail: 'Preparando', amount: '$198', items: 5 },
  { code: 'M6', status: 'available', detail: '6 personas' },
];

const ALERTS: { title: string; subtitle: string; status: StatusKey }[] = [
  { title: 'Pedido listo · M2', subtitle: 'Cheesecake y 2 cafés para servir', status: 'ready' },
  { title: 'Mesa esperando cuenta · M2', subtitle: 'Hace 51 min sin actividad', status: 'preparing' },
  { title: 'Pedido rechazado · B2', subtitle: 'Sin Margarita — sugiere reemplazo', status: 'rejected' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const { select } = useResponsive();
  const statCols = select({ phone: 2, tablet: 4 });
  const tableCols = select({ phone: 2, tablet: 3 });

  return (
    <Screen>
      <AppHeader branchName="Sucursal Centro" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl }}>
        <View>
          <Text variant="caption" tone="muted">
            Martes · 21:14
          </Text>
          <Text variant="h1" style={{ marginTop: 4 }}>
            Buenas noches, Carlos
          </Text>
        </View>

        <Grid data={STATS} columns={statCols} renderItem={(s) => <StatCard {...s} />} />

        <Card elevated>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
            <Text variant="subtitle">Mis mesas</Text>
            <Text variant="label" tone="primary">
              Ver todas →
            </Text>
          </View>
          <Grid data={MY_TABLES} columns={tableCols} keyExtractor={(t) => t.code} renderItem={(t) => <TableCard {...t} />} />
        </Card>

        <Card elevated>
          <Text variant="subtitle" style={{ marginBottom: theme.spacing.lg }}>
            Alertas
          </Text>
          <View style={{ gap: theme.spacing.md }}>
            {ALERTS.map((a) => (
              <OrderCard key={a.title} {...a} />
            ))}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
