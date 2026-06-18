/**
 * Observable sync state for the UI. Fed by the sync worker (processSyncQueue)
 * and pending-count refreshes. Screens read it via `useSyncStatus()`.
 *
 * Raw signals only — the display state (offline/pending/syncing/synced/error) is
 * derived in the hook by combining these with connectivity.
 */
import { create } from 'zustand';

interface SyncStoreState {
  /** Worker currently draining the queue. */
  isSyncing: boolean;
  /** Local operations still awaiting a push. */
  pendingCount: number;
  /** Last sync error message, cleared on a successful run. */
  lastError: string | null;

  setSyncing: (value: boolean) => void;
  setPending: (count: number) => void;
  setError: (message: string | null) => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  isSyncing: false,
  pendingCount: 0,
  lastError: null,

  setSyncing: (isSyncing) => set({ isSyncing }),
  setPending: (pendingCount) => set({ pendingCount }),
  setError: (lastError) => set({ lastError }),
}));
