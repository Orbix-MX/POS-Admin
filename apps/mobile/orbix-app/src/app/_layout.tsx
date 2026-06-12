import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { AppProviders, useSession } from '@/providers';

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

/**
 * Phase 3 — public vs protected route groups.
 *
 * `Stack.Protected` swaps the active group based on auth state:
 *   - authenticated → `(app)` (protected screens)
 *   - guest         → `(auth)` (login / tenant & branch selection)
 *
 * While the session is bootstrapping we render nothing and let the native
 * splash screen stay up (SessionProvider hides it once bootstrap settles).
 */
function RootNavigator() {
  const { isLoading, isAuthenticated } = useSession();
  const colorScheme = useColorScheme();

  if (isLoading) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
