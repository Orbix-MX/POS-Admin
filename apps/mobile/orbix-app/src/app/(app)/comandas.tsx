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

import { Screen, Text, Grid, StatusBadge, Icon, type IconName } from '@/components/ui';
import { AppHeader, BranchSelectorModal } from '@/components/navigation';
import { TableCard } from '@/components/domain';
import { OrderCapture, type CaptureTarget } from '@/components/restaurant/order-capture';
import { CheckoutModal } from '@/components/restaurant/checkout-modal';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useBranchSelector } from '@/hooks/use-branch-selector';
import { useCapabilities } from '@/hooks/use-nav-routes';
import { hasTables, hasKitchen, isHybrid } from '@/lib/capabilities';
import { fetchActiveOrders, fetchTables } from '@/services/restaurant-service';
import type { DiningOrder, DiningOrderStatus, RestaurantTable } from '@/services/restaurant-service';

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

function elapsedMinutes(openedAt: string): number {
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
}

// Critical-time coloring: <30m normal, 30–60m amber, 60m+ red.
function elapsedTone(theme: ReturnType<typeof useTheme>, mins: number): string {
  if (mins >= 60) return theme.colors.danger;
  if (mins >= 30) return theme.colors.warning;
  return theme.colors.textSecondary;
}

// ── Order type (Mesa / Mostrador / Para Llevar / Pickup) ─────────────────────
// Backend only distinguishes DINE_IN vs COUNTER; the counter sub-type is derived
// from the manual reference text captured when the order was opened.
type OrderType = { label: string; icon: IconName };

function orderType(o: DiningOrder): OrderType {
  if (o.serviceType === 'DINE_IN' || o.tableId) return { label: 'Mesa', icon: 'tables' };
  const ref = (o.reference ?? '').toLowerCase();
  if (ref.includes('llevar')) return { label: 'Para Llevar', icon: 'bag' };
  if (ref.includes('pickup') || ref.includes('recoger')) return { label: 'Pickup', icon: 'package' };
  return { label: 'Mostrador', icon: 'home' };
}

// ── Work-queue status: one glanceable badge per order ────────────────────────
// Operational states with fixed colors (consistent across light/dark):
//   Pendiente → amarillo · En Cocina → azul · Lista → verde ·
//   Entregada → gris · Pendiente Sync → naranja.
type WorkStatus = 'PENDING' | 'IN_KITCHEN' | 'READY' | 'DELIVERED' | 'CANCELLED' | 'PENDING_SYNC';

const WORK_META: Record<WorkStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: '#F59E0B' }, // amarillo
  IN_KITCHEN: { label: 'En Cocina', color: '#2563EB' }, // azul
  READY: { label: 'Lista', color: '#16A34A' }, // verde
  DELIVERED: { label: 'Entregada', color: '#64748B' }, // gris
  CANCELLED: { label: 'Cancelada', color: '#DC2626' }, // rojo
  PENDING_SYNC: { label: 'Pendiente Sync', color: '#EA580C' }, // naranja
};

function serverStatusToWork(status: DiningOrderStatus): WorkStatus {
  switch (status) {
    case 'OPEN': return 'PENDING';
    case 'SENT_TO_KITCHEN':
    case 'IN_PREPARATION': return 'IN_KITCHEN';
    case 'READY':
    case 'READY_FOR_PAYMENT': return 'READY';
    case 'DELIVERED':
    case 'PAID':
    case 'CLOSED': return 'DELIVERED';
    case 'CANCELLED': return 'CANCELLED';
    default: return 'PENDING';
  }
}

// An order's effective work status — unsynced local orders trump server state.
function workStatusOf(o: DiningOrder): WorkStatus {
  if (o.pendingSync) return 'PENDING_SYNC';
  return serverStatusToWork(o.status);
}

