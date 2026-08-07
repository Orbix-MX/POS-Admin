/**
 * Splash screen.
 *
 * The animated counterpart of the prototype's first frame: drifting radial
 * blobs, the pulsing Orbix mark, and a 1.9 s loading bar. It stays mounted
 * until `RouteGuard` decides where to go, so a slow `GET /auth/me` reads as an
 * intentional brand moment rather than a stall.
 */
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedProgressBar, OrbixScaffold, OrbixText } from '@/components';
import { useTheme } from '@/hooks/use-theme';

export default function SplashRoute() {
  const theme = useTheme();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    // `@keyframes orbixPulse`: scale 1 → 1.06 → 1 over 2.2 s, forever.
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [pulse, reduceMotion]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  return (
    <OrbixScaffold background="splash" statusBarStyle="light">
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.xl,
        }}
      >
        <Animated.View style={markStyle}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={{ width: 92, height: 92 }}
            contentFit="contain"
            accessibilityLabel="Orbix"
          />
        </Animated.View>

        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <OrbixText size="3xl" weight="extrabold" tone="onDark" leading="tight">
            Orbix
          </OrbixText>
          <OrbixText size="base" tone="onDarkMuted">
            {t('splash.tagline')}
          </OrbixText>
        </View>

        <View style={{ marginTop: theme.spacing.sm }}>
          <AnimatedProgressBar />
        </View>
      </View>
    </OrbixScaffold>
  );
}
