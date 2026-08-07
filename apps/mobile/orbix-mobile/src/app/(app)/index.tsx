/**
 * Home — the prototype's "resumen" screen.
 *
 * KPIs come from `GET /api/dashboard/stats` (real data, tenant-scoped by the
 * JWT). While the request is in flight the tiles render skeletons rather than
 * zeros, so an empty shop and a loading shop never look the same.
 */
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  CreditCardIcon,
  KpiCard,
  ListRow,
  OrbixAvatar,
  OrbixButton,
  OrbixCard,
  OrbixScaffold,
  OrbixText,
  PackageIcon,
  UsersIcon,
} from '@/components';
import { useDashboardStats } from '@/features/common/use-dashboard-stats';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentLocale } from '@/i18n';

/** Matches the wizard's default; see the TODO in `formatCurrency`. */
const DEFAULT_CURRENCY = 'MXN';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();

  const { data, isLoading } = useDashboardStats();

  const formatCurrency = useCallback(
    (value: number) =>
      new Intl.NumberFormat(getCurrentLocale(), {
        style: 'currency',
        // TODO(backend): the tenant's currency lives in `Tenant.settings` and is
        // not exposed on any endpoint the app can reach yet — neither
        // `/auth/me` nor `/auth/select-tenant` returns it, and
        // `/tenants/current/settings` needs `settings:manage`. Falling back to
        // the wizard's default until it is surfaced.
        currency: DEFAULT_CURRENCY,
        maximumFractionDigits: 0,
      }).format(value),
    [],
  );

  const subtitle = useMemo(() => {
    const parts = [session?.capabilities?.businessVertical, session?.tenant?.plan].filter(Boolean);
    return parts.join(' · ');
  }, [session?.capabilities?.businessVertical, session?.tenant?.plan]);

  return (
    <OrbixScaffold background="wash" scrollable contentStyle={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <OrbixAvatar name={session?.user.fullName ?? 'Orbix'} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <OrbixText size="sm" weight="semibold" tone="mutedForeground">
            {t('home.welcome', { name: session?.user.firstName ?? '' })}
          </OrbixText>
          <OrbixText size="xl" weight="bold" numberOfLines={1} accessibilityRole="header">
            {session?.tenant?.name ?? ''}
          </OrbixText>
          {subtitle ? (
            <OrbixText size="sm" tone="mutedForeground">
              {subtitle}
            </OrbixText>
          ) : null}
        </View>
      </View>

      <Animated.View entering={FadeInDown.duration(240)} style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <KpiCard
            label={t('home.kpiSales')}
            value={formatCurrency(data?.totalRevenue ?? 0)}
            loading={isLoading}
          />
          <KpiCard
            label={t('home.kpiCustomers')}
            value={String(data?.totalCustomers ?? 0)}
            loading={isLoading}
          />
        </View>
        <KpiCard
          label={t('home.kpiProducts')}
          value={String(data?.totalProducts ?? 0)}
          loading={isLoading}
        />
      </Animated.View>

      <View style={{ gap: theme.spacing.sm }}>
        <OrbixText
          size="xs"
          weight="semibold"
          tone="mutedForeground"
          style={{ letterSpacing: 0.5, textTransform: 'uppercase' }}
        >
          {t('home.firstSteps')}
        </OrbixText>

        <OrbixCard padded={false}>
          <ListRow
            icon={<PackageIcon size={14} color={theme.colors.brandBlue500} />}
            label={t('home.addProducts')}
          />
          <ListRow
            icon={<UsersIcon size={14} color={theme.colors.brandBlue500} />}
            label={t('home.inviteTeam')}
          />
          <ListRow
            icon={<CreditCardIcon size={14} color={theme.colors.brandBlue500} />}
            label={t('home.setupPos')}
            isLast
          />
        </OrbixCard>
      </View>

      <View style={{ flex: 1 }} />

      {(session?.availableTenants.length ?? 0) > 1 ? (
        <OrbixButton
          label={t('tenant.selectTitle')}
          variant="outline"
          onPress={() => router.push('/(app)/select-tenant')}
        />
      ) : null}
    </OrbixScaffold>
  );
}