function WorkBadge({ status }: { status: WorkStatus }) {
  const theme = useTheme();
  const { label, color } = WORK_META[status];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: color + '1A',
        borderWidth: 1,
        borderColor: color + '33',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: 5,
        borderRadius: theme.radius.full,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text variant="caption" style={{ color, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

// ── Manual-reference capture (counter / no-table flow) ───────────────────────
interface ReferenceModalProps {
  visible: boolean;
  reference: string;
  onChangeReference: (v: string) => void;
  customer: string;
  onChangeCustomer: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  opening: boolean;
  error: string | null;
}

function ReferenceModal({ visible, reference, onChangeReference, customer, onChangeCustomer, onClose, onConfirm, opening, error }: ReferenceModalProps) {
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
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="secondary">Cliente (opcional)</Text>
            <TextInput
              value={customer}
              onChangeText={onChangeCustomer}
              placeholder="Ej. Juan Pérez"
              placeholderTextColor={theme.colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={() => { if (canConfirm) onConfirm(); }}
              style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, fontSize: 16, color: theme.colors.text }}
            />
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

// ── Top summary stat ─────────────────────────────────────────────────────────
function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color + '14',
        borderWidth: 1,
        borderColor: color + '2E',
        borderRadius: theme.radius.lg,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        gap: 2,
      }}
    >
      <Text variant="h2" style={{ color }}>{value}</Text>
      <Text variant="caption" tone="secondary">{label}</Text>
    </View>
  );
}

// ── New-order option sheet (table service / hybrid) ──────────────────────────
interface NewOrderOption {
  key: string;
  label: string;
  hint: string;
  icon: IconName;
  onPress: () => void;
}

