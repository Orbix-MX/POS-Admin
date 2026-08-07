/**
 * Connectivity, readable synchronously.
 *
 * The axios request interceptor is synchronous, so it cannot await NetInfo.
 * This module keeps the last known state in a variable that NetInfo updates in
 * the background, and mirrors it into TanStack Query's `onlineManager` so
 * queries pause and resume on their own.
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

type Listener = (online: boolean) => void;

// Optimistic default: assume online until NetInfo says otherwise, so the very
// first request on a cold start is not rejected before the subscription lands.
let online = true;
const listeners = new Set<Listener>();

function resolveOnline(state: NetInfoState): boolean {
  // `isInternetReachable` is null while probing — only a hard `false` means
  // "connected to a network that has no internet" (captive portal).
  if (state.isInternetReachable === false) return false;
  return state.isConnected !== false;
}

function update(next: boolean): void {
  if (next === online) return;
  online = next;
  for (const listener of listeners) listener(next);
}

export const networkStatus = {
  isOnline: (): boolean => online,

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Called once from the app root. Returns the NetInfo unsubscribe function. */
  start(): () => void {
    onlineManager.setEventListener((setOnline) => {
      const unsubscribe = networkStatus.subscribe(setOnline);
      setOnline(online);
      return unsubscribe;
    });

    return NetInfo.addEventListener((state) => update(resolveOnline(state)));
  },
} as const;
