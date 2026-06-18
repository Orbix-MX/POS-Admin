import { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';

import { Screen, Text, Button, Icon } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { useDeviceStore } from '@/store/device-store';

/**
 * QR scanner for device activation. Accepts the Orbix enrollment payload
 * `{ type:'orbix-enroll', token }` (token → activationToken) or a bare license
 * key string. On success the store flips to `locked` and the root re-routes.
 */
export default function QrScanScreen() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const activateWithToken = useDeviceStore((s) => s.activateWithToken);
  const activateWithLicenseKey = useDeviceStore((s) => s.activateWithLicenseKey);
  const error = useDeviceStore((s) => s.error);
  const handled = useRef(false);
  const [working, setWorking] = useState(false);

  async function onScan(result: BarcodeScanningResult) {
    if (handled.current) return;
    handled.current = true;
    setWorking(true);

    const raw = result.data?.trim() ?? '';
    let ok = false;
    try {
      const parsed = JSON.parse(raw) as { type?: string; token?: string };
      if (parsed?.token) ok = await activateWithToken(parsed.token);
      else ok = await activateWithLicenseKey(raw);
    } catch {
      // not JSON → treat the payload as a license key
      ok = await activateWithLicenseKey(raw);
    }

    setWorking(false);
    if (!ok) handled.current = false; // allow retry on failure
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: theme.spacing.xl, gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Button label="" variant="ghost" icon="close" onPress={() => router.back()} />
          <Text variant="h2">Escanear código</Text>
        </View>

        {!permission ? (
          <Text variant="body" tone="secondary">Solicitando permiso de cámara…</Text>
        ) : !permission.granted ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg }}>
            <Icon name="alert" size={36} color={theme.colors.textMuted} />
            <Text variant="body" tone="secondary" align="center">
              Necesitamos acceso a la cámara para escanear el código de activación.
            </Text>
            <Button label="Permitir cámara" onPress={() => void requestPermission()} />
          </View>
        ) : (
          <View style={{ flex: 1, gap: theme.spacing.lg }}>
            <View style={{ flex: 1, borderRadius: theme.radius['2xl'], overflow: 'hidden', backgroundColor: '#000' }}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={working ? undefined : onScan}
              />
              {/* simple framing guide */}
              <View pointerEvents="none" style={styles.frame}>
                <View style={[styles.corner, { borderColor: theme.colors.onPrimary, top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 }]} />
                <View style={[styles.corner, { borderColor: theme.colors.onPrimary, top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 }]} />
                <View style={[styles.corner, { borderColor: theme.colors.onPrimary, bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 }]} />
                <View style={[styles.corner, { borderColor: theme.colors.onPrimary, bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 }]} />
              </View>
            </View>
            <Text variant="small" tone="secondary" align="center">
              {working ? 'Activando…' : 'Apunta la cámara al código QR generado en Orbix.'}
            </Text>
            {error && <Text variant="small" tone="danger" align="center">{error}</Text>}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 220,
    height: 220,
    marginTop: -110,
    marginLeft: -110,
  },
  corner: { position: 'absolute', width: 36, height: 36, borderWidth: 3, borderRadius: 4 },
});
