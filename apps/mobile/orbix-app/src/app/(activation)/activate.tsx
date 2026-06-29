import { useState } from 'react';
import { View, TextInput, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Card, Text, Button, Icon } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { useDeviceStore } from '@/store/device-store';

/**
 * Device activation entry. Two paths: scan an enrollment QR, or type the license
 * key manually. On success the device store flips to `locked` and the root
 * navigator routes to the PIN screen automatically.
 */
export default function ActivateScreen() {
  const theme = useTheme();
  const [licenseKey, setLicenseKey] = useState('');
  const loading = useDeviceStore((s) => s.loading);
  const error = useDeviceStore((s) => s.error);
  const activateWithLicenseKey = useDeviceStore((s) => s.activateWithLicenseKey);
  const clearError = useDeviceStore((s) => s.clearError);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: theme.spacing.xl, justifyContent: 'center', gap: theme.spacing.xl }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryStrong]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 64, height: 64, borderRadius: theme.radius.lg, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variant="title" color={theme.colors.onPrimary}>OE</Text>
          </LinearGradient>
          <Text variant="h2" align="center">Activar dispositivo</Text>
          <Text variant="body" tone="secondary" align="center">
            Vincula esta comandera a tu empresa para comenzar.
          </Text>
        </View>

        {error && (
          <Card style={{ borderColor: theme.colors.danger, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Icon name="alert" size={18} color={theme.colors.danger} />
            <Text variant="small" tone="danger" style={{ flex: 1 }}>{error}</Text>
          </Card>
        )}

        <Button
          label="Escanear código QR"
          icon="search"
          size="lg"
          fullWidth
          onPress={() => { clearError(); router.push('/qr-scan'); }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
          <Text variant="caption" tone="muted">o ingresa la licencia</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <TextInput
            value={licenseKey}
            onChangeText={(t) => setLicenseKey(t.toUpperCase())}
            placeholder="ORBX-XXXX-XXXX-XXXX-XXXX"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.lg,
              height: 52,
              fontFamily: theme.fontFamily.mono,
              fontSize: 15,
              color: theme.colors.text,
              textAlign: 'center',
            }}
          />
          <Button
            label="Activar con licencia"
            variant="secondary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={licenseKey.trim().length < 8}
            onPress={() => void activateWithLicenseKey(licenseKey.trim())}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
