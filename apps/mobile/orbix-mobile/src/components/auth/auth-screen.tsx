/**
 * Shared shell for the sign-in / sign-up / forgot-password screens.
 *
 * Minimal by design: a plain white canvas, no panel chrome (the form group sits
 * directly on the background), and a single ambient wash rising from the bottom
 * quarter of the screen. That wash is built from `theme.colors.secondary`, so it
 * re-tints on its own if the tenant theme changes — no image, no hardcoded hue.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';

/** Tablet cap; on a phone the content just fills the width. */
const CONTENT_MAX_WIDTH = 440;
/** Share of the viewport the wash occupies, measured from the bottom edge. */
const WASH_HEIGHT = '25%';

/**
 * Fades to the same hue at zero alpha rather than to `transparent`: a literal
 * `transparent` interpolates through black on Android and greys the wash out.
 */
function fadeOut(color: string): string {
  return color.length === 7 && color.startsWith('#') ? `${color}00` : color;
}

function BrandMark() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <Image
        source={require('@/assets/images/logo.png')}
        style={{ width: 34, height: 34 }}
        contentFit="contain"
        accessibilityLabel="Orbix"
      />
      <OrbixText size="xl" weight="bold" leading="tight">
        Orbix
      </OrbixText>
    </View>
  );
}

export interface AuthScreenProps {
  children: ReactNode;
  /** Rendered above the brand, aligned left (e.g. a back button). */
  leading?: ReactNode;
}

export function AuthScreen({ children, leading }: AuthScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // `card` is the pure-white surface in the light theme; in dark mode the app
  // background is the right canvas, so the screen never forces a white sheet.
  const canvas = theme.scheme === 'dark' ? theme.colors.background : theme.colors.card;
  const wash = theme.colors.secondary;

  return (
    <View style={{ flex: 1, backgroundColor: canvas }}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />

      <LinearGradient
        colors={[fadeOut(wash), wash]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: WASH_HEIGHT }}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: theme.spacing['2xl'],
            paddingTop: insets.top + theme.spacing.xl,
            paddingBottom: insets.bottom + theme.spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: '100%',
              maxWidth: CONTENT_MAX_WIDTH,
              alignSelf: 'center',
              gap: theme.spacing.xl,
            }}
          >
            {leading ? <View style={{ alignSelf: 'flex-start' }}>{leading}</View> : null}
            <BrandMark />
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
