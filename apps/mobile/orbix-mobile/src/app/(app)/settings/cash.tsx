/**
 * Configuración → Caja, como pantalla propia en teléfono. En tablet el panel se
 * monta dentro del maestro-detalle y esta ruta no se usa.
 */
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BackButton, OrbixScaffold, OrbixText } from '@/components';
import { CashPanel } from '@/features/settings/panels/cash-panel';
import { useTheme } from '@/hooks/use-theme';

export default function CashSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <OrbixScaffold scrollable contentStyle={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t('settings.categories.cash.title')}
        </OrbixText>
      </View>
      <CashPanel />
    </OrbixScaffold>
  );
}
