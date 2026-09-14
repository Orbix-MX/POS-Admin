/**
 * Home — the prototype's "resumen" screen.
 *
 * KPIs come from `GET /api/dashboard/stats` (real data, tenant-scoped by the
 * JWT). While the request is in flight the tiles render skeletons rather than
 * zeros, so an empty shop and a loading shop never look the same.
 */
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  AppDrawer,
  KpiCard,
  MenuIcon,
  OrbixAvatar,
  OrbixButton,
  OrbixCard,
  OrbixScaffold,
  OrbixText,
} from '@/components';
import { Ripple, useRipple } from '@/components/animations/ripple';
import { useDashboardStats } from '@/features/common/use-dashboard-stats';
import { OnboardingChecklist } from '@/features/dashboard/onboarding-checklist';
import { useDayPulse } from '@/features/dashboard/use-day-pulse';
import { getHomeScreenPref, type HomeScreenPref } from '@/features/settings/use-settings-prefs';
import { useAuth } from '@/hooks/use-auth';
import { useCurrencyFormatVersion } from '@/hooks/use-currency-format-version';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import { currencyFormatStore } from '@/services/currency/currency-format-store';

const formatCurrency = currencyFormatStore.format;

/** Mirrors the drawer's own gating — a pref pointing at a module the user
 *  lost access to (role change) must not strand them on a blank redirect. */
const HOME_SCREEN_ROUTES: Record<Exclude<HomeScreenPref, 'inicio'>, { route: '/(app)/pos' | '/(app)/products' | '/(app)/customers'; permission: string }> = {
  ventas: { route: '/(app)/pos', permission: 'orders:create' },
  inventario: { route: '/(app)/products', permission: 'products:view' },
  clientes: { route: '/(app)/customers', permission: 'customers:view' },
};

export default function HomeScreen() {
  const theme = useTheme();
  const menuRipple = useRipple();
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { can } = usePermissions();

  const { data, isLoading } = useDashboardStats();
  const { pulse, isLoading: pulseLoading } = useDayPulse('today');
  const [drawerVisible, setDrawerVisible] = useState(false);
  useCurrencyFormatVersion();

  // Only ever fires once per mount — `router.replace` unmounts this screen,
  // so there's no risk of re-triggering (and no dependency array to get wrong).
  const redirected = useRef(false);
  useEffect(() => {
    if (redirected.current) return;
    const pref = getHomeScreenPref();
    if (pref === 'inicio') return;
    const target = HOME_SCREEN_ROUTES[pref];
    if (!can(target.permission)) return;
    redirected.current = true;
    router.replace(target.route);
  }, [can, router]);

  const subtitle = useMemo(() => {
    const parts = [session?.capabilities?.businessVertical, session?.tenant?.plan].filter(Boolean);
    return parts.join(' · ');
  }, [session?.capabilities?.businessVertical, session?.tenant?.plan]);

  return (
    <OrbixScaffold scrollable contentStyle={{ gap: theme.spacing.xl }}>
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
        <Pressable
          onPress={() => setDrawerVisible(true)}
          onPressIn={(event) =>
            menuRipple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY)
          }
          accessibilityRole="button"
          accessibilityLabel={t('drawer.title')}
          hitSlop={8}
          // Objeto estático + `Ripple`: la forma `style={({pressed}) => …}` se
          // descarta con nativewind + React Compiler (ver `google-button.tsx`).
          style={{
            width: 40,
            height: 40,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.muted,
            overflow: 'hidden',
          }}
        >
          <MenuIcon size={20} color={theme.colors.foreground} />
          <Ripple {...menuRipple} color={theme.colors.primary} borderRadius={theme.radius.full} />
        </Pressable>
      </View>
      <AppDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

      {/* El pulso del día, antes que nada: es la pregunta con la que se abre la
          app cada mañana. Las cifras del turno salen del `summary` que calcula
          el servidor — ver `use-day-pulse.ts` para por qué no de /reports. */}
      <Animated.View entering={FadeInDown.duration(240)} style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <OrbixText size="xs" weight="semibold" tone="mutedForeground" style={{ letterSpacing: 0.5 }}>
            {t('home.today').toUpperCase()}
          </OrbixText>
          {pulse.shiftOpen ? (
            <Pressable onPress={() => router.push('/(app)/caja')} accessibilityRole="button">
              <OrbixText size="xs" weight="semibold" style={{ color: theme.colors.brandBlue600 }}>
                {t('home.openCash')}
              </OrbixText>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <KpiCard
            label={t('home.kpiSoldToday')}
            value={pulse.shiftSales === null ? '—' : formatCurrency(pulse.shiftSales)}
            loading={pulseLoading}
          />
          <KpiCard
            label={t('home.kpiTicketsToday')}
            value={String(pulse.ticketCount)}
            loading={pulseLoading}
          />
        </View>

        {/* Efectivo y gastos solo existen mientras hay un turno abierto: sin
            caja no son cero, es que no hay turno del que hablar. */}
        {pulse.shiftOpen ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <KpiCard
              label={t('home.kpiExpectedCash')}
              value={pulse.expectedCash === null ? '—' : formatCurrency(pulse.expectedCash)}
              loading={pulseLoading}
            />
            <KpiCard
              label={t('home.kpiExpensesToday')}
              value={pulse.shiftExpenses === null ? '—' : formatCurrency(pulse.shiftExpenses)}
              loading={pulseLoading}
            />
          </View>
        ) : (
          <OrbixCard style={{ gap: 4 }}>
            <OrbixText size="sm" weight="semibold">{t('home.noShiftTitle')}</OrbixText>
            <OrbixText size="sm" tone="mutedForeground">{t('home.noShiftHint')}</OrbixText>
          </OrbixCard>
        )}
      </Animated.View>

      {/* Acumulados del negocio. Siguen siendo útiles, pero por debajo de lo de
          hoy: nadie abre la app para ver cuántos productos tiene dados de alta. */}
      <Animated.View entering={FadeInDown.delay(80).duration(240)} style={{ gap: theme.spacing.sm }}>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground" style={{ letterSpacing: 0.5 }}>
          {t('home.totals').toUpperCase()}
        </OrbixText>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <KpiCard
            label={t('home.kpiCustomers')}
            value={String(data?.totalCustomers ?? 0)}
            loading={isLoading}
          />
          <KpiCard
            label={t('home.kpiProducts')}
            value={String(data?.totalProducts ?? 0)}
            loading={isLoading}
          />
        </View>
      </Animated.View>

      <OnboardingChecklist />

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
