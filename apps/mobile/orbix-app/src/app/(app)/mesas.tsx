import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ScrollView, View, ActivityIndicator, RefreshControl, Modal,
  Pressable, TextInput,
} from 'react-native';
import { Redirect } from 'expo-router';

import { Screen, Text, Grid, SegmentedControl, StatusBadge } from '@/components/ui';
import { AppHeader, BranchSelectorModal } from '@/components/navigation';
import { TableCard } from '@/components/domain';
import { OrderCapture, type CaptureTarget } from '@/components/restaurant/order-capture';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useBranchSelector } from '@/hooks/use-branch-selector';
import { useCapabilities } from '@/hooks/use-nav-routes';
import { hasTables, hasKitchen, hasAreas } from '@/lib/capabilities';
import {
  fetchDiningAreas, fetchTables,
} from '@/services/restaurant-service';
import type {
  DiningArea, RestaurantTable, TableStatus, ActiveOrder,
} from '@/services/restaurant-service';
import type { StatusKey } from '@/constants/theme';

const STATUS_MAP: Record<TableStatus, StatusKey> = {
  AVAILABLE: 'available',
  OCCUPIED:  'occupied',
  RESERVED:  'ready',
  BLOCKED:   'rejected',
};

const STATUS_LABEL_MAP: Record<TableStatus, string> = {
  AVAILABLE: 'Libre',
  OCCUPIED:  'Ocupada',
  RESERVED:  'Reservada',
  BLOCKED:   'Bloqueada',
};

const ALL_ZONE = { value: 'todas', label: 'Todas' };

function formatElapsed(openedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ── Table action modal ──────────────────────────────────────────────────────
interface TableModalProps {
  table: RestaurantTable | null;
  onClose: () => void;
  onOpenAccount: (table: RestaurantTable) => void;
  onViewOrder: (table: RestaurantTable) => void;
  opening: boolean;
  openError: string | null;
}

function TableModal({ table, onClose, onOpenAccount, onViewOrder, opening, openError }: TableModalProps) {
  const theme = useTheme();
  if (!table) return null;
  const activeOrder: ActiveOrder | undefined = table.diningOrders[0];
  const isAvailable = table.status === 'AVAILABLE';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: theme.radius['2xl'], borderTopRightRadius: theme.radius['2xl'], padding: theme.spacing['2xl'], gap: theme.spacing.lg }}
        >
          <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center' }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text variant="h2">{table.name}</Text>
              <Text variant="small" tone="secondary">{table.area.name} · {table.capacity} personas</Text>
            </View>
            <StatusBadge status={STATUS_MAP[table.status]} label={STATUS_LABEL_MAP[table.status]} />
          </View>

          {!isAvailable && activeOrder && (
            <View style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg, padding: theme.spacing.lg, gap: theme.spacing.sm }}>
              <Text variant="label" tone="secondary">Cuenta abierta</Text>
              <Text variant="body">{activeOrder.waiter.firstName} {activeOrder.waiter.lastName}</Text>
              <Text variant="small" tone="secondary">Abierta hace {formatElapsed(activeOrder.openedAt)}</Text>
            </View>
          )}

          {openError && <Text variant="small" tone="danger">{openError}</Text>}

          {isAvailable ? (
            <Pressable
              onPress={() => onOpenAccount(table)}
              disabled={opening}
              style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.primaryStrong : theme.colors.primary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, alignItems: 'center', opacity: opening ? 0.7 : 1 })}
            >
              {opening
                ? <ActivityIndicator color={theme.colors.onPrimary} />
                : <Text variant="body" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>Abrir cuenta</Text>
              }
            </Pressable>
          ) : (
            <Pressable
              onPress={() => onViewOrder(table)}
              style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.primaryStrong : theme.colors.primary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}
            >
              <Text variant="body" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>Ver cuenta</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Counter / no-table order modal ──────────────────────────────────────────
const REFERENCE_SUGGESTIONS = ['Mostrador', 'Para Llevar', 'Mesa Virtual'];

interface CounterModalProps {
  visible: boolean;
  reference: string;
  onChangeReference: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  opening: boolean;
  openError: string | null;
}

