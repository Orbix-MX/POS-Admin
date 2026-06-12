/**
 * Phase 10 — Network foundation.
 *
 * Detects connectivity with `@react-native-community/netinfo`, exposes it via
 * `useNetwork()`, mirrors it into the app store, and wires TanStack Query's
 * `onlineManager` so queries pause while offline.
 *
 * This only *detects* connectivity — offline queueing / sync is intentionally
 * out of scope for now (future work).
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

import { useAppStore } from '@/store/app-store';

export interface NetworkContextValue {
  /** Connected to a network AND (when known) the internet is reachable. */
  isOnline: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  isInternetReachable: null,
  type: 'unknown',
});

export function NetworkProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<NetworkContextValue>({
    isOnline: true,
    isInternetReachable: null,
    type: 'unknown',
  });

  useEffect(() => {
    // Bridge NetInfo → TanStack Query so it knows when to pause/resume.
    // setEventListener returns void; onlineManager owns the subscription's cleanup.
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((s) => {
        setOnline(!!s.isConnected && s.isInternetReachable !== false);
      }),
    );

    // Separate subscription that feeds the context + app store.
    const unsubscribe = NetInfo.addEventListener((s) => {
      const isOnline = !!s.isConnected && s.isInternetReachable !== false;
      setState({
        isOnline,
        isInternetReachable: s.isInternetReachable,
        type: s.type,
      });
      useAppStore.getState().setOnline(isOnline);
    });

    return unsubscribe;
  }, []);

  return <NetworkContext.Provider value={state}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext);
}