function NewOrderSheet({ visible, options, onClose }: { visible: boolean; options: NewOrderOption[]; onClose: () => void }) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: theme.radius['2xl'], borderTopRightRadius: theme.radius['2xl'], padding: theme.spacing['2xl'], gap: theme.spacing.lg }}
        >
          <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center' }} />
          <Text variant="h2">Nueva Comanda</Text>
          <View style={{ gap: theme.spacing.md }}>
            {options.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={opt.onPress}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.lg,
                  backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.lg,
                })}
              >
                <View style={{ width: 44, height: 44, borderRadius: theme.radius.md, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={opt.icon} size={20} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{opt.label}</Text>
                  <Text variant="small" tone="secondary">{opt.hint}</Text>
                </View>
                <Icon name="chevronRight" size={18} color={theme.colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Active order card ────────────────────────────────────────────────────────
const PAYABLE: DiningOrderStatus[] = ['DELIVERED', 'READY_FOR_PAYMENT'];

function ActiveOrderCard({ order, onPress, onCheckout }: { order: DiningOrder; onPress: () => void; onCheckout: () => void }) {
  const theme = useTheme();
  const count = order.items.reduce((acc, i) => acc + i.quantity, 0);
  const type = orderType(order);
  const work = workStatusOf(order);
  const mins = elapsedMinutes(order.openedAt);
  const timeColor = elapsedTone(theme, mins);
  const title = order.reference ?? order.table?.name ?? type.label;
  const payable = PAYABLE.includes(order.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* Row 1: type icon + reference + total */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={type.icon} size={16} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{title}</Text>
          <Text variant="caption" tone="secondary">
            {type.label} · {order.waiter.firstName} {order.waiter.lastName}
          </Text>
        </View>
        <Text variant="mono" tone="success">{formatCurrency(orderSubtotal(order))}</Text>
      </View>

      {/* Row 2: status badge + item count + elapsed (color-coded) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <WorkBadge status={work} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Text variant="small" tone="secondary">{count} art.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="clock" size={13} color={timeColor} />
            <Text variant="small" style={{ color: timeColor, fontWeight: mins >= 30 ? '700' : '400' }}>
              {formatElapsed(order.openedAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Row 3: charge action for accounts awaiting payment */}
      {payable && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); onCheckout(); }}
          style={({ pressed }) => ({
            backgroundColor: pressed ? theme.colors.primaryStrong : theme.colors.primary,
            borderRadius: theme.radius.md,
            paddingVertical: theme.spacing.sm,
            alignItems: 'center',
          })}
        >
          <Text variant="small" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>
            Cobrar {formatCurrency(orderSubtotal(order))}
          </Text>
        </Pressable>
      )}
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
  const hybrid = isHybrid(capabilities);

  const [orders, setOrders] = useState<DiningOrder[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Order capture (draft or existing) — drafts persist only on the first product.
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | undefined>(undefined);

  // Reference modal (counter / manual flow)
  const [refModalVisible, setRefModalVisible] = useState(false);
  const [reference, setReference] = useState('');
  const [customer, setCustomer] = useState('');

  // Table picker (table flow)
  const [pickerVisible, setPickerVisible] = useState(false);

  // New-order option sheet (table service / hybrid)
  const [sheetVisible, setSheetVisible] = useState(false);

  // Checkout modal (charge an account awaiting payment)
  const [checkoutOrder, setCheckoutOrder] = useState<DiningOrder | null>(null);

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

  // Open a counter DRAFT directly (created on first product) — zero extra taps.
  const startCounterDraft = useCallback((ref: string) => {
    setActiveTitle(ref);
    setCaptureTarget({ kind: 'draft', serviceType: 'COUNTER', reference: ref });
  }, []);

  // Reference modal confirm: fold optional customer into the reference text
  // (single backend field) and open the draft.
  const handleOpenCounter = useCallback(() => {
    const ref = reference.trim();
    if (!ref) return;
    const cust = customer.trim();
    const finalRef = cust ? `${ref} · ${cust}` : ref;
    setRefModalVisible(false);
    setReference('');
    setCustomer('');
    startCounterDraft(finalRef);
  }, [reference, customer, startCounterDraft]);

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

  // New-order entry point — adapts to the tenant operation model:
  //   counter-only → straight to the reference modal (no intermediate screen).
  //   table/hybrid → an option sheet (Mesa / Captura Manual, or Mesa / Mostrador
  //   / Para Llevar) so the waiter starts in ≤2 taps.
  const onPressNew = useCallback(() => {
    setError(null);
    if (counterOnly) setRefModalVisible(true);
    else setSheetVisible(true);
  }, [counterOnly]);

  // Option-sheet choices, derived from the service mode.
  const newOrderOptions = useMemo<NewOrderOption[]>(() => {
    const pickMesa: NewOrderOption = {
      key: 'mesa', label: 'Seleccionar Mesa', hint: 'Abrir cuenta por mesa', icon: 'tables',
      onPress: () => { setSheetVisible(false); setPickerVisible(true); },
    };
    if (hybrid) {
      return [
        { ...pickMesa, label: 'Mesa', hint: 'Servicio en mesa' },
        {
          key: 'mostrador', label: 'Mostrador', hint: 'Venta en barra', icon: 'home',
          onPress: () => { setSheetVisible(false); startCounterDraft('Mostrador'); },
        },
        {
          key: 'llevar', label: 'Para Llevar', hint: 'Orden para llevar', icon: 'bag',
          onPress: () => { setSheetVisible(false); startCounterDraft('Para Llevar'); },
        },
      ];
    }
    return [
      pickMesa,
      {
        key: 'manual', label: 'Captura Manual', hint: 'Referencia / cliente', icon: 'bag',
        onPress: () => { setSheetVisible(false); setRefModalVisible(true); },
      },
    ];
  }, [hybrid, startCounterDraft]);

  const closeCapture = useCallback(() => {
    setCaptureTarget(null);
    setActiveTitle(undefined);
    void load(true);
  }, [load]);

  const sorted = useMemo(
    () => [...orders].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()),
    [orders],
  );

  // Top summary — how many orders sit in each operational stage right now.
  const summary = useMemo(() => {
    const acc = { PENDING: 0, IN_KITCHEN: 0, READY: 0 };
    for (const o of orders) {
      const w = workStatusOf(o);
      if (w === 'PENDING' || w === 'PENDING_SYNC') acc.PENDING += 1;
      else if (w === 'IN_KITCHEN') acc.IN_KITCHEN += 1;
      else if (w === 'READY') acc.READY += 1;
    }
    return acc;
  }, [orders]);

  return (
    <Screen edges={[]}>
      <AppHeader
        dense
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

      <NewOrderSheet
        visible={sheetVisible}
        options={newOrderOptions}
        onClose={() => setSheetVisible(false)}
      />

      <ReferenceModal
        visible={refModalVisible}
        reference={reference}
        onChangeReference={setReference}
        customer={customer}
        onChangeCustomer={setCustomer}
        onClose={() => { setRefModalVisible(false); setReference(''); setCustomer(''); }}
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

      <CheckoutModal
        visible={!!checkoutOrder}
        order={checkoutOrder}
        branchId={activeBranch?.id ?? ''}
        onClose={() => setCheckoutOrder(null)}
        onPaid={() => { setCheckoutOrder(null); void load(true); }}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: theme.spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="h2">Comandas ({sorted.length})</Text>
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

        {sorted.length > 0 && (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <SummaryStat label="Pendientes" value={summary.PENDING} color={WORK_META.PENDING.color} />
            <SummaryStat label="En Cocina" value={summary.IN_KITCHEN} color={WORK_META.IN_KITCHEN.color} />
            <SummaryStat label="Listas" value={summary.READY} color={WORK_META.READY.color} />
          </View>
        )}

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
                onCheckout={() => setCheckoutOrder(o)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
