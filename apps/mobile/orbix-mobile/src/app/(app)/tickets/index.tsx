/**
 * Tickets — el historial de ventas.
 *
 * Existe porque hasta ahora una venta cobrada desaparecía: no había forma de
 * consultarla, reenviarla ni corregirla, y la primera equivocación dejaba al
 * operador sin salida.
 *
 * El rango de fechas se calcula en el dispositivo (`date-ranges.ts`): el
 * servidor compara en UTC y no sabe en qué huso vive el negocio.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import {
  AppDrawer,
  DrawerButton,
  OrbixCard,
  OrbixScaffold,
  OrbixSkeleton,
  OrbixText,
  ShoppingBagIcon,
} from '@/components';
import { resolveDateRange, type DateRangeKey } from '@/features/orders/date-ranges';
import { OrderStatusPill } from '@/features/orders/order-status-pill';
import { paymentMethodLabel } from '@/features/orders/payment-method';
import { useOrders } from '@/features/orders/use-orders';
import { useCurrencyFormatVersion } from '@/hooks/use-currency-format-version';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import type { Order } from '@/repositories/orders-repository';
import { toUserMessage } from '@/utils/error-message';

import { formatCurrency } from '@/features/pos/pos-totals';

const RANGES: readonly DateRangeKey[] = ['today', 'week', 'month'];

function OrderRow({ order, onPress }: { order: Order; onPress: () => void }) {
  const { t } = useTranslation();

  const at = new Date(order.createdAt);
  // Una venta anulada o devuelta sigue en el historial, pero su importe ya no
  // es lo que entró: se tacha para que no se lea como ingreso.
  const voided = order.status === 'CANCELLED' || order.status === 'REFUNDED';

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <OrbixCard style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <OrbixText size="sm" weight="semibold">
            {order.orderNumber}
          </OrbixText>
          <OrbixText
            size="base"
            weight="bold"
            tone={voided ? 'mutedForeground' : 'foreground'}
            style={{
              fontVariant: ['tabular-nums'],
              ...(voided ? { textDecorationLine: 'line-through' as const } : {}),
            }}
          >
            {formatCurrency(order.total)}
          </OrbixText>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <OrbixText size="xs" tone="mutedForeground" numberOfLines={1} style={{ flex: 1 }}>
            {at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            {order.customerName ? ` · ${order.customerName}` : ''}
            {order.payments[0] ? ` · ${paymentMethodLabel(order.payments[0].method, t)}` : ''}
          </OrbixText>
          <OrderStatusPill order={order} label={(key) => t(`orders.badge.${key}`)} />
        </View>
      </OrbixCard>
    </Pressable>
  );
}

export default function TicketsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { can } = usePermissions();
  useCurrencyFormatVersion();

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [range, setRange] = useState<DateRangeKey>('today');

  // Se recalcula al cambiar de periodo, no en cada render: el rango forma parte
  // de la clave de caché, y un `dateTo` nuevo cada segundo la invalidaría sola.
  const params = useMemo(() => resolveDateRange(range), [range]);

  const { data, isLoading, isFetching, error, fetchNextPage, hasNextPage, refetch } =
    useOrders(params);

  const orders = data?.pages.flatMap((page) => page.orders) ?? [];
  const total = data?.pages[0]?.meta.total ?? 0;

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <DrawerButton onPress={() => setDrawerVisible(true)} accessibilityLabel={t('drawer.title')} />
      <View style={{ flex: 1 }}>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground">
          {t('orders.title').toUpperCase()}
        </OrbixText>
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t(`orders.range.${range}`)}
        </OrbixText>
      </View>
      {!isLoading ? (
        <OrbixText size="sm" tone="mutedForeground" style={{ fontVariant: ['tabular-nums'] }}>
          {t('orders.count', { count: total })}
        </OrbixText>
      ) : null}
    </View>
  );

  if (!can('orders:view')) {
    return (
      <OrbixScaffold contentStyle={{ gap: theme.spacing.xl }}>
        {header}
        <AppDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ShoppingBagIcon size={38} color={theme.colors.mutedForeground} />
          <OrbixText size="base" weight="semibold">{t('errors.forbidden')}</OrbixText>
        </View>
      </OrbixScaffold>
    );
  }

  return (
    <OrbixScaffold contentStyle={{ gap: theme.spacing.md }}>
      {header}
      <AppDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        {RANGES.map((key) => {
          const active = key === range;
          return (
            <Pressable
              key={key}
              onPress={() => setRange(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: theme.radius.full,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: active ? theme.colors.accentPurple : theme.colors.border,
                backgroundColor: active ? theme.colors.secondary : theme.colors.card,
              }}
            >
              <OrbixText size="sm" weight={active ? 'semibold' : 'regular'}>
                {t(`orders.range.${key}`)}
              </OrbixText>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={{ gap: theme.spacing.sm }}>
          <OrbixSkeleton height={74} radius={theme.radius.xl} />
          <OrbixSkeleton height={74} radius={theme.radius.xl} />
          <OrbixSkeleton height={74} radius={theme.radius.xl} />
        </View>
      ) : error ? (
        <OrbixCard>
          <OrbixText size="sm" tone="dangerFg">{toUserMessage(error, t)}</OrbixText>
        </OrbixCard>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderRow
              order={item}
              onPress={() => router.push({ pathname: '/(app)/tickets/[id]', params: { id: item.id } })}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: theme.spacing['3xl'] }}
          onEndReached={() => {
            if (hasNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.brandBlue500}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 56, paddingHorizontal: 20 }}>
              <ShoppingBagIcon size={38} color={theme.colors.mutedForeground} />
              <OrbixText size="base" weight="semibold">{t('orders.empty')}</OrbixText>
              <OrbixText size="sm" tone="mutedForeground" align="center" style={{ maxWidth: 240 }}>
                {t('orders.emptyHint')}
              </OrbixText>
            </View>
          }
        />
      )}
    </OrbixScaffold>
  );
}
