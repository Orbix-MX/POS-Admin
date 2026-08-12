import { useState } from 'react';
import { ScrollView, View, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Card, Text, Button, SegmentedControl } from '@/components/ui';
import { ConfiguracionPanel } from '@/components/settings/configuracion-panel';
import { useTheme } from '@/providers/theme-provider';
import { useAppStore, type ColorSchemePreference } from '@/store/app-store';
import { useDeviceSession } from '@/hooks/use-device-session';
import { useDeviceStore } from '@/store/device-store';
import { useCapabilities } from '@/hooks/use-nav-routes';
import { canManageSettings } from '@/lib/capabilities';

const THEME_OPTIONS: { value: ColorSchemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

function initials(first?: string, last?: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || 'OP';
}

export default function ProfileScreen() {
  const theme = useTheme();
  const colorScheme = useAppStore((s) => s.colorScheme);
  const setColorScheme = useAppStore((s) => s.setColorScheme);
  const { operator, tenant, branch, role } = useDeviceSession();
  const signOutOperator = useDeviceStore((s) => s.signOutOperator);
  const unlinkDevice = useDeviceStore((s) => s.unlinkDevice);
  const capabilities = useCapabilities();
  const showSettings = canManageSettings(capabilities);
  const [settingsVisible, setSettingsVisible] = useState(false);

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
                {initials(operator?.employee.firstName, operator?.employee.lastName)}
              </Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text variant="subtitle">
                {operator ? `${operator.employee.firstName} ${operator.employee.lastName}` : 'Operador'}
              </Text>
              <Text variant="small" tone="secondary">
                {role?.name ?? 'Mesero'}
                {operator?.employee.employeeNumber ? ` · #${operator.employee.employeeNumber}` : ''}
              </Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text variant="eyebrow" tone="secondary" style={{ marginBottom: theme.spacing.sm }}>
            Dispositivo
          </Text>
          <View style={{ gap: 4 }}>
            <Text variant="small" tone="secondary">Empresa: <Text variant="small">{tenant?.name ?? '—'}</Text></Text>
            <Text variant="small" tone="secondary">Sucursal: <Text variant="small">{branch?.name ?? '—'}</Text></Text>
          </View>
        </Card>

        <Card>
          <Text variant="eyebrow" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
            Apariencia
          </Text>
          <SegmentedControl options={THEME_OPTIONS} value={colorScheme} onChange={setColorScheme} />
        </Card>

        {showSettings && (
          <Button label="Configuración" variant="secondary" icon="settings" fullWidth onPress={() => setSettingsVisible(true)} />
        )}
        <Button label="Cerrar turno" variant="secondary" icon="logout" fullWidth onPress={signOutOperator} />
        <Button label="Desvincular dispositivo" variant="danger" fullWidth onPress={() => void unlinkDevice()} />
      </ScrollView>

      <Modal
        visible={settingsVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <ConfiguracionPanel onClose={() => setSettingsVisible(false)} />
      </Modal>
    </Screen>
  );
}
