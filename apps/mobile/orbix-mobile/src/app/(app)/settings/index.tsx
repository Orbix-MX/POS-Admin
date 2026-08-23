/**
 * Configuración — categories → detail. Phone pushes a full screen per
 * category; tablet gets a master-detail split (categories on the left,
 * content on the right) instead of just stretching the same rows wider.
 *
 * Only General and Datos de la tienda have a built panel. Every other
 * category is a real row — icon, title, description — but disabled with a
 * "Próx." badge: the module it points to doesn't exist in Orbix yet, and a
 * row that opens to nothing would be worse than a row that's honest about
 * not being live.
 */
import { useRouter } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BackButton, OrbixScaffold, OrbixText, SettingsRow, SettingsSection } from '@/components';
import { SETTINGS_CATEGORIES, type SettingsCategory, type SettingsCategoryKey } from '@/features/settings/categories';
import { GeneralPanel } from '@/features/settings/panels/general-panel';
import { StorePanel } from '@/features/settings/panels/store-panel';
import { useIsTablet } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

const PANELS: Partial<Record<SettingsCategoryKey, ComponentType>> = {
  general: GeneralPanel,
  store: StorePanel,
};

function CategoryList({
  selectedKey,
  showChevron,
  onSelect,
}: {
  selectedKey?: SettingsCategoryKey;
  showChevron: boolean;
  onSelect: (category: SettingsCategory) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <SettingsSection>
      {SETTINGS_CATEGORIES.map((category, index) => {
        const soon = category.status === 'soon';
        return (
          <Animated.View key={category.key} entering={FadeInDown.delay(index * 35).duration(240)}>
            <SettingsRow
              icon={
                <category.Icon
                  size={16}
                  color={soon ? theme.colors.mutedForeground : theme.colors[category.tintFg]}
                />
              }
              iconTint={soon ? theme.colors.muted : theme.colors[category.tintBg]}
              title={t(`settings.categories.${category.key}.title`)}
              description={t(`settings.categories.${category.key}.description`)}
              badge={soon ? t('drawer.comingSoon') : undefined}
              disabled={soon}
              active={selectedKey === category.key}
              showChevron={showChevron}
              isLast={index === SETTINGS_CATEGORIES.length - 1}
              onPress={category.status === 'live' ? () => onSelect(category) : undefined}
            />
          </Animated.View>
        );
      })}
    </SettingsSection>
  );
}

export default function SettingsIndexScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const isTablet = useIsTablet();

  const [selectedKey, setSelectedKey] = useState<SettingsCategoryKey>('general');
  const selectedCategory = SETTINGS_CATEGORIES.find((category) => category.key === selectedKey);
  const SelectedPanel: ComponentType | undefined = PANELS[selectedKey];

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
      <OrbixText size="xl" weight="bold" accessibilityRole="header">
        {t('settings.title')}
      </OrbixText>
    </View>
  );

  if (!isTablet) {
    return (
      <OrbixScaffold background="surface" scrollable contentStyle={{ gap: theme.spacing.xl }}>
        {header}
        <CategoryList
          showChevron
          onSelect={(category) => {
            if (category.route) router.push(category.route);
          }}
        />
      </OrbixScaffold>
    );
  }

  return (
    <OrbixScaffold background="surface" contentStyle={{ gap: theme.spacing.xl }}>
      {header}
      <View style={{ flex: 1, flexDirection: 'row', gap: theme.spacing.xl }}>
        <ScrollView style={{ width: 320, flexGrow: 0 }} showsVerticalScrollIndicator={false}>
          <CategoryList
            selectedKey={selectedKey}
            showChevron={false}
            onSelect={(category) => setSelectedKey(category.key)}
          />
        </ScrollView>

        <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: theme.colors.border, paddingLeft: theme.spacing.xl }}>
          {selectedCategory && SelectedPanel ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: theme.spacing['3xl'] }}>
              {/* `key` forces a remount on category change, which is what
                  makes `entering` replay — a plain re-render wouldn't. */}
              <Animated.View key={selectedCategory.key} entering={FadeInDown.duration(200)} style={{ gap: theme.spacing.lg }}>
                <OrbixText size="lg" weight="bold" accessibilityRole="header">
                  {t(`settings.categories.${selectedCategory.key}.title`)}
                </OrbixText>
                <SelectedPanel />
              </Animated.View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </OrbixScaffold>
  );
}
