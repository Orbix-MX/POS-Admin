/**
 * SyncFailedSheet — bottom-sheet modal listing permanently-failed sync entries.
 *
 * Allows the user to retry or discard individual entries, or take bulk action
 * on all. Self-contained: loads data on open, calls repository directly.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { syncQueueRepository } from '@/db/repositories/sync-queue-repository';
import { refreshSyncPending } from '@/db/sync/sync-service';
import type { SyncQueueEntry, SyncOperationType } from '@/db/types';

const OP_LABEL: Record<SyncOperationType, string> = {
  CREATE_ORDER: 'Crear orden',
  UPDATE_ORDER: 'Actualizar orden',
  ADD_ITEM: 'Agregar producto',
  UPDATE_ITEM: 'Actualizar producto',
  DELETE_ITEM: 'Eliminar producto',
  REMOTE_ADD_ITEM: 'Agregar producto (sincronizado)',
  REMOTE_UPDATE_ITEM: 'Actualizar producto (sincronizado)',
  REMOTE_REMOVE_ITEM: 'Eliminar producto (sincronizado)',
  REMOTE_FIRE: 'Enviar a cocina',
};

export interface SyncFailedSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function SyncFailedSheet({ visible, onClose }: SyncFailedSheetProps) {
  const theme = useTheme();
  const [entries, setEntries] = useState<SyncQueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const loadFailed = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await syncQueueRepository.findFailed());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadFailed();
  }, [visible, loadFailed]);

  async function handleRetry(id: string) {
    setBusy(p => ({ ...p, [id]: true }));
    try {
      await syncQueueRepository.retryEntry(id);
      await refreshSyncPending();
      setEntries(prev => prev.filter(e => e.id !== id));
    } finally {
      setBusy(p => ({ ...p, [id]: false }));
    }
  }

  async function handleDiscard(id: string) {
    setBusy(p => ({ ...p, [id]: true }));
    try {
      await syncQueueRepository.discardEntry(id);
      await refreshSyncPending();
      setEntries(prev => prev.filter(e => e.id !== id));
    } finally {
      setBusy(p => ({ ...p, [id]: false }));
    }
  }

  async function handleRetryAll() {
    setLoading(true);
    try {
      await syncQueueRepository.retryAll();
      await refreshSyncPending();
      setEntries([]);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function handleDiscardAll() {
    setLoading(true);
    try {
      await syncQueueRepository.discardAll();
      await refreshSyncPending();
      setEntries([]);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const s = theme.spacing;
  const c = theme.colors;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            maxHeight: '75%',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: s.md, paddingVertical: s.sm,
              borderBottomWidth: 1, borderBottomColor: c.border,
            }}
          >
            <Text variant="bodyStrong" style={{ color: c.danger }}>
              Sincronización fallida
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text variant="body" style={{ color: c.textMuted }}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={{ padding: s.xl, alignItems: 'center' }}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : entries.length === 0 ? (
            <View style={{ padding: s.xl, alignItems: 'center' }}>
              <Text variant="body" style={{ color: c.textMuted }}>Sin operaciones fallidas</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: s.md, gap: s.sm }}>
              {entries.map(entry => (
                <View
                  key={entry.id}
                  style={{
                    backgroundColor: c.surfaceMuted,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: s.sm,
                    gap: s.xs,
                  }}
                >
                  <Text variant="bodyStrong">{OP_LABEL[entry.operationType]}</Text>
                  {entry.lastError ? (
                    <Text variant="caption" style={{ color: c.danger }} numberOfLines={2}>
                      {entry.lastError}
                    </Text>
                  ) : null}
                  <Text variant="caption" style={{ color: c.textMuted }}>
                    {entry.attempts} intento{entry.attempts !== 1 ? 's' : ''}
                    {entry.lastAttemptAt
                      ? ` · último: ${new Date(entry.lastAttemptAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: s.sm, marginTop: s.xs }}>
                    <TouchableOpacity
                      onPress={() => handleRetry(entry.id)}
                      disabled={busy[entry.id]}
                      style={{
                        flex: 1, paddingVertical: s.xs, borderRadius: theme.radius.sm,
                        backgroundColor: c.primary, alignItems: 'center',
                        opacity: busy[entry.id] ? 0.6 : 1,
                      }}
                    >
                      {busy[entry.id]
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text variant="caption" style={{ color: '#fff', fontWeight: '700' }}>Reintentar</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDiscard(entry.id)}
                      disabled={busy[entry.id]}
                      style={{
                        flex: 1, paddingVertical: s.xs, borderRadius: theme.radius.sm,
                        borderWidth: 1, borderColor: c.danger, alignItems: 'center',
                        opacity: busy[entry.id] ? 0.6 : 1,
                      }}
                    >
                      <Text variant="caption" style={{ color: c.danger, fontWeight: '700' }}>Descartar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Bulk actions */}
          {entries.length > 1 && !loading && (
            <View
              style={{
                flexDirection: 'row', gap: s.sm,
                padding: s.md, borderTopWidth: 1, borderTopColor: c.border,
              }}
            >
              <TouchableOpacity
                onPress={handleRetryAll}
                style={{
                  flex: 1, paddingVertical: s.sm, borderRadius: theme.radius.md,
                  backgroundColor: c.primary, alignItems: 'center',
                }}
              >
                <Text variant="bodyStrong" style={{ color: '#fff' }}>Reintentar todas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDiscardAll}
                style={{
                  flex: 1, paddingVertical: s.sm, borderRadius: theme.radius.md,
                  borderWidth: 1, borderColor: c.danger, alignItems: 'center',
                }}
              >
                <Text variant="bodyStrong" style={{ color: c.danger }}>Descartar todas</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
