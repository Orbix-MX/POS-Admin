/**
 * Composes all app-wide providers in dependency order. Mounted once by the root
 * layout so every screen has data, session, network and gestures available.
 */
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryProvider } from './query-provider';
import { NetworkProvider } from './network-provider';
import { SessionProvider } from './session-provider';
import { ThemeProvider } from './theme-provider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryProvider>
            <NetworkProvider>
              <SessionProvider>{children}</SessionProvider>
            </NetworkProvider>
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export { useSession } from './session-provider';
export { useNetwork } from './network-provider';
export { useTheme } from './theme-provider';
