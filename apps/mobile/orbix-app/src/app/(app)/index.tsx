import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, View, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen, Card, Text, Grid } from '@/components/ui';
import { AppHeader, BranchSelectorModal } from '@/components/navigation';
import { StatCard, OrderCard } from '@/components/domain';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useBranchSelector } from '@/hooks/use-branch-selector';
import { useDeviceSession } from '@/hooks/use-device-session';
import { useCapabilities } from '@/hooks/use-nav-routes';
import { hasTables, hasKitchen } from '@/lib/capabilities';
import { fetchActiveOrders, fetchTables } from '@/services/restaurant-service';
import type { DiningOrder, DiningOrderStatus, RestaurantTable } from '@/services/restaurant-service';
import type { StatusKey } from '@/constants/theme';

const PAYABLE: DiningOrderStatus[] = ['READY_FOR_PAYMENT', 'DELIVERED'];
const IN_KITCHEN: DiningOrderStatus[] = ['SENT_TO_KITCHEN', 'IN_PREPARATION', 'READY'];

const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

function orderTotal(o: DiningOrder): number {
  return o.items.reduce((acc, i) => acc + Number(i.unitPrice) * i.quantity, 0);
}

function formatElapsed(openedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { select } = useResponsive();
  const statCols = select({ phone: 2, tablet: 4 });
  const { operator } = useDeviceSession();
  const { modalVisible, activeBranch, availableBranches, openSelector, closeSelector, handleSelect, canSwitch } = useBranchSelector();
  const capabilities = useCapabilities();
  const showTables = hasTables(capabilities);
  const kitchenEnabled = hasKitchen(capabilities);

  const [orders, setOrders] = useState<DiningOrder[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!activeBranch?.id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [ordersData, tablesData] = await Promise.all([
        fetchActiveOrders(activeBranch.id),
        showTables ? fetchTables(activeBranch.id) : Promise.resolve<RestaurantTable[]>([]),
      ]);
      setOrders(ordersData);
      setTables(tablesData.filter((t) => t.isActive));
    } catch {
      setError('No se pudo cargar la información del turno.');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [activeBranch?.id, showTables]);

  useEffect(() => { void load(); }, [load]);

  const firstName = operator?.employee.firstName ?? '';

  // KPIs derivados de datos reales (órdenes y mesas activas del branch).
  const metrics = useMemo(() => {
    let payableTotal = 0; let payableCount = 0; let inKitchen = 0;
    for (const o of orders) {
      if (PAYABLE.includes(o.status)) { payableTotal += orderTotal(o); payableCount += 1; }
      if (IN_KITCHEN.includes(o.status)) inKitchen += 1;
    }
    const occupied = tables.filter((t) => t.status === 'OCCUPIED').length;
    return { payableTotal, payableCount, inKitchen, occupied, totalTables: tables.length };
  }, [orders, tables]);

  const stats = useMemo(() => {
    const list: { label: string; value: string; hint?: string; hintTone?: 'primary' | 'warning' | 'success' | 'secondary'; mono?: boolean }[] = [
      {
        label: 'Comandas abiertas',
        value: String(orders.length),
        hint: kitchenEnabled ? `${metrics.inKitchen} en cocina` : undefined,
        hintTone: 'warning',
      },
      {
        label: 'Por cobrar',
        value: formatCurrency(metrics.payableTotal),
        hint: `${metrics.payableCount} cuenta${metrics.payableCount === 1 ? '' : 's'}`,
        hintTone: 'success',
        mono: true,
      },
    ];
    if (showTables) {
      list.push({
        label: 'Mesas ocupadas',
        value: `${metrics.occupied}`,
        hint: `de ${metrics.totalTables}`,
        hintTone: 'primary',
      });
    }
    if (kitchenEnabled) {
      list.push({ label: 'En cocina', value: String(metrics.inKitchen), hint: 'en preparación', hintTone: 'warning' });
    }
    return list;
  }, [orders.length, metrics, showTables, kitchenEnabled]);

  // Cuentas listas para cobrar (reales) — acción directa: ir a Comandas.
  const payableOrders = useMemo(
    () => orders.filter((o) => PAYABLE.includes(o.status)),
    [orders],
  );

  return (
    <Screen edges={[]}>
      <AppHeader
        branchName={activeBranch?.name ?? 'Sucursal'}
        showSearch={false}
        actions={[]}
        onPressBranch={canSwitch ? openSelector : undefined}
      />
      <BranchSelectorModal
        visible={modalVisible}
        branches={availableBranches}
        activeBranchId={activeBranch?.id ?? null}
        onSelect={handleSelect}
        onClose={closeSelector}
      />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
      >
        <View>
          <Text variant="h1">{firstName ? `Hola, ${firstName}` : 'Bienvenido'}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
            {activeBranch?.name ?? 'Sucursal'}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.xl }} />
        ) : error ? (
          <Text variant="body" tone="danger" style={{ textAlign: 'center', marginTop: theme.spacing.xl }}>{error}</Text>
        ) : (
          <>
            <Grid data={stats} columns={statCols} keyExtractor={(s) => s.label} renderItem={(s) => <StatCard {...s} />} />

            <Card elevated>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
                <Text variant="subtitle">Listas para cobrar</Text>
                {payableOrders.length > 0 && (
                  <Text variant="label" tone="primary" onPress={() => router.navigate('/comandas')}>
                    Ver comandas →
                  </Text>
                )}
              </View>
              {payableOrders.length === 0 ? (
                <Text variant="body" tone="secondary" style={{ textAlign: 'center', paddingVertical: theme.spacing.lg }}>
                  No hay cuentas por cobrar.
                </Text>
              ) : (
                <View style={{ gap: theme.spacing.md }}>
                  {payableOrders.map((o) => {
                    const status: StatusKey = 'ready';
                    const title = o.table?.name ?? o.reference ?? 'Cuenta';
                    const waiter = `${o.waiter?.firstName ?? ''} ${o.waiter?.lastName ?? ''}`.trim();
                    return (
                      <OrderCard
                        key={o.id}
                        title={`${title} · ${formatCurrency(orderTotal(o))}`}
                        subtitle={[waiter || null, `Abierta hace ${formatElapsed(o.openedAt)}`].filter(Boolean).join(' · ')}
                        status={status}
                        onPress={() => router.navigate('/comandas')}
                      />
                    );
                  })}
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
