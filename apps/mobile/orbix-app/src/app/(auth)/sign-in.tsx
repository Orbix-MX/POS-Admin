import { useState } from 'react';
import { View, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Card, Text, Icon } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useAuthStore } from '@/store/auth-store';

const BRANCHES = [
  { name: 'Sucursal Centro', detail: 'Av. Reforma 120', active: true },
  { name: 'Plaza Norte', detail: 'Local F-12' },
  { name: 'Terraza Sur', detail: 'Patio gastro' },
];

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Olvidé', '0', 'enter'];

/**
 * Login placeholder — recreates the brand panel + branch selector + PIN pad from
 * the design. Auth is NOT wired yet; the confirm key uses a clearly-marked demo
 * shortcut so the protected (app) screens can be previewed. Remove `enterDemo`
 * when the real PIN/login flow lands.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const { isTablet } = useResponsive();
  const { height } = useWindowDimensions();
  const [pinLength, setPinLength] = useState(0);

  const enterDemo = () => {
    // TEMP: preview-only session. Replace with real login (Phase: auth).
    useAuthStore.setState({ status: 'authenticated' });
  };

  const onKey = (key: string) => {
    if (key === 'enter') return enterDemo();
    if (key === 'Olvidé') return;
    setPinLength((n) => Math.min(4, n + 1));
  };

  const brandPanel = (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.primaryStrong, '#1E3A8A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flex: isTablet ? 0.42 : undefined,
        padding: theme.spacing.xl,
        borderRadius: theme.radius['2xl'],
        justifyContent: 'space-between',
        gap: theme.spacing.xl,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ width: 50, height: 50, borderRadius: theme.radius.md, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="subtitle" color="#fff">OE</Text>
        </View>
        <View>
          <Text variant="subtitle" color="#fff">Orbix</Text>
          <Text variant="small" color="rgba(255,255,255,0.8)">Comandera</Text>
        </View>
      </View>
      <View>
        <Text variant="h1" color="#fff">Tu turno empieza{'\n'}en un toque.</Text>
        <Text variant="body" color="rgba(255,255,255,0.85)" style={{ marginTop: theme.spacing.md }}>
          Captura mesas, modificadores y envíos a cocina sin fricción.
        </Text>
      </View>
    </LinearGradient>
  );

  const form = (
    <View style={{ flex: 1, gap: theme.spacing.lg }}>
      <View>
        <Text variant="eyebrow" tone="secondary">Sucursal activa</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          {BRANCHES.map((b) => (
            <View
              key={b.name}
              style={{
                flex: 1,
                borderWidth: 1.5,
                borderColor: b.active ? theme.colors.primary : theme.colors.border,
                backgroundColor: b.active ? theme.colors.primarySoft : theme.colors.card,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
              }}
            >
              <Text variant="label" tone={b.active ? 'primary' : 'default'}>{b.name}</Text>
              <Text variant="small" tone="muted" style={{ marginTop: 2 }}>{b.detail}</Text>
            </View>
          ))}
        </View>
      </View>

      <View>
        <Text variant="eyebrow" tone="secondary" style={{ marginBottom: theme.spacing.md }}>Ingresa tu PIN</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: i < pinLength ? theme.colors.primary : 'transparent',
                borderWidth: i < pinLength ? 0 : 2,
                borderColor: theme.colors.borderStrong,
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md, maxWidth: 360 }}>
          {PIN_KEYS.map((key) => {
            const isEnter = key === 'enter';
            const isText = key === 'Olvidé';
            return (
              <Pressable
                key={key}
                onPress={() => onKey(key)}
                style={{
                  width: '30%',
                  height: 60,
                  borderRadius: theme.radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isEnter ? theme.colors.primary : isText ? 'transparent' : theme.colors.card,
                  borderWidth: isText ? 0 : 1,
                  borderColor: theme.colors.border,
                  ...(isEnter ? theme.shadows.primary : null),
                }}
              >
                {isEnter ? (
                  <Icon name="arrowRight" size={24} color={theme.colors.onPrimary} />
                ) : isText ? (
                  <Text variant="label" tone="muted">{key}</Text>
                ) : (
                  <Text variant="title">{key}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: theme.spacing.xl }}>
        {isTablet ? (
          <Card elevated style={{ flex: 1, flexDirection: 'row', gap: theme.spacing.xl, maxHeight: height * 0.9 }}>
            {brandPanel}
            {form}
          </Card>
        ) : (
          <View style={{ flex: 1, gap: theme.spacing.lg }}>
            {brandPanel}
            {form}
          </View>
        )}
      </View>
    </Screen>
  );
}
