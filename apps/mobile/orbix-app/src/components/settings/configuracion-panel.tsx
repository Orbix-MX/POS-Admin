/**
 * ConfiguracionPanel — entry menu for tenant-level settings reachable from the
 * app (currently just Panel de Permisos; add new rows here as they land).
 */
import { useState } from 'react';
import { View, Pressable, Modal } from 'react-native';

import { Screen, Text, Icon, type IconName } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { PermisosPanel } from './permisos-panel';

interface ConfiguracionPanelProps {
  onClose: () => void;
}

interface MenuItem {
  key: string;
  label: string;
  hint: string;
  icon: IconName;
  onPress: () => void;
}

export function ConfiguracionPanel({ onClose }: ConfiguracionPanelProps) {
  const theme = useTheme();
  const [permisosVisible, setPermisosVisible] = useState(false);

  const items: MenuItem[] = [
    {
      key: 'permisos',
      label: 'Panel de Permisos',
      hint: 'Decisiones de negocio individuales (comandas, ventas…)',
      icon: 'settings',
      onPress: () => setPermisosVisible(true),
    },
  ];

  return (
    <Screen edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card }}>
        <Pressable onPress={onClose} hitSlop={8}>
          <Icon name="chevronRight" size={20} color={theme.colors.textSecondary} />
        </Pressable>
        <Text variant="title">Configuración</Text>
      </View>

      <View style={{ padding: theme.spacing.xl, gap: theme.spacing.md }}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.lg,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ width: 44, height: 44, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={item.icon} size={20} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{item.label}</Text>
              <Text variant="small" tone="secondary">{item.hint}</Text>
            </View>
            <Icon name="chevronRight" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <Modal
        visible={permisosVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPermisosVisible(false)}
      >
        <Screen edges={['top']}>
          <PermisosPanel onClose={() => setPermisosVisible(false)} />
        </Screen>
      </Modal>
    </Screen>
  );
}
