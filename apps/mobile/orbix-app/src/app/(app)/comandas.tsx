/**
 * Comandas — new-order hub. Behavior adapts to the tenant service mode:
 *
 *   COUNTER_SERVICE (sin mesas)  → "Nueva orden" captures a manual reference
 *     (Mostrador / Para Llevar / Cliente Juan) and opens a counter DiningOrder,
 *     then drops into OrderCapture with the kitchen/no-kitchen rules.
 *
 *   TABLE_SERVICE / HYBRID (con mesas) → "Nueva cuenta" will open an account by
 *     picking an available table. SCAFFOLD ONLY — the table picker is rendered
 *     but creation is intentionally not wired yet (see handlePickTable).
 *
 * Both modes list active orders so staff can re-enter an open account.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, View, ActivityIndicator, RefreshControl, Modal, Pressable, TextInput } from 'react-native';

import { Screen, Text, Grid, StatusBadge } from '@/components/ui';
import { AppHeader, BranchSelectorModal } from '@/components/navigation';
import { SyncStatusBadge } from '@/components/feedback';
import { TableCard } from '@/components/domain';
import { OrderCapture, type CaptureTarget } from '@/components/restaurant/order-capture';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useBranchSelector } from '@/hooks/use-branch-selector';
import { useCapabilities } from '@/hooks/use-nav-routes';
import { hasTables, hasKitchen } from '@/lib/capabilities';
import { fetchActiveOrders, fetchTables } from '@/services/restaurant-service';
import type { DiningOrder, RestaurantTable } from '@/services/restaurant-service';

const REFERENCE_SUGGESTIONS = ['Mostrador', 'Para Llevar', 'Mesa Virtual'];

const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

function formatElapsed(openedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function orderSubtotal(o: DiningOrder): number {
  return o.items.reduce((acc, i) => acc + Number(i.unitPrice) * i.quantity, 0);
}

// ── Manual-reference capture (counter / no-table flow) ───────────────────────
interface ReferenceModalProps {
  visible: boolean;
  reference: string;
  onChangeReference: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  opening: boolean;
  error: string | null;
}

function ReferenceModal({ visible, reference, onChangeReference, onClose, onConfirm, opening, error }: ReferenceModalProps) {
  const theme = useTheme();
  const canConfirm = reference.trim().length > 0 && !opening;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: theme.radius['2xl'], borderTopRightRadius: theme.radius['2xl'], padding: theme.spacing['2xl'], gap: theme.spacing.lg }}
        >
          <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center' }} />
          <View>
            <Text variant="h2">Nueva orden</Text>
            <Text variant="small" tone="secondary" style={{ marginTop: theme.spacing.xs }}>
              Asigna una referencia para identificar la cuenta (mostrador, para llevar, nombre del cliente).
            </Text>
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="secondary">Referencia</Text>
            <TextInput
              value={reference}
              onChangeText={onChangeReference}
              placeholder="Ej. Mostrador, Cliente Juan"
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => { if (canConfirm) onConfirm(); }}
              style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, fontSize: 16, color: theme.colors.text }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {REFERENCE_SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => onChangeReference(s)}
                  style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surfaceMuted, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm })}
                >
                  <Text variant="small" tone="secondary">{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {error && <Text variant="small" tone="danger">{error}</Text>}
          <Pressable
            onPress={onConfirm}
            disabled={!canConfirm}
            style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.primaryStrong : theme.colors.primary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, alignItems: 'center', opacity: canConfirm ? 1 : 0.5 })}
          >
            {opening
              ? <ActivityIndicator color={theme.colors.onPrimary} />
              : <Text variant="body" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>Abrir orden</Text>
            }
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Table picker (table service) — SCAFFOLD: selection not wired yet ──────────
interface TablePickerModalProps {
  visible: boolean;
  tables: RestaurantTable[];
  onClose: () => void;
  onPick: (table: RestaurantTable) => void;
}

function TablePickerModal({ visible, tables, onClose, onPick }: TablePickerModalProps) {
  const theme = useTheme();
  const { select } = useResponsive();
  const cols = select({ phone: 3, tablet: 5 });
  const available = tables.filter((t) => t.isActive && t.status === 'AVAILABLE');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: theme.radius['2xl'], borderTopRightRadius: theme.radius['2xl'], padding: theme.spacing['2xl'], gap: theme.spacing.lg, maxHeight: '75%' }}
        >
          <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center' }} />
          <Text variant="h2">Nueva cuenta</Text>
          <Text variant="small" tone="secondary">Selecciona una mesa disponible.</Text>
          {available.length === 0 ? (
            <Text variant="body" tone="secondary" style={{ textAlign: 'center', paddingVertical: theme.spacing.xl }}>
              No hay mesas disponibles.
            </Text>
          ) : (
            <ScrollView>
              <Grid
                data={available.map((t) => ({
                  code: t.name,
                  status: 'available' as const,
                  statusLabel: 'Libre',
                  detail: `${t.capacity} personas`,
                  onPress: () => onPick(t),
                }))}
                columns={cols}
                keyExtractor={(t) => t.code}
                renderItem={(t) => <TableCard {...t} />}
              />
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Active order card ────────────────────────────────────────────────────────
function ActiveOrderCard({ order, onPress }: { order: DiningOrder; onPress: () => void }) {
  const theme = useTheme();
  const count = order.items.reduce((acc, i) => acc + i.quantity, 0);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.lg,
        gap: theme.spacing.sm,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
          {order.reference ?? order.table?.name ?? 'Orden'}
        </Text>
        <Text variant="mono" tone="success">{formatCurrency(orderSubtotal(order))}</Text>
      </View>
      <Text variant="small" tone="secondary">
        {order.waiter.firstName} {order.waiter.lastName} · {count} art. · {formatElapsed(order.openedAt)}
      </Text>
    </Pressable>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function ComandasScreen() {
  const theme = useTheme();
  const { modalVisible, activeBranch, availableBranches, openSelector, closeSelector, handleSelect, canSwitch } = useBranchSelector();
  const capabilities = useCapabilities();

  // No tables (counter-only, or no tables module/permission) → manual reference
  // flow; tables present → open the account from a table picker.
  const tablesEnabled = hasTables(capabilities);
  const kitchenEnabled = hasKitchen(capabilities);
  const counterOnly = !tablesEnabled;

  const [orders, setOrders] = useState<DiningOrder[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Order capture (draft or existing) — drafts persist only on the first product.
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | undefined>(undefined);

  // Reference modal (counter flow)
  const [refModalVisible, setRefModalVisible] = useState(false);
  const [reference, setReference] = useState('');

  // Table picker (table flow)
  const [pickerVisible, setPickerVisible] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!activeBranch?.id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [ordersData, tablesData] = await Promise.all([
        fetchActiveOrders(activeBranch.id),
        counterOnly ? Promise.resolve<RestaurantTable[]>([]) : fetchTables(activeBranch.id),
      ]);
      setOrders(ordersData);
      setTables(tablesData);
    } catch {
      setError('No se pudieron cargar las comandas.');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [activeBranch?.id, counterOnly]);

  useEffect(() => { void load(); }, [load]);

  // Counter flow: capture reference → open a DRAFT (created on first product).
  const handleOpenCounter = useCallback(() => {
    const ref = reference.trim();
    if (!ref) return;
    setRefModalVisible(false);
    setReference('');
    setActiveTitle(ref);
    setCaptureTarget({ kind: 'draft', serviceType: 'COUNTER', reference: ref });
  }, [reference]);

  // Table flow: pick a table → open a DRAFT. The table stays AVAILABLE until the
  // first product materializes the order.
  const handlePickTable = useCallback((table: RestaurantTable) => {
    setPickerVisible(false);
    setActiveTitle(table.name);
    setCaptureTarget({ kind: 'draft', serviceType: 'DINE_IN', tableId: table.id });
  }, []);

  const handleOpenExisting = useCallback((order: DiningOrder) => {
    setActiveTitle(order.reference ?? order.table?.name ?? 'Orden');
    setCaptureTarget({ kind: 'existing', orderId: order.id });
  }, []);

  const onPressNew = useCallback(() => {
    setError(null);
    if (counterOnly) setRefModalVisible(true);
    else setPickerVisible(true);
  }, [counterOnly]);

  const closeCapture = useCallback(() => {
    setCaptureTarget(null);
    setActiveTitle(undefined);
    void load(true);
  }, [load]);

  const sorted = useMemo(
    () => [...orders].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()),
    [orders],
  );

  return (
    <Screen edges={[]}>
      <AppHeader
        branchName={activeBranch?.name ?? 'Sucursal'}
        searchPlaceholder="Buscar comanda"
        onPressBranch={canSwitch ? openSelector : undefined}
      />

      <BranchSelectorModal
        visible={modalVisible}
        branches={availableBranches}
        activeBranchId={activeBranch?.id ?? null}
        onSelect={handleSelect}
        onClose={closeSelector}
      />

      <ReferenceModal
        visible={refModalVisible}
        reference={reference}
        onChangeReference={setReference}
        onClose={() => { setRefModalVisible(false); setReference(''); }}
        onConfirm={handleOpenCounter}
        opening={false}
        error={null}
      />

      <TablePickerModal
        visible={pickerVisible}
        tables={tables}
        onClose={() => setPickerVisible(false)}
        onPick={handlePickTable}
      />

      <Modal
        visible={!!captureTarget}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeCapture}
      >
        <Screen edges={['top']}>
          <OrderCapture
            visible={!!captureTarget}
            target={captureTarget}
            branchId={activeBranch?.id ?? ''}
            title={activeTitle ?? 'Orden'}
            kitchenEnabled={kitchenEnabled}
            onOrderCreated={() => void load(true)}
            onClose={closeCapture}
          />
        </Screen>
      </Modal>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
            <Text variant="h2">Comandas</Text>
            <Text variant="label" tone="secondary">{sorted.length} abiertas</Text>
            <SyncStatusBadge />
          </View>
          <Pressable
            onPress={onPressNew}
            style={({ pressed }) => ({
              backgroundColor: pressed ? theme.colors.primaryStrong : theme.colors.primary,
              borderRadius: theme.radius.lg,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text variant="small" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>
              {counterOnly ? '+ Nueva orden' : '+ Nueva cuenta'}
            </Text>
          </Pressable>
        </View>

        {error && (
          <View style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg, padding: theme.spacing.lg }}>
            <Text variant="small" tone="secondary">{error}</Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.xl }} />
        ) : sorted.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: theme.spacing['3xl'], gap: theme.spacing.sm }}>
            <StatusBadge status="available" label="Sin comandas abiertas" />
            <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
              {counterOnly
                ? 'Toca "+ Nueva orden" para capturar una venta con referencia.'
                : 'Toca "+ Nueva cuenta" para abrir una cuenta por mesa.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {sorted.map((o) => (
              <ActiveOrderCard
                key={o.id}
                order={o}
                onPress={() => handleOpenExisting(o)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
