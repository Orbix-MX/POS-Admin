/**
 * Tenant picker — step 2 of the API's staged auth
 * (`PATCH /auth/select-tenant/:slug`).
 *
 * Shown when an account belongs to several companies, and reachable from home
 * so a user can switch without signing out. Uses FlashList because the list is
 * unbounded: a franchise operator can belong to dozens of tenants.
 */
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  ChevronRightIcon,
  InlineError,
  OrbixAvatar,
  OrbixButton,
  OrbixCard,
  OrbixScaffold,
  OrbixSpinner,
  OrbixText,
} from '@/components';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import type { TenantSummary } from '@/models/session';
import { toUserMessage } from '@/utils/error-message';

export default function SelectTenantScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { session, selectTenant } = useAuth();

  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSelect = useCallback(
    async (tenant: TenantSummary) => {
      setError(null);
      setSwitchingId(tenant.id);
      try {
        await selectTenant(tenant);
        router.replace('/(app)');
      } catch (selectError) {
        setError(toUserMessage(selectError, t));
      } finally {
        setSwitchingId(null);
      }
    },
    [selectTenant, router, t],
  );

  const tenants = session?.availableTenants ?? [];

  return (
    <OrbixScaffold background="wash" contentStyle={{ gap: theme.spacing.xl }}>
      <View style={{ gap: theme.spacing.xs }}>
        <OrbixText size="2xl" weight="bold" accessibilityRole="header">
          {t('tenant.selectTitle')}
        </OrbixText>
        <OrbixText size="base" tone="mutedForeground">
          {t('tenant.selectSubtitle')}
        </OrbixText>
      </View>

      <InlineError message={error} />

      <View style={{ flex: 1 }}>
        <FlashList
          data={tenants}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void onSelect(item)}
              disabled={switchingId !== null}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              accessibilityState={{ busy: switchingId === item.id }}
            >
              <OrbixCard elevation="sm">
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
                >
                  <OrbixAvatar name={item.name} size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <OrbixText size="md" weight="semibold" numberOfLines={1}>
                      {item.name}
                    </OrbixText>
                    <OrbixText size="sm" tone="mutedForeground">
                      {item.memberRole} · {item.plan}
                    </OrbixText>
                  </View>
                  {switchingId === item.id ? (
                    <OrbixSpinner size={16} />
                  ) : (
                    <ChevronRightIcon size={12} color={theme.colors.mutedForeground} />
                  )}
                </View>
              </OrbixCard>
            </Pressable>
          )}
        />
      </View>

      <OrbixButton
        label={t('tenant.createNew')}
        variant="outline"
        onPress={() => router.push('/(wizard)/company-info')}
      />
    </OrbixScaffold>
  );
}
