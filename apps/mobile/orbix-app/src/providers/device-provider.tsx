/**
 * DeviceProvider — owns the device-session lifecycle. Bootstraps the device
 * validation once on mount and keeps the native splash up until the boot phase
 * is resolved. Session state is read from the device store via useDeviceStore /
 * useDeviceSession; this provider is just the lifecycle owner.
 */
import { useEffect, useRef, type PropsWithChildren } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { useDeviceStore } from '@/store/device-store';

void SplashScreen.preventAutoHideAsync();

export function DeviceProvider({ children }: PropsWithChildren) {
  const bootstrapped = useRef(false);
  const phase = useDeviceStore((s) => s.phase);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void useDeviceStore.getState().bootstrap();
  }, []);

  useEffect(() => {
    if (phase !== 'booting') void SplashScreen.hideAsync();
  }, [phase]);

  return <>{children}</>;
}
