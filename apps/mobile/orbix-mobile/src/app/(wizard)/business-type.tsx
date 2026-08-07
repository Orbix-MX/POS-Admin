/**
 * Wizard step 2 — business type.
 *
 * The catalog comes from `useBusinessTypes`, which serves the backend list when
 * it exists and the bundled one until then. Rendered as a two-column grid to
 * match the prototype; a FlashList would be overkill for ten fixed tiles and
 * would fight the `gap`-based layout.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  BusinessTypeCard,
  InlineError,
  OrbixButton,
  OrbixScaffold,
  OrbixSkeleton,
  OrbixText,
} from '@/components';
import { useBusinessTypes } from '@/features/business/use-business-types';
import { WizardHeader } from '@/features/tenant/wizard-header';
import { useTheme } from '@/hooks/use-theme';
import { useWizard } from '@/providers';

export default function BusinessTypeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { draft, totalSteps, update, goToStep } = useWizard();

  const { items, isFetching } = useBusinessTypes();
  const [selectedId, setSelectedId] = useState(draft.businessTypeId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    goToStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onContinue = useCallback(() => {
    if (!selectedId) {
      setError(t('validation.businessTypeRequired'));
      return;
    }
    update({ businessTypeId: selectedId, step: 3 });
    router.push('/(wizard)/verify-phone');
  }, [selectedId, update, router, t]);

  const onSelect = useCallback((id: string) => {
    setError(null);
    setSelectedId(id);
  }, []);

  return (
    <OrbixScaffold
      background="wash"
      scrollable
      topPadding={theme.spacing.md}
      contentStyle={{ gap: theme.spacing.xl }}
    >
      <WizardHeader step={2} totalSteps={totalSteps} onBack={() => router.back()} />

      <View style={{ gap: theme.spacing.xs }}>
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t('wizard.step2.title')}
        </OrbixText>
        <OrbixText size="base" tone="mutedForeground">
          {t('wizard.step2.subtitle')}
        </OrbixText>
      </View>

      <InlineError message={error} />

      {items.length === 0 && isFetching ? (
        <View style={{ gap: theme.spacing.md }}>
          {[0, 1, 2, 3, 4].map((row) => (
            <View key={row} style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <OrbixSkeleton height={92} radius={theme.radius.xl} />
              <OrbixSkeleton height={92} radius={theme.radius.xl} />
            </View>
          ))}
        </View>
      ) : (
        <View
          accessibilityRole="radiogroup"
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.md,
          }}
        >
          {items.map((item, index) => (
            <Animated.View
              key={item.id}
              // Staggered reveal; capped so the last tile is not left waiting.
              entering={FadeInDown.delay(Math.min(index, 6) * 40).duration(240)}
              style={{ width: '47.5%' }}
            >
              <BusinessTypeCard
                icon={item.icon}
                label={item.displayLabel}
                selected={item.id === selectedId}
                onPress={() => onSelect(item.id)}
                accessibilityLabel={t('a11y.selectBusinessType', { label: item.displayLabel })}
              />
            </Animated.View>
          ))}
        </View>
      )}

      <OrbixButton
        label={t('common.continue')}
        onPress={onContinue}
        disabled={!selectedId}
      />
    </OrbixScaffold>
  );
}
