import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { AppProviders, useDeviceSession } from '@/providers';

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

/**
 * Device-first boot routing:
 *   unregistered          → (activation)  — scan QR / enter license key
 *   registered, no operator → (auth)      — PIN login
 *   operator signed in    → (app)         — comandera
 *
 * While booting we render nothing and keep the native splash up (DeviceProvider
 * hides it once validation resolves).
 */
function RootNavigator() {
  const { isBooting, isRegistered, hasOperator } = useDeviceSession();
  const colorScheme = useColorScheme();

  if (isBooting) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!isRegistered}>
          <Stack.Screen name="(activation)" />
        </Stack.Protected>
        <Stack.Protected guard={isRegistered && !hasOperator}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={hasOperator}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
