import { ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Card, Text, Button, SegmentedControl } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { useAppStore, type ColorSchemePreference } from '@/store/app-store';
import { useAuth } from '@/hooks/use-auth';

const THEME_OPTIONS: { value: ColorSchemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const colorScheme = useAppStore((s) => s.colorScheme);
  const setColorScheme = useAppStore((s) => s.setColorScheme);
  const { logout } = useAuth();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}>
        <Text variant="h2">Perfil</Text>

        <Card elevated>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primaryStrong]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 56, height: 56, borderRadius: theme.radius.full, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text variant="subtitle" color={theme.colors.onPrimary}>
                CM
              </Text>
            </LinearGradient>
            <View>
              <Text variant="subtitle">Carlos Mendoza</Text>
              <Text variant="small" tone="secondary">
                Mesero · turno noche
              </Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text variant="eyebrow" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
            Apariencia
          </Text>
          <SegmentedControl options={THEME_OPTIONS} value={colorScheme} onChange={setColorScheme} />
        </Card>

        <Button label="Cerrar sesión" variant="danger" icon="logout" fullWidth onPress={() => void logout()} />
      </ScrollView>
    </Screen>
  );
}
