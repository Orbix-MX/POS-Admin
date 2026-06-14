/**
 * Composes all app-wide providers in dependency order. Mounted once by the root
 * layout so every screen has data, session, network and gestures available.
 */
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryProvider } from './query-provider';
import { NetworkProvider } from './network-provider';
import { DeviceProvider } from './device-provider';
import { ThemeProvider } from './theme-provider';
import { SyncManager } from './sync-provider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryProvider>
            <NetworkProvider>
              <DeviceProvider>
                <SyncManager />
                {children}
              </DeviceProvider>
            </NetworkProvider>
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export { useDeviceSession, useDeviceSession as useSession } from '@/hooks/use-device-session';
export { useNetwork } from './network-provider';
export { useTheme } from './theme-provider';
