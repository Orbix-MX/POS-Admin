import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BackButton, OrbixScaffold, OrbixText } from '@/components';
import { SecurityPanel } from '@/features/settings/panels/security-panel';
import { useTheme } from '@/hooks/use-theme';

export default function SecuritySettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <OrbixScaffold background="surface" scrollable contentStyle={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t('settings.categories.security.title')}
        </OrbixText>
      </View>

      <SecurityPanel />
    </OrbixScaffold>
  );
}
