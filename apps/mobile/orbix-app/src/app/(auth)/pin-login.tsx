import { useState, useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

import { Screen, Card, Text, Icon } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { useDeviceSession } from '@/hooks/use-device-session';
import { useDeviceStore } from '@/store/device-store';

const MAX_PIN = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'enter'];

/**
 * Operative PIN login. The device is already authorized; the waiter just enters
 * their PIN. No email/password. If the tenant license is not valid we block with
 * a friendly message instead of showing the keypad.
 */
export default function PinLoginScreen() {
  const theme = useTheme();
  const { tenant, branch, licenseStatus } = useDeviceSession();
  const loading = useDeviceStore((s) => s.loading);
  const error = useDeviceStore((s) => s.error);
  const pinLogin = useDeviceStore((s) => s.pinLogin);
  const clearError = useDeviceStore((s) => s.clearError);
  const unlinkDevice = useDeviceStore((s) => s.unlinkDevice);

  const [pin, setPin] = useState('');
  const licenseBlocked = licenseStatus != null && !licenseStatus.valid;

  useEffect(() => {
    if (error) setPin('');
  }, [error]);

  const submit = async (value: string) => {
    const ok = await pinLogin(value);
    if (!ok) setPin('');
  };

  const onKey = (key: string) => {
    if (loading) return;
    if (error) clearError();
    if (key === 'clear') return setPin((p) => p.slice(0, -1));
    if (key === 'enter') {
      if (pin.length >= 4) void submit(pin);
      return;
    }
    const next = (pin + key).slice(0, MAX_PIN);
    setPin(next);
    if (next.length === MAX_PIN) void submit(next);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: theme.spacing.xl, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xl }}>
        {/* Tenant / branch context */}
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Icon name="location" size={18} color={theme.colors.primary} />
          <Text variant="subtitle">{tenant?.name ?? 'Orbix Comandera'}</Text>
          {branch && <Text variant="small" tone="secondary">{branch.name}</Text>}
        </View>

        {licenseBlocked ? (
          <Card style={{ alignItems: 'center', gap: theme.spacing.md, maxWidth: 360 }} elevated>
            <Icon name="alert" size={32} color={theme.colors.danger} />
            <Text variant="bodyStrong" align="center">Licencia no vigente</Text>
            <Text variant="small" tone="secondary" align="center">
              La licencia de la empresa no está activa. Contacta al administrador para renovarla.
            </Text>
          </Card>
        ) : (
          <>
            <Text variant="caption" tone="secondary">INGRESA TU PIN</Text>

            {/* PIN dots */}
            <View style={{ flexDirection: 'row', gap: theme.spacing.md, minHeight: 18 }}>
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: i < pin.length ? theme.colors.primary : 'transparent',
                    borderWidth: i < pin.length ? 0 : 2,
                    borderColor: theme.colors.borderStrong,
                  }}
                />
              ))}
            </View>

            {error ? (
              <Text variant="small" tone="danger" align="center">{error}</Text>
            ) : (
              <View style={{ height: 18 }} />
            )}

            {/* Keypad */}
            <View style={styles.pad}>
              {KEYS.map((key) => {
                const isEnter = key === 'enter';
                const isClear = key === 'clear';
                return (
                  <Pressable
                    key={key}
                    onPress={() => onKey(key)}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.key,
                      {
                        backgroundColor: isEnter ? theme.colors.primary : isClear ? 'transparent' : theme.colors.card,
                        borderWidth: isClear ? 0 : 1,
                        borderColor: theme.colors.border,
                        opacity: pressed ? 0.85 : 1,
                        ...(isEnter ? theme.shadows.primary : null),
                      },
                    ]}
                  >
                    {isEnter ? (
                      <Icon name="arrowRight" size={24} color={theme.colors.onPrimary} />
                    ) : isClear ? (
                      <Icon name="close" size={22} color={theme.colors.textMuted} />
                    ) : (
                      <Text variant="title">{key}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Pressable onPress={() => void unlinkDevice()} hitSlop={8}>
          <Text variant="caption" tone="muted">Desvincular dispositivo</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { width: 280, flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  key: { width: 84, height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
