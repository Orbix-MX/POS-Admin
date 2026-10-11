/**
 * Content of "General" — no scaffold, no back button, so `settings/general.tsx`
 * (phone push) and `settings/index.tsx` (tablet detail pane) can both mount it
 * as-is.
 *
 * Every control here is either real or honestly says why it isn't yet:
 *   - Apariencia, Moneda, Casas decimales, Pantalla de inicio, Ordenar
 *     productos en POS → wired to a real endpoint or a real device
 *     preference (`use-tenant-settings.ts`, `use-settings-prefs.ts`).
 *   - Transacciones canceladas → stays inert. Orbix Mobile has no sales
 *     history screen for it to affect (only the POS, products and customers
 *     screens are live) — the row says so instead of pretending.
 *   - Borrar datos → stays a confirm-only stub. There is no self-service
 *     "wipe my tenant" endpoint, and inventing one to make a switch feel
 *     complete would be the wrong kind of "functional."
 */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  OrbixBottomSheet,
  type OrbixBottomSheetRef,
  OrbixModal,
  OrbixSkeleton,
  OrbixSwitch,
  OrbixText,
  SettingsOptionRow,
  SettingsRow,
  SettingsSection,
  toast,
} from '@/components';
import { CheckIcon, ChartIcon, HomeIcon, PackageIcon, ShoppingBagIcon, StoreIcon, TrashIcon, UsersIcon } from '@/components/ui/icons';
import { CURRENCIES } from '@/constants/business-types';
import {
  useTenantInfo,
  useTenantSettings,
  useUpdateTenantInfo,
  useUpdateTenantSettings,
} from '@/features/tenant/use-tenant-settings';
import { useHomeScreenPref, usePosSortByPref, type HomeScreenPref } from '@/features/settings/use-settings-prefs';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme, useThemeContext } from '@/hooks/use-theme';
import type { ThemeMode } from '@/theme/types';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];
const MODE_LABEL_KEY = {
  system: 'settings.themeSystem',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
} as const;

type HomeScreenLabelKey = 'drawer.home' | 'drawer.modules.ventas' | 'drawer.modules.inventario' | 'drawer.modules.clientes';

interface HomeScreenOption {
  value: HomeScreenPref;
  labelKey: HomeScreenLabelKey;
  Icon: typeof HomeIcon;
  /** `undefined` — Inicio is always reachable; every other target is gated. */
  permission?: string;
}

const HOME_SCREEN_OPTIONS: HomeScreenOption[] = [
  { value: 'inicio', labelKey: 'drawer.home', Icon: HomeIcon },
  { value: 'ventas', labelKey: 'drawer.modules.ventas', Icon: ShoppingBagIcon, permission: 'orders:create' },
  { value: 'inventario', labelKey: 'drawer.modules.inventario', Icon: PackageIcon, permission: 'products:view' },
  { value: 'clientes', labelKey: 'drawer.modules.clientes', Icon: UsersIcon, permission: 'customers:view' },
];

