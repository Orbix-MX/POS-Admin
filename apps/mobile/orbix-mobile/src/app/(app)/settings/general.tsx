import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BackButton, OrbixScaffold, OrbixText } from '@/components';
import { GeneralPanel } from '@/features/settings/panels/general-panel';
import { useTheme } from '@/hooks/use-theme';

export default function GeneralSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <OrbixScaffold background="surface" scrollable contentStyle={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t('settings.categories.general.title')}
        </OrbixText>
      </View>

      <GeneralPanel />
    </OrbixScaffold>
  );
}
