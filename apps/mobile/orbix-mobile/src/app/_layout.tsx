/**
 * Root layout: fonts, providers, and the auth-driven route guard.
 *
 * The native splash is held until DM Sans has loaded, so the app never renders
 * a frame in the system font — with a type-led design that flash is very visible.
 */
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, DMSans_800ExtraBold, useFonts } from '@expo-google-fonts/dm-sans';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect } from 'react';
import { Platform, View } from 'react-native';

import '@/styles/global.css';
import '@/i18n';

import { OrbixToast } from '@/components';
import { AppProviders } from '@/providers';

import { RouteGuard } from './route-guard';

// Keep the native splash up; `onLayoutRootView` hides it once we can paint.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  });

  // A font that fails to download must not brick the app — fall through to the
  // system font rather than hanging on the splash forever.
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Immersive mode, phone and tablet alike: the nav bar re-appears on an edge
  // swipe (`overlay-swipe`) rather than staying gone permanently, which is
  // what stops Android from treating this as a hard lockout of its own UI.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void NavigationBar.setVisibilityAsync('hidden');
    void NavigationBar.setBehaviorAsync('overlay-swipe');
  }, []);

  const onLayoutRootView = useCallback(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AppProviders>
        <RouteGuard>
          <Stack
            screenOptions={{
              headerShown: false,
              // Matches the design's horizontal step transitions.
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          >
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
          </Stack>
        </RouteGuard>
        <OrbixToast />
      </AppProviders>
    </View>
  );
}