export function GeneralPanel() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { can } = usePermissions();
  const { mode, setMode } = useThemeContext();

  const { data: info, isLoading: loadingInfo, error: infoError } = useTenantInfo();
  const updateInfo = useUpdateTenantInfo();
  const { data: settings, isLoading: loadingSettings } = useTenantSettings();
  const updateSettings = useUpdateTenantSettings();

  const { value: homeScreen, setPref: setHomeScreen } = useHomeScreenPref();
  const { value: posSortBy, setPref: setPosSortBy } = usePosSortByPref();

  const currencySheetRef = useRef<OrbixBottomSheetRef>(null);
  const homeScreenSheetRef = useRef<OrbixBottomSheetRef>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const currencyLabel = useMemo(() => {
    if (!info?.currency) return t('settings.notSet');
    const symbol = new Intl.NumberFormat(undefined, { style: 'currency', currency: info.currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value;
    return symbol ? `${info.currency} — ${symbol}` : info.currency;
  }, [info?.currency, t]);

  const availableHomeOptions = useMemo(
    () => HOME_SCREEN_OPTIONS.filter((option) => !option.permission || can(option.permission)),
    [can],
  );
  const homeScreenLabel = t(HOME_SCREEN_OPTIONS.find((o) => o.value === homeScreen)?.labelKey ?? 'drawer.home');

  const handleSelectCurrency = (currency: string) => {
    currencySheetRef.current?.close();
    if (currency === info?.currency) return;
    updateInfo.mutate(
      { currency },
      {
        onSuccess: () => toast.success(t('settings.currencyUpdated')),
        onError: () => toast.error(t('errors.network')),
      },
    );
  };

  const handleSelectHomeScreen = (value: HomeScreenPref) => {
    homeScreenSheetRef.current?.close();
    if (value === homeScreen) return;
    setHomeScreen(value);
    toast.success(t('settings.homeScreenUpdated'));
  };

  const handleToggleDecimals = (next: boolean) => {
    updateSettings.mutate(
      { decimalPlaces: next },
      { onError: () => toast.error(t('errors.network')) },
    );
  };

  const handleSelectSort = (value: 'createdAt' | 'name') => {
    if (value === posSortBy) return;
    setPosSortBy(value);
    toast.success(t('settings.sortUpdated'));
  };

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <SettingsSection title={t('settings.appearance')}>
        <View style={{ padding: theme.spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: theme.colors.muted,
              borderRadius: theme.radius.lg,
              padding: 4,
              gap: 4,
            }}
          >
            {MODES.map((m) => {
              const active = m === mode;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1,
                    paddingVertical: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    alignItems: 'center',
                    backgroundColor: active ? theme.colors.card : 'transparent',
                  }}
                >
                  <OrbixText size="sm" weight={active ? 'semibold' : 'regular'} tone={active ? 'foreground' : 'mutedForeground'}>
                    {t(MODE_LABEL_KEY[m])}
                  </OrbixText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SettingsSection>

      <SettingsSection title={t('settings.sectionCommerce')}>
        {loadingInfo || loadingSettings ? (
          <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
            <OrbixSkeleton height={56} radius={theme.radius.md} />
            <OrbixSkeleton height={56} radius={theme.radius.md} />
          </View>
        ) : infoError ? (
          <View style={{ padding: theme.spacing.md }}>
            <OrbixText size="sm" tone="dangerFg">{t('errors.network')}</OrbixText>
          </View>
        ) : (
          <>
            <SettingsRow
              icon={<StoreIcon size={16} color={theme.colors.brandBlue600} />}
              title={t('settings.currency')}
              value={currencyLabel}
              onPress={() => currencySheetRef.current?.expand()}
            />
            <SettingsRow
              icon={<ChartIcon size={16} color={theme.colors.brandBlue600} />}
              title={t('settings.decimalPlaces')}
              description={t('settings.decimalPlacesDescription')}
              isLast
              trailing={
                <OrbixSwitch
                  value={settings?.decimalPlaces ?? true}
                  onValueChange={handleToggleDecimals}
                  disabled={!can('settings:manage') || updateSettings.isPending}
                  accessibilityLabel={t('settings.decimalPlaces')}
                />
              }
            />
          </>
        )}
      </SettingsSection>

      <SettingsSection title={t('settings.sectionPreferences')}>
        <SettingsRow
          icon={<HomeIcon size={16} color={theme.colors.brandBlue600} />}
          title={t('settings.homeScreen')}
          value={homeScreenLabel}
          onPress={() => homeScreenSheetRef.current?.expand()}
        />
        <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
          <OrbixText size="sm" weight="semibold" tone="mutedForeground">
            {t('settings.sortProductsIn')}
          </OrbixText>
        </View>
        <SettingsOptionRow
          label={t('settings.sortByDate')}
          selected={posSortBy === 'createdAt'}
          onPress={() => handleSelectSort('createdAt')}
        />
        <SettingsOptionRow
          label={t('settings.sortAlphabetical')}
          selected={posSortBy === 'name'}
          onPress={() => handleSelectSort('name')}
          isLast
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionTransactions')}>
        <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
          <OrbixText size="sm" weight="semibold" tone="mutedForeground">
            {t('settings.cancelledTransactions')}
          </OrbixText>
          <OrbixText size="xs" tone="mutedForeground" style={{ marginTop: 2 }}>
            {t('settings.cancelledTransactionsUnavailable')}
          </OrbixText>
        </View>
        <SettingsOptionRow label={t('settings.showStrikethrough')} selected disabled />
        <SettingsOptionRow label={t('settings.hideCancelled')} selected={false} disabled isLast />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionDanger')} tone="danger">
        <SettingsRow
          icon={<TrashIcon size={15} color={theme.colors.dangerFg} />}
          title={t('settings.wipeData')}
          description={t('settings.wipeDataDescription')}
          danger
          isLast
          onPress={() => setConfirmWipe(true)}
        />
      </SettingsSection>

      <OrbixBottomSheet ref={currencySheetRef} title={t('settings.currency')}>
        <View style={{ gap: 2 }}>
          {CURRENCIES.map((currency) => {
            const selected = currency === info?.currency;
            return (
              <Pressable
                key={currency}
                onPress={() => handleSelectCurrency(currency)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 48,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  backgroundColor: selected ? theme.colors.muted : 'transparent',
                }}
              >
                <OrbixText size="md" weight={selected ? 'semibold' : 'regular'}>{currency}</OrbixText>
                {selected ? <CheckIcon size={14} color={theme.colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </OrbixBottomSheet>

      <OrbixBottomSheet ref={homeScreenSheetRef} title={t('settings.homeScreen')}>
        <View style={{ gap: 2 }}>
          {availableHomeOptions.map((option) => {
            const selected = option.value === homeScreen;
            return (
              <Pressable
                key={option.value}
                onPress={() => handleSelectHomeScreen(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  minHeight: 48,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  backgroundColor: selected ? theme.colors.muted : 'transparent',
                }}
              >
                <option.Icon size={15} color={selected ? theme.colors.primary : theme.colors.mutedForeground} />
                <OrbixText size="md" weight={selected ? 'semibold' : 'regular'} style={{ flex: 1 }}>
                  {t(option.labelKey)}
                </OrbixText>
                {selected ? <CheckIcon size={14} color={theme.colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </OrbixBottomSheet>

      <OrbixModal
        visible={confirmWipe}
        title={t('settings.wipeDataConfirmTitle')}
        description={t('settings.wipeDataConfirmDescription')}
        confirmLabel={t('settings.wipeData')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          setConfirmWipe(false);
          toast.info(t('errors.notImplemented'));
        }}
        onDismiss={() => setConfirmWipe(false)}
      />
    </View>
  );
}
