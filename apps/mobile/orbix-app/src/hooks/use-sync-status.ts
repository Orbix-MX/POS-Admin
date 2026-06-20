/**
 * Derives the single sync status the UI shows, combining connectivity with the
 * observable sync store.
 *
 * Priority: offline → syncing → error → pending → synced.
 */
import { useShallow } from 'zustand/react/shallow';
import { useNetwork } from '@/hooks/use-network';
import { useSyncStore } from '@/store/sync-store';

export type SyncStatus = 'offline' | 'pending' | 'syncing' | 'synced' | 'error';

export interface SyncStatusInfo {
  status: SyncStatus;
  label: string;
  /** Number of operations still pending (0 when synced). */
  pendingCount: number;
  /** Number of operations that permanently failed and need user action. */
  failedCount: number;
}

const LABELS: Record<SyncStatus, string> = {
  offline: 'Sin conexión',
  pending: 'Pendiente sincronizar',
  syncing: 'Sincronizando…',
  synced: 'Sincronizado',
  error: 'Error de sincronización',
};

export function useSyncStatus(): SyncStatusInfo {
  const { connectionType } = useNetwork();
  const { isSyncing, pendingCount, failedCount, lastError } = useSyncStore(
    useShallow((s) => ({
      isSyncing: s.isSyncing,
      pendingCount: s.pendingCount,
      failedCount: s.failedCount,
      lastError: s.lastError,
    })),
  );

  let status: SyncStatus;
  if (connectionType === 'offline') status = 'offline';
  else if (isSyncing) status = 'syncing';
  else if (lastError) status = 'error';
  else if (pendingCount > 0) status = 'pending';
  else status = 'synced';

  return { status, label: LABELS[status], pendingCount, failedCount };
}
