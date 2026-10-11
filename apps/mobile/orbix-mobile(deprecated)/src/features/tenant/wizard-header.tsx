/**
 * Shared wizard header: back disc, "Paso N de 4", segmented progress.
 *
 * Lives with the feature rather than in `components/` because the step label
 * and the back semantics are specific to this flow.
 */
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BackButton, OrbixStepper, OrbixText } from '@/components';
import { useTheme } from '@/hooks/use-theme';

export interface WizardHeaderProps {
  step: number;
  totalSteps: number;
  onBack: () => void;
}

function WizardHeaderComponent({ step, totalSteps, onBack }: WizardHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={onBack} accessibilityLabel={t('a11y.back')} size={32} />
        <OrbixText size="sm" weight="semibold" tone="mutedForeground">
          {t('wizard.stepLabel', { current: String(step), total: String(totalSteps) })}
        </OrbixText>
      </View>

      <OrbixStepper
        current={step}
        total={totalSteps}
        accessibilityLabel={t('a11y.progress', {
          current: String(step),
          total: String(totalSteps),
        })}
      />
    </View>
  );
}

export const WizardHeader = memo(WizardHeaderComponent);
