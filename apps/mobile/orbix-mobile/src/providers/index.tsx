/**
 * Provider composition for the app root.
 *
 * Order is load-bearing:
 *   GestureHandlerRootView → SafeArea → Query → Auth → Theme → BottomSheetModal
 *
 * Query sits above Auth because `AuthProvider` clears the cache on logout;
 * Theme sits below Auth so tenant branding can be applied from the session.
 */
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './auth-provider';
import { QueryProvider } from './query-provider';
import { TenantThemeSync } from './tenant-theme-sync';
import { ThemeProvider } from './theme-provider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          <AuthProvider>
            <ThemeProvider>
              <TenantThemeSync />
              <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export { AuthProvider } from './auth-provider';
export { QueryProvider } from './query-provider';
export { ThemeProvider, ThemeContext, type ThemeContextValue } from './theme-provider';
export { WizardProvider, useWizard } from './wizard-provider';
