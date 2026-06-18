/**
 * NetworkIndicator — global connectivity banner.
 *
 * Reads connectivity from `useNetwork()` and surfaces it app-wide:
 *   - offline  → red    "Sin conexión a internet"
 *   - cellular → amber  "Datos móviles"
 *   - wifi     → nothing (normal online state stays out of the way)
 *
 * Detection only. No sync / queues / persistence here.
 */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { useNetwork } from '@/hooks/use-network';

export function NetworkIndicator() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { connectionType } = useNetwork();

  if (connectionType === 'wifi') return null;

  const offline = connectionType === 'offline';
  const background = offline ? theme.colors.danger : theme.colors.warning;
  const label = offline ? 'Sin conexión a internet' : 'Datos móviles';

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        paddingTop: insets.top + 4,
        paddingBottom: 6,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: background,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.onPrimary }} />
      <Text variant="small" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}