function CounterModal({ visible, reference, onChangeReference, onClose, onConfirm, opening, openError }: CounterModalProps) {
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
              style={{
                backgroundColor: theme.colors.surfaceMuted,
                borderRadius: theme.radius.lg,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                fontSize: 16,
                color: theme.colors.text,
              }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {REFERENCE_SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => onChangeReference(s)}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surfaceMuted,
                    borderRadius: theme.radius.full,
                    paddingHorizontal: theme.spacing.lg,
                    paddingVertical: theme.spacing.sm,
                  })}
                >
                  <Text variant="small" tone="secondary">{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {openError && <Text variant="small" tone="danger">{openError}</Text>}

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

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({ backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg, padding: theme.spacing.md, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}
          >
            <Text variant="small" tone="secondary">Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────
export default function TablesScreen() {
  const theme = useTheme();
  const { select } = useResponsive();
  const cols = select({ phone: 2, tablet: 5 });
  const { modalVisible, activeBranch, availableBranches, openSelector, closeSelector, handleSelect, canSwitch } = useBranchSelector();
  const capabilities = useCapabilities();

  const serviceMode = capabilities.serviceMode;
  const showTables  = hasTables(capabilities);
  const showCounter = serviceMode === 'HYBRID';
  const showAreas   = hasAreas(capabilities);
  const kitchenEnabled = hasKitchen(capabilities);

  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zone, setZone] = useState('todas');
  const [search, setSearch] = useState('');

  // Table modal
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  // Order capture (draft or existing). Draft orders are created lazily on the
  // first product — opening a table no longer persists an empty order.
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null);
  const [activeOrderTableName, setActiveOrderTableName] = useState<string | undefined>(undefined);

  // Counter / no-table order modal
  const [counterModalVisible, setCounterModalVisible] = useState(false);
  const [counterReference, setCounterReference] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (!activeBranch?.id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [areasData, tablesData] = await Promise.all([
        showAreas ? fetchDiningAreas(activeBranch.id) : Promise.resolve<DiningArea[]>([]),
        fetchTables(activeBranch.id),
      ]);
      setAreas(areasData.filter((a) => a.isActive));
      setTables(tablesData.filter((t) => t.isActive));
    } catch {
      setError('No se pudieron cargar las mesas.');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [activeBranch?.id, showAreas]);

  useEffect(() => { void load(); }, [load]);

  // Open a table as a DRAFT — no DiningOrder until the first product is added,
  // so the table stays AVAILABLE if the operator backs out.
  const handleOpenDineIn = useCallback((table: RestaurantTable) => {
    setSelectedTable(null);
    setActiveOrderTableName(table.name);
    setCaptureTarget({ kind: 'draft', serviceType: 'DINE_IN', tableId: table.id });
  }, []);

  const handleViewOrder = useCallback((table: RestaurantTable) => {
    const order = table.diningOrders[0];
    if (!order) return;
    setSelectedTable(null);
    setActiveOrderTableName(table.name);
    setCaptureTarget({ kind: 'existing', orderId: order.id });
  }, []);

  // Counter draft — reference captured here, order created on first product.
  const handleOpenCounter = useCallback(() => {
    const reference = counterReference.trim();
    if (!reference) return;
    setCounterModalVisible(false);
    setCounterReference('');
    setActiveOrderTableName(reference);
    setCaptureTarget({ kind: 'draft', serviceType: 'COUNTER', reference });
  }, [counterReference]);

  const handleTablePress = useCallback((table: RestaurantTable) => {
    setOpenError(null);
    setSelectedTable(table);
  }, []);

  // Draft materialized (first product) → refresh so the table flips OCCUPIED.
  const handleOrderCreated = useCallback(() => { void load(true); }, [load]);

  const closeCapture = useCallback(() => {
    setCaptureTarget(null);
    setActiveOrderTableName(undefined);
    void load(true);
  }, [load]);

  const zones = useMemo(() => [
    ALL_ZONE,
    ...areas.map((a) => ({ value: a.id, label: a.name })),
  ], [areas]);

  const filtered = useMemo(() => {
    const byZone = zone === 'todas' ? tables : tables.filter((t) => t.areaId === zone);
    const q = search.trim().toLowerCase();
    if (!q) return byZone;
    // Búsqueda local instantánea: nombre de mesa, área y mesero de la cuenta abierta.
    return byZone.filter((t) => {
      const w = t.diningOrders[0]?.waiter;
      const waiter = w ? `${w.firstName} ${w.lastName}`.toLowerCase() : '';
      return t.name.toLowerCase().includes(q)
        || t.area.name.toLowerCase().includes(q)
        || waiter.includes(q);
    });
  }, [tables, zone, search]);

  const gridData = useMemo(() =>
    filtered.map((t) => {
      const order = t.diningOrders[0];
      return {
        code: t.name,
        status: STATUS_MAP[t.status],
        statusLabel: STATUS_LABEL_MAP[t.status],
        detail: t.status === 'OCCUPIED' && order
          ? `${order.waiter.firstName} · ${formatElapsed(order.openedAt)}`
          : `${t.capacity} personas`,
        onPress: () => handleTablePress(t),
      };
    }),
    [filtered, handleTablePress]);

  const counts = useMemo(() => {
    let available = 0; let occupied = 0; let reserved = 0;
    for (const t of filtered) {
      if (t.status === 'AVAILABLE') available++;
      else if (t.status === 'OCCUPIED') occupied++;
      else if (t.status === 'RESERVED') reserved++;
    }
    return { available, occupied, reserved };
  }, [filtered]);

  // No tables for this tenant/operator → Comandas is the operational home.
  if (!showTables) return <Redirect href="/comandas" />;

  return (
    <Screen edges={[]}>
      <AppHeader
        branchName={activeBranch?.name ?? 'Sucursal'}
        searchPlaceholder="Buscar mesa o mesero"
        searchValue={search}
        onSearchChange={setSearch}
        actions={[]}
        onPressBranch={canSwitch ? openSelector : undefined}
      />

      <BranchSelectorModal
        visible={modalVisible}
        branches={availableBranches}
        activeBranchId={activeBranch?.id ?? null}
        onSelect={handleSelect}
        onClose={closeSelector}
      />

      <TableModal
        table={selectedTable}
        onClose={() => { setSelectedTable(null); setOpenError(null); }}
        onOpenAccount={handleOpenDineIn}
        onViewOrder={handleViewOrder}
        opening={false}
        openError={openError}
      />

      <CounterModal
        visible={counterModalVisible}
        reference={counterReference}
        onChangeReference={setCounterReference}
        onClose={() => { setCounterModalVisible(false); setCounterReference(''); }}
        onConfirm={handleOpenCounter}
        opening={false}
        openError={null}
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
            title={activeOrderTableName ?? 'Orden'}
            kitchenEnabled={kitchenEnabled}
            onOrderCreated={handleOrderCreated}
            onClose={closeCapture}
          />
        </Screen>
      </Modal>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
      >
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.md }}>
            <Text variant="h2">
              {serviceMode === 'COUNTER_SERVICE' ? 'Mostrador' : 'Mesas'}
            </Text>
            {showTables && (
              <Text variant="label" tone="secondary">
                {activeBranch?.name ?? ''} · {filtered.length} mesas
              </Text>
            )}
          </View>

          {showCounter && (
            <Pressable
              onPress={() => setCounterModalVisible(true)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? theme.colors.primaryStrong : theme.colors.primary,
                borderRadius: theme.radius.lg,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text variant="small" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>
                + Nueva orden
              </Text>
            </Pressable>
          )}
        </View>

        {/* Tables section */}
        {showTables && (
          loading ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.xl }} />
          ) : error ? (
            <Text variant="body" tone="danger" style={{ textAlign: 'center', marginTop: theme.spacing.xl }}>{error}</Text>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                {showAreas && zones.length > 1 && <SegmentedControl options={zones} value={zone} onChange={setZone} />}
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                  {counts.occupied > 0 && <StatusBadge status="occupied" label={`Ocupada · ${counts.occupied}`} />}
                  {counts.reserved > 0 && <StatusBadge status="ready" label={`Reservada · ${counts.reserved}`} />}
                  {counts.available > 0 && <StatusBadge status="available" label={`Libre · ${counts.available}`} />}
                </View>
              </View>

              {gridData.length === 0 ? (
                <Text variant="body" tone="secondary" style={{ textAlign: 'center', marginTop: theme.spacing.xl }}>
                  {search.trim() ? `Sin resultados para “${search.trim()}”.` : 'No hay mesas en esta área.'}
                </Text>
              ) : (
                <Grid data={gridData} columns={cols} keyExtractor={(t) => t.code} renderItem={(t) => <TableCard {...t} />} />
              )}
            </>
          )
        )}

        {/* Counter-only empty state */}
        {!showTables && (
          <Text variant="body" tone="secondary" style={{ textAlign: 'center', marginTop: theme.spacing.xl }}>
            Presiona "+ Nueva orden" para iniciar una venta en mostrador.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
