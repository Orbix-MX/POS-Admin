/**
 * SyncManager — drains the local SyncQueue based on connectivity.
 *
 *   - wifi     → sync automatically.
 *   - cellular → never sync without authorization. If there are pending ops and
 *                the user hasn't authorized cellular sync, prompt:
 *                "Se detectó conexión móvil. ¿Deseas sincronizar?"
 *                Sincronizar → sync + remember the choice. Esperar → skip.
 *   - offline  → nothing.
 *
 * Requires a signed-in operator (backend calls carry auth). Renders nothing.
 */
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useNetwork } from '@/hooks/use-network';
import { useDeviceSession } from '@/hooks/use-device-session';
import { processSyncQueue, refreshSyncPending, syncQueueRepository } from '@/db';
import { getCellularSyncAllowed, setCellularSyncAllowed } from '@/services/sync-preference';

export function SyncManager() {
  const { connectionType } = useNetwork();
  const { hasOperator } = useDeviceSession();

  const [cellularAllowed, setCellularAllowed] = useState(false);
  // Ask at most once per cellular session (reset when leaving cellular).
  const promptedRef = useRef(false);

  // Load the persisted cellular preference + initial pending count once.
  useEffect(() => {
    getCellularSyncAllowed().then(setCellularAllowed).catch(() => {});
    void refreshSyncPending();
  }, []);

  // Allow the prompt to reappear after the connection changes class.
  useEffect(() => {
    if (connectionType !== 'cellular') promptedRef.current = false;
  }, [connectionType]);

  useEffect(() => {
    if (!hasOperator) return;

    if (connectionType === 'wifi') {
      void processSyncQueue();
      return;
    }

    if (connectionType === 'cellular') {
      void (async () => {
        const pending = await syncQueueRepository.pendingCount();
        if (pending === 0) return;

        // Previously authorized → sync silently.
        if (cellularAllowed) { void processSyncQueue(); return; }

        if (promptedRef.current) return;
        promptedRef.current = true;
        Alert.alert(
          'Se detectó conexión móvil',
          '¿Deseas sincronizar las órdenes pendientes usando datos móviles?',
          [
            { text: 'Esperar', style: 'cancel' },
            {
              text: 'Sincronizar',
              onPress: () => {
                // Remember the authorization for future cellular reconnects.
                void setCellularSyncAllowed(true);
                setCellularAllowed(true);
                void processSyncQueue();
              },
            },
          ],
        );
      })();
    }
  }, [connectionType, hasOperator, cellularAllowed]);

  return null;
}
