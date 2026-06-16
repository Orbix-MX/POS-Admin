import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';

import { AppProviders, useDeviceSession } from '@/providers';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { NetworkIndicator } from '@/components/feedback';
import { initDatabase } from '@/db';

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

function RootNavigator() {
  const { isBooting, isRegistered, hasOperator } = useDeviceSession();
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const { isTablet } = useResponsive();

  // Open + migrate the local SQLite database once at startup.
  useEffect(() => { void initDatabase(); }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (isTablet) {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('inset-swipe');
      return;
    }
    // Phone: keep the nav bar visible but match its buttons to the theme —
    // dark buttons on light theme, light buttons on dark theme.
    NavigationBar.setVisibilityAsync('visible');
    NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
  }, [isTablet, isDark]);

  if (isBooting) return null;

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      {/* Light theme → dark icons/text; dark theme → light. Follows the user's
          persisted preference, not just the OS scheme. */}
      <StatusBar hidden={isTablet} style={isDark ? 'light' : 'dark'} />
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
      {/* Global connectivity banner — overlays every screen. */}
      <NetworkIndicator />
    </ThemeProvider>
  );
}
