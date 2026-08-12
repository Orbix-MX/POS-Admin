/**
 * Settings — first real screen reachable from the drawer. Currently just
 * appearance (theme mode); add new sections here as they land.
 */
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BackButton, OrbixCard, OrbixScaffold, OrbixText } from '@/components';
import { useTheme, useThemeContext } from '@/hooks/use-theme';
import type { ThemeMode } from '@/theme/types';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];
const MODE_LABEL_KEY = {
  system: 'settings.themeSystem',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
} as const;

export default function SettingsScreen() {
  const theme = useTheme();
  const { mode, setMode } = useThemeContext();
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <OrbixScaffold background="surface" scrollable contentStyle={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t('settings.title')}
        </OrbixText>
      </View>

      <OrbixCard>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground" style={{ marginBottom: theme.spacing.md, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {t('settings.appearance')}
        </OrbixText>

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
      </OrbixCard>
    </OrbixScaffold>
  );
}
