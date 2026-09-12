/**
 * Historial de sesiones de caja.
 *
 * Paginado de verdad desde el primer día: `GET /cash-sessions` devuelve `meta`
 * y una tienda genera una sesión diaria — a los tres meses son noventa filas.
 * El techo fijo de 100 que arrastran productos y clientes no se repite aquí.
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import {
  BackButton,
  ChartIcon,
  OrbixCard,
  OrbixScaffold,
  OrbixSkeleton,
  OrbixText,
} from '@/components';
import { StatusPill } from '@/features/cash/session-summary-card';
import { useAuth } from '@/hooks/use-auth';
import { useCurrencyFormatVersion } from '@/hooks/use-currency-format-version';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import { cashSessionsRepository, type CashSessionListItem } from '@/repositories/cash-repository';
import { queryKeys } from '@/services/query/query-keys';

import { formatCurrency } from '@/features/pos/pos-totals';

const PAGE_SIZE = 20;

function SessionRow({ item, onPress }: { item: CashSessionListItem; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

  const opened = new Date(item.openedAt);
  const difference = item.difference ?? 0;
  const settled = Math.abs(difference) < 0.005;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <OrbixCard style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <OrbixText size="sm" weight="semibold">
            {opened.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
            {' · '}
            {opened.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </OrbixText>
          <StatusPill status={item.status} label={t(`cash.status.${item.status}`)} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <OrbixText size="xs" tone="mutedForeground">
            {item.movementsCount} {t('cash.movements')}
          </OrbixText>
          {item.cashCounted !== null ? (
            <OrbixText
              size="xs"
              weight="semibold"
              tone={settled ? 'successFg' : 'dangerFg'}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {settled
                ? t('cash.settled')
                : `${difference > 0 ? '+' : '−'}${formatCurrency(Math.abs(difference))}`}
            </OrbixText>
          ) : null}
        </View>
      </OrbixCard>
    </Pressable>
  );
}

export default function CajaHistorialScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { can } = usePermissions();
  useCurrencyFormatVersion();

  const tenantId = session?.tenant?.id;
  const branchId = session?.branchId;

  const { data, isLoading, isFetching, fetchNextPage, hasNextPage, refetch } = useInfiniteQuery({
    queryKey: queryKeys.cash.sessionList(tenantId, branchId, { limit: PAGE_SIZE }),
    queryFn: ({ pageParam }) =>
      cashSessionsRepository.list({ page: pageParam, limit: PAGE_SIZE, branchId }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: Boolean(tenantId) && can('cash:view'),
  });

  const sessions = data?.pages.flatMap((page) => page.sessions) ?? [];

  return (
    <OrbixScaffold contentStyle={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t('cash.history.title')}
        </OrbixText>
      </View>

      {isLoading ? (
        <View style={{ gap: theme.spacing.sm }}>
          <OrbixSkeleton height={82} radius={theme.radius.xl} />
          <OrbixSkeleton height={82} radius={theme.radius.xl} />
          <OrbixSkeleton height={82} radius={theme.radius.xl} />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SessionRow
              item={item}
              onPress={() => router.push({ pathname: '/(app)/caja/[id]', params: { id: item.id } })}
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
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 56 }}>
              <ChartIcon size={38} color={theme.colors.mutedForeground} />
              <OrbixText size="base" weight="semibold">
                {t('cash.history.empty')}
              </OrbixText>
            </View>
          }
        />
      )}
    </OrbixScaffold>
  );
}
