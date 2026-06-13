import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';

import { AppProviders, useDeviceSession } from '@/providers';
import { useResponsive } from '@/hooks/use-responsive';

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

function RootNavigator() {
  const { isBooting, isRegistered, hasOperator } = useDeviceSession();
  const colorScheme = useColorScheme();
  const { isTablet } = useResponsive();

  useEffect(() => {
    if (Platform.OS !== 'android' || !isTablet) return;
    NavigationBar.setVisibilityAsync('hidden');
    NavigationBar.setBehaviorAsync('inset-swipe');
  }, [isTablet]);

  if (isBooting) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar hidden={isTablet} style="auto" />
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
