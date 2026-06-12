import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Screen, Card, Text, Button, SegmentedControl, StatusBadge } from '@/components/ui';
import { AppHeader } from '@/components/navigation';
import { useTheme } from '@/providers/theme-provider';

const TIP_OPTIONS = [
  { value: '10', label: '10%' },
  { value: '15', label: '15%' },
  { value: '20', label: '20%' },
];

// Static placeholder bill — UI foundation only.
const LINES = [
  { name: 'Margarita', detail: 'Grande · sin sal', qty: '×2', amount: '$250' },
  { name: 'Taco Pastor', detail: 'Sin cebolla', qty: '×3', amount: '$114' },
  { name: 'Café Americano', qty: '×2', amount: '$90' },
  { name: 'Cheesecake', qty: '×1', amount: '$95' },
];

const TOTALS = [
  { label: 'Subtotal', value: '$549' },
  { label: 'IVA 16%', value: '$88' },
  { label: 'Propina 15%', value: '$82' },
];

export default function BillScreen() {
  const theme = useTheme();
  const [tip, setTip] = useState('15');

  return (
    <Screen>
      <AppHeader branchName="Sucursal Centro" showSearch={false} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Text variant="h2">Cuenta · Mesa 2</Text>
          <StatusBadge status="ready" label="Por cobrar" />
        </View>

        <Card>
          {LINES.map((l, i) => (
            <View
              key={l.name}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: theme.spacing.md,
                borderBottomWidth: i < LINES.length - 1 ? 1 : 0,
                borderBottomColor: theme.colors.surfaceMuted,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="label">{l.name}</Text>
                {l.detail && (
                  <Text variant="small" color={theme.colors.info} style={{ marginTop: 2 }}>
                    {l.detail}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
                <Text variant="mono" tone="muted">
                  {l.qty}
                </Text>
                <Text variant="mono">{l.amount}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Card>
          <Text variant="eyebrow" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
            Propina
          </Text>
          <SegmentedControl options={TIP_OPTIONS} value={tip} onChange={setTip} />

          <View style={{ marginTop: theme.spacing.lg, gap: 6 }}>
            {TOTALS.map((t) => (
              <View key={t.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="small" tone="secondary">
                  {t.label}
                </Text>
                <Text variant="mono">{t.value}</Text>
              </View>
            ))}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginTop: theme.spacing.sm,
                paddingTop: theme.spacing.md,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
              }}
            >
              <Text variant="subtitle">Total</Text>
              <Text variant="price" tone="success" style={{ fontSize: 24, lineHeight: 28 }}>
                $719
              </Text>
            </View>
          </View>
        </Card>

        <Button label="Cobrar $719" variant="primary" size="lg" fullWidth icon="check" />
      </ScrollView>
    </Screen>
  );
}
