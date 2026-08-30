/**
 * Wizard step 4 — creation + success.
 *
 * The confetti and the drawn check fire immediately (the wizard's data is
 * complete at this point), while the actual tenant creation happens when the
 * user taps "Entrar al sistema".
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  AnimatedSuccessCheck,
  Confetti,
  InlineError,
  OrbixButton,
  OrbixGradient,
  OrbixScaffold,
  OrbixText,
} from '@/components';
import { useCreateTenant } from '@/features/tenant/use-tenant-onboarding';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useWizard } from '@/providers';
import { toUserMessage } from '@/utils/error-message';

export default function WizardSuccessScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { draft, goToStep, reset } = useWizard();
  const { refresh } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const createTenant = useCreateTenant(draft);

  useEffect(() => {
    goToStep(4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEnter = useCallback(() => {
    setError(null);
    createTenant.mutate(undefined, {
      onSuccess: async () => {
        // The endpoint returns a token already scoped to the new tenant, so a
        // profile refresh is enough to pick up the tenant, branch and roles.
        reset();
        await refresh();
        router.replace('/(app)');
      },
      onError: (createError) => setError(toUserMessage(createError, t)),
    });
  }, [createTenant, reset, refresh, router, t]);

  return (
    <OrbixScaffold horizontalPadding={theme.spacing['4xl']}>
      <Confetti />

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing['2xl'],
        }}
      >
        <OrbixGradient
          variant="primary"
          style={[
            {
              width: 88,
              height: 88,
              borderRadius: 44,
              alignItems: 'center',
              justifyContent: 'center',
            },
            theme.shadows.primaryStrong,
          ]}
        >
          <AnimatedSuccessCheck size={42} />
        </OrbixGradient>

        <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
          <OrbixText size="2xl" weight="extrabold" align="center" accessibilityRole="header">
            {t('wizard.success.title')}
          </OrbixText>
          <OrbixText
            size="md"
            tone="mutedForeground"
            align="center"
            leading="normal"
            style={{ maxWidth: 280 }}
          >
            {t('wizard.success.subtitle')}
          </OrbixText>
        </View>

        <InlineError message={error} />

        <OrbixButton
          label={createTenant.isPending ? t('wizard.success.entering') : t('wizard.success.enter')}
          onPress={onEnter}
          loading={createTenant.isPending}
        />

        <Pressable
          onPress={() => router.replace('/(wizard)/company-info')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <OrbixText size="sm" tone="mutedForeground">
            {t('common.back')}
          </OrbixText>
        </Pressable>
      </View>
    </OrbixScaffold>
  );
}
