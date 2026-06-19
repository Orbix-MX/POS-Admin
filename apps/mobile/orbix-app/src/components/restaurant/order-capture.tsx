/**
 * OrderCapture — tablet-first 3-panel order builder (Toast / Lightspeed / SoftRestaurant style).
 *
 *   ┌──────────┬─────────────────────────┬──────────────┐
 *   │ left     │ center                  │ right        │
 *   │ search   │ product grid            │ current order│
 *   │ filters  │ (favoritos · combos)    │ qty/subtotal │
 *   │ cats     │                         │ actions      │
 *   └──────────┴─────────────────────────┴──────────────┘
 *
 * Capture happens in-place: tapping a product adds it to the order on the right
 * without navigating away. The order stays visible at all times. On phones the
 * three zones collapse to: filter chips + grid + a docked order sheet.
 *
 * Order lifecycle adapts to the KITCHEN module (see Regla 2/3):
 *   kitchenEnabled  → OPEN → "Enviar a Cocina" (SENT_TO_KITCHEN) → KDS continues.
 *   !kitchenEnabled → OPEN → "Enviar a Caja" (READY_FOR_PAYMENT), ready to charge.
 * Once the order leaves OPEN it stops being a draft and items become read-only.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Pressable, ScrollView, FlatList, ActivityIndicator, Alert } from 'react-native';

import { Text, Icon, SearchBar } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useNetwork } from '@/hooks/use-network';
import { useDeviceStore } from '@/store/device-store';
import { localOrderService, refreshSyncPending } from '@/db';
import {
  fetchOrder, addOrderItem, updateOrderItem, removeOrderItem,
  searchProducts, fetchCategories, changeOrderStatus, openDiningOrder, discardOrder,
} from '@/services/restaurant-service';
import { getApiErrorMessage } from '@/services/api-client';
import type {
  DiningOrder, DiningOrderItem, ProductResult, ProductCategory, DiningOrderStatus,
} from '@/services/restaurant-service';

/**
 * How to open the capture. Either re-enter an existing order (`orderId`) or start
 * a draft that is created lazily — only on the first product or an explicit save.
 * This prevents empty orders when the operator abandons the screen.
 */
export type CaptureTarget =
  | { kind: 'existing'; orderId: string }
  | { kind: 'draft'; serviceType: 'DINE_IN'; tableId: string }
  | { kind: 'draft'; serviceType: 'COUNTER'; reference?: string };

const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

const STATUS_LABEL: Record<DiningOrderStatus, string> = {
  OPEN: 'Borrador',
  SENT_TO_KITCHEN: 'Enviada a cocina',
  IN_PREPARATION: 'En preparación',
  READY: 'Lista',
  DELIVERED: 'Entregada',
  READY_FOR_PAYMENT: 'Lista para cobro',
  PAID: 'Pagada',
  CLOSED: 'Cerrada',
  CANCELLED: 'Cancelada',
};

function formatElapsed(openedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// Pseudo-filters that sit above real categories.
const FILTER_ALL = 'all';
const FILTER_COMBOS = 'combos';

interface OrderCaptureProps {
  visible: boolean;
  target: CaptureTarget | null;
  branchId: string;
  title: string;
  kitchenEnabled: boolean;
  onClose: () => void;
  /** Fired when a draft is materialized into a real DiningOrder (first item /
   *  explicit save) so the parent can refresh tables/orders. */
  onOrderCreated?: (order: DiningOrder) => void;
}

export function OrderCapture({ visible, target, branchId, title, kitchenEnabled, onClose, onOrderCreated }: OrderCaptureProps) {
  const theme = useTheme();
  const { isTablet } = useResponsive();
  const { isConnected } = useNetwork();

  // Persisted order id. Null while a draft hasn't been created yet (workspace).
  const [orderId, setOrderId] = useState<string | null>(
    target?.kind === 'existing' ? target.orderId : null,
  );
  const [order, setOrder] = useState<DiningOrder | null>(null);
  // Draft workspace: items live only in memory until the order is confirmed
  // (Enviar a Cocina/Caja). Nothing is persisted while capturing a new order.
  const [localItems, setLocalItems] = useState<DiningOrderItem[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [sending, setSending] = useState(false);

  const [products, setProducts] = useState<ProductResult[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [filter, setFilter] = useState<string>(FILTER_ALL);
  const [search, setSearch] = useState('');

  // Phone-only: order sheet expanded?
  const [sheetOpen, setSheetOpen] = useState(false);

  // Dedupe the lazy create: many fast taps must yield a single order.
  const createInFlight = useRef<Promise<string | null> | null>(null);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const o = await fetchOrder(branchId, orderId);
      setOrder(o);
    } catch {
      // keep last known state
    }
  }, [orderId, branchId]);

  // Sync internal id when the target changes (new screen open).
  useEffect(() => {
    setOrderId(target?.kind === 'existing' ? target.orderId : null);
    setOrder(null);
    setLocalItems([]);
    createInFlight.current = null;
  }, [target]);

  /**
   * Lazily create the DiningOrder for a draft target. Returns the persisted id
   * (existing id if already created). No-op + null for an unset target.
   */
  const ensureOrder = useCallback(async (): Promise<string | null> => {
    if (orderId) return orderId;
    if (!target || target.kind !== 'draft') return null;
    if (createInFlight.current) return createInFlight.current;

    // Mesero = empleado del operator (token PIN). Se manda explícito para no
    // depender del fallback del backend y atribuir la cuenta al operador actual.
    const waiterId = useDeviceStore.getState().operator?.employee.id;
    const options = target.serviceType === 'DINE_IN'
      ? { serviceType: 'DINE_IN' as const, tableId: target.tableId, waiterId }
      : { serviceType: 'COUNTER' as const, reference: target.reference, waiterId };

    const promise = openDiningOrder(branchId, options)
      .then((created) => {
        setOrderId(created.id);
        setOrder((prev) => prev ?? created);
        onOrderCreated?.(created);
        return created.id;
      })
      .catch((e) => {
        createInFlight.current = null;
        throw e;
      });
    createInFlight.current = promise;
    return promise;
  }, [orderId, target, branchId, onOrderCreated]);

  // Load existing order + catalog when opened. Drafts skip the order fetch.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const existingId = target?.kind === 'existing' ? target.orderId : null;
    setLoadingCatalog(true);
    if (existingId) setLoadingOrder(true);
    (async () => {
      const [o, prods, cats] = await Promise.allSettled([
        existingId ? fetchOrder(branchId, existingId) : Promise.resolve(null),
        searchProducts(),
        fetchCategories(),
      ]);
      if (!alive) return;
      if (o.status === 'fulfilled' && o.value) setOrder(o.value);
      if (prods.status === 'fulfilled') setProducts(prods.value);
      if (cats.status === 'fulfilled') setCategories(cats.value);
      setLoadingOrder(false);
      setLoadingCatalog(false);
    })();
    return () => { alive = false; };
  }, [visible, target, branchId]);

  // Reset transient UI when closing.
  useEffect(() => {
    if (!visible) { setSearch(''); setFilter(FILTER_ALL); setSheetOpen(false); }
  }, [visible]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === FILTER_COMBOS && p.type !== 'COMBO') return false;
      if (filter !== FILTER_ALL && filter !== FILTER_COMBOS && p.categoryId !== filter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, filter, search]);

  // Persisted = an order already exists on the server (editing an existing order).
  // Draft = brand-new capture: items stay local until confirmed.
  const isPersisted = orderId != null;
  const items = isPersisted ? (order?.items ?? []) : localItems;

  const subtotal = useMemo(
    () => items.reduce((acc, i) => acc + Number(i.unitPrice) * i.quantity, 0),
    [items],
  );
  const totalQty = useMemo(
    () => items.reduce((acc, i) => acc + i.quantity, 0),
    [items],
  );

  const status: DiningOrderStatus = order?.status ?? 'OPEN';
  const isDraft = status === 'OPEN';

  // ── Mutations ──────────────────────────────────────────────────────────────
  // Draft mode mutates only local state (no network). Editing a persisted order
  // keeps the optimistic server sync.
  const addProduct = useCallback((product: ProductResult) => {
    if (!isDraft) return;

    // New capture → accumulate locally; persisted on Enviar a Cocina/Caja.
    if (!isPersisted) {
      setLocalItems((prev) => {
        const existing = prev.find((i) => i.productId === product.id);
        if (existing) {
          return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
        }
        return [...prev, {
          id: `local-${product.id}`,
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: 1,
          notes: null,
          createdAt: new Date().toISOString(),
        }];
      });
      return;
    }

    // Editing an existing order → optimistic add + persist.
    setOrder((prev) => {
      if (!prev) return prev;
      const existing = prev.items.find((i) => i.productId === product.id);
      if (existing) {
        return { ...prev, items: prev.items.map((i) => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i) };
      }
      const temp: DiningOrderItem = {
        id: `temp-${product.id}`,
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: 1,
        notes: null,
        createdAt: new Date().toISOString(),
      };
      return { ...prev, items: [...prev.items, temp] };
    });
    addOrderItem(branchId, orderId!, {
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity: 1,
    })
      .then((saved) => {
        setOrder((prev) => prev && {
          ...prev,
          items: prev.items.map((i) =>
            i.productId === product.id
              ? { ...saved, unitPrice: Number(saved.unitPrice) }
              : i),
        });
      })
      .catch(() => void loadOrder());
  }, [isPersisted, orderId, branchId, loadOrder, isDraft]);

  const changeQty = useCallback((item: DiningOrderItem, delta: number) => {
    if (!isDraft) return;
    const newQty = item.quantity + delta;
    if (newQty < 1) return;

    if (!isPersisted) {
      setLocalItems((prev) => prev.map((i) => i.id === item.id ? { ...i, quantity: newQty } : i));
      return;
    }

    if (item.id.startsWith('temp-')) return; // wait for server id
    setOrder((prev) => prev && {
      ...prev,
      items: prev.items.map((i) => i.id === item.id ? { ...i, quantity: newQty } : i),
    });
    updateOrderItem(branchId, orderId!, item.id, newQty).catch(() => void loadOrder());
  }, [isPersisted, orderId, branchId, loadOrder, isDraft]);

  const removeItem = useCallback((item: DiningOrderItem) => {
    if (!isDraft) return;
    const doRemove = () => {
      if (!isPersisted) {
        setLocalItems((prev) => prev.filter((i) => i.id !== item.id));
        return;
      }
      setOrder((prev) => prev && { ...prev, items: prev.items.filter((i) => i.id !== item.id) });
      if (!item.id.startsWith('temp-')) {
        removeOrderItem(branchId, orderId!, item.id).catch(() => void loadOrder());
      }
    };
    Alert.alert('Eliminar producto', `¿Quitar "${item.productName}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: doRemove },
    ]);
  }, [isPersisted, orderId, branchId, loadOrder, isDraft]);

  // Confirm the capture. This is the ONLY point a new order is persisted: create
  // the DiningOrder, save its items, then advance to the kitchen/checkout state.
  // Editing an existing order just advances the status (items already saved).
  const sendOrder = useCallback(() => {
    if (totalQty === 0) {
      Alert.alert('Orden vacía', 'Agrega al menos un producto antes de continuar.');
      return;
    }
    const next: DiningOrderStatus = kitchenEnabled ? 'SENT_TO_KITCHEN' : 'READY_FOR_PAYMENT';
    const successTitle = kitchenEnabled ? 'Enviada a cocina' : 'Lista para cobro';
    const successBody = kitchenEnabled
      ? 'La comanda fue enviada a la cocina.'
      : 'La orden quedó disponible para cobro en caja.';

    setSending(true);
    (async () => {
      try {
        // ── Offline: persist a new order locally + queue it (same UX) ──────────
        if (!isConnected && !orderId && target?.kind === 'draft') {
          const created = await localOrderService.createOrder({
            branchId,
            serviceType: target.serviceType,
            tableId: target.serviceType === 'DINE_IN' ? target.tableId : null,
            reference: target.serviceType === 'COUNTER' ? (target.reference ?? null) : null,
            status: next,
            subtotal,
          });
          for (const it of localItems) {
            await localOrderService.addItem({
              orderId: created.id,
              productId: it.productId,
              productName: it.productName,
              unitPrice: Number(it.unitPrice),
              quantity: it.quantity,
              notes: it.notes,
            });
          }
          // Queue the final status AFTER the items so the sync worker advances
          // the backend order (Cocina/Caja) once items are pushed.
          await localOrderService.updateOrder(created.id, { status: next });
          await refreshSyncPending(); // reflect new pending ops in the status badge
          Alert.alert(successTitle, `${successBody}\n\nSe guardó sin conexión y se sincronizará al reconectar.`, [
            { text: 'OK', onPress: onClose },
          ]);
          return;
        }

        // ── Online: materialize the draft on confirm (creates order + occupies table) ──
        let id = orderId;
        if (!id) {
          id = await ensureOrder();
          if (!id) throw new Error('No se pudo crear la orden.');
          for (const it of localItems) {
            await addOrderItem(branchId, id, {
              productId: it.productId ?? undefined,
              productName: it.productName,
              unitPrice: Number(it.unitPrice),
              quantity: it.quantity,
              notes: it.notes ?? undefined,
            });
          }
        }
        const updated = await changeOrderStatus(branchId, id, next);
        setOrder((prev) => prev && { ...prev, status: updated.status });
        Alert.alert(successTitle, successBody, [{ text: 'OK', onPress: onClose }]);
      } catch (e) {
        Alert.alert('No se pudo continuar', getApiErrorMessage(e, 'Intenta de nuevo.'));
      } finally {
        setSending(false);
      }
    })();
  }, [totalQty, isConnected, target, subtotal, orderId, ensureOrder, localItems, branchId, kitchenEnabled, onClose]);

  // Discard guard. A new capture is never persisted, so abandoning keeps nothing.
  // For an existing order left empty, delete it server-side (frees table).
  const handleClose = useCallback(() => {
    // Editing a persisted order that still has items → just close (already saved).
    if (isPersisted && totalQty > 0) { onClose(); return; }

    const body = totalQty > 0
      ? 'Los productos capturados no se han guardado y se perderán.'
      : 'No has agregado productos. La orden no se guardará.';
    Alert.alert('¿Descartar captura actual?', body, [
      { text: 'Continuar editando', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () => {
          // Only an existing persisted order needs server cleanup.
          if (isPersisted && orderId) void discardOrder(branchId, orderId).catch(() => {});
          onClose();
        },
      },
    ]);
  }, [isPersisted, totalQty, orderId, branchId, onClose]);

  if (!visible || !target) return null;

  // ── Filter rail data ────────────────────────────────────────────────────────
  const filters: { key: string; label: string; icon?: 'star' | 'orders' }[] = [
    { key: FILTER_ALL, label: 'Todos' },
    { key: FILTER_COMBOS, label: 'Combos', icon: 'orders' },
    ...categories.map((c) => ({ key: c.id, label: c.name })),
  ];

  // ── Shared sub-renders ──────────────────────────────────────────────────────
  const renderFilterButton = (f: { key: string; label: string }, horizontal: boolean) => {
    const active = filter === f.key;
    return (
      <Pressable
        key={f.key}
        onPress={() => setFilter(f.key)}
        style={({ pressed }) => ({
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.md,
          marginBottom: horizontal ? 0 : theme.spacing.xs,
          marginRight: horizontal ? theme.spacing.sm : 0,
          backgroundColor: active ? theme.colors.primary : theme.colors.surfaceMuted,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text
          variant="label"
          numberOfLines={1}
          style={{ color: active ? theme.colors.onPrimary : theme.colors.textSecondary }}
        >
          {f.label}
        </Text>
      </Pressable>
    );
  };

  const productCols = isTablet ? 3 : 2;
  const renderProductGrid = () => (
    loadingCatalog ? (
      <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.xl }} />
    ) : (
      <FlatList
        key={`grid-${productCols}`}
        data={filteredProducts}
        keyExtractor={(p) => p.id}
        numColumns={productCols}
        columnWrapperStyle={{ gap: theme.spacing.md }}
        contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text variant="body" tone="secondary" style={{ textAlign: 'center', marginTop: theme.spacing.xl }}>
            Sin productos.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => addProduct(item)}
            style={({ pressed }) => ({
              flex: 1 / productCols,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.md,
              minHeight: 84,
              justifyContent: 'space-between',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text variant="label" numberOfLines={2} style={{ flex: 1, minHeight: 34 }}>
                {item.name}
              </Text>
              {item.type === 'COMBO' && (
                <View style={{ backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text variant="caption" style={{ color: theme.colors.primary }}>combo</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm }}>
              <Text variant="mono" tone="success">{formatCurrency(item.price)}</Text>
              <View style={{ width: 30, height: 30, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="plus" size={18} color={theme.colors.primary} />
              </View>
            </View>
          </Pressable>
        )}
      />
    )
  );

  const renderOrderItem = (item: DiningOrderItem) => {
    const lineTotal = Number(item.unitPrice) * item.quantity;
    const atMin = item.quantity <= 1;
    const pending = item.id.startsWith('temp-');
    return (
      <View
        key={item.id}
        style={{
          paddingVertical: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          gap: theme.spacing.sm,
          opacity: pending ? 0.6 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
          <Text variant="label" style={{ flex: 1 }} numberOfLines={2}>{item.productName}</Text>
          <Text variant="bodyStrong">{formatCurrency(lineTotal)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="small" tone="secondary">{formatCurrency(Number(item.unitPrice))} c/u</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Pressable onPress={() => removeItem(item)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: theme.spacing.xs })}>
              <Icon name="trash" size={16} color={theme.colors.danger} />
            </Pressable>
            <Pressable
              onPress={() => changeQty(item, -1)}
              disabled={atMin || pending}
              hitSlop={6}
              style={({ pressed }) => ({ width: 34, height: 34, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', opacity: (atMin || pending) ? 0.35 : pressed ? 0.6 : 1 })}
            >
              <Icon name="minus" size={16} color={theme.colors.text} />
            </Pressable>
            <Text variant="body" style={{ minWidth: 22, textAlign: 'center', fontWeight: '700' }}>{item.quantity}</Text>
            <Pressable
              onPress={() => changeQty(item, 1)}
              disabled={pending}
              hitSlop={6}
              style={({ pressed }) => ({ width: 34, height: 34, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', opacity: pending ? 0.35 : pressed ? 0.6 : 1 })}
            >
              <Icon name="plus" size={16} color={theme.colors.text} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  const renderOrderPanel = (showHeader: boolean) => (
    <View style={{ flex: 1 }}>
      {showHeader && (
        <View style={{ padding: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="title">{title}</Text>
            <View style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.md, paddingVertical: 2 }}>
              <Text variant="small" tone="secondary">{totalQty} art.</Text>
            </View>
          </View>
          {order && (
            <Text variant="small" tone="secondary" style={{ marginTop: 2 }}>
              {order.waiter.firstName} {order.waiter.lastName} · {formatElapsed(order.openedAt)}
            </Text>
          )}
        </View>
      )}

      {loadingOrder && !order ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.xl }} />
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
          <Icon name="orders" size={32} color={theme.colors.textMuted} />
          <Text variant="body" tone="secondary" style={{ textAlign: 'center', marginTop: theme.spacing.md }}>
            Toca un producto para agregarlo a la orden.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg }} keyboardShouldPersistTaps="handled">
          {items.map(renderOrderItem)}
        </ScrollView>
      )}

      {/* Footer: subtotal + quick actions */}
      <View style={{ padding: theme.spacing.lg, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="body" tone="secondary">Subtotal</Text>
          <Text variant="h2">{formatCurrency(subtotal)}</Text>
        </View>
        {isDraft ? (
          // Regla 2/3: action depends on whether the kitchen module is enabled.
          <Pressable
            onPress={sendOrder}
            disabled={sending || totalQty === 0}
            style={({ pressed }) => ({
              paddingVertical: theme.spacing.lg,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              opacity: (sending || totalQty === 0) ? 0.45 : pressed ? 0.85 : 1,
            })}
          >
            {sending
              ? <ActivityIndicator color={theme.colors.onPrimary} />
              : <Text variant="bodyStrong" style={{ color: theme.colors.onPrimary }}>{kitchenEnabled ? 'Enviar a Cocina' : 'Enviar a Caja'}</Text>
            }
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted }}>
            <Icon name="orders" size={16} color={theme.colors.textSecondary} />
            <Text variant="label" tone="secondary">{STATUS_LABEL[status]}</Text>
          </View>
        )}
      </View>
    </View>
  );

  // ── Tablet: 3 panels ────────────────────────────────────────────────────────
  if (isTablet) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.colors.canvas }}>
        {/* Left: search + filters */}
        <View style={{ width: 210, borderRightWidth: 1, borderRightColor: theme.colors.border, backgroundColor: theme.colors.card }}>
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            <Pressable onPress={handleClose} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Icon name="chevronRight" size={18} color={theme.colors.textSecondary} />
              <Text variant="small" tone="secondary">Mesas</Text>
            </Pressable>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar producto" />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl }}>
            {filters.map((f) => renderFilterButton(f, false))}
          </ScrollView>
        </View>

        {/* Center: products */}
        <View style={{ flex: 1 }}>{renderProductGrid()}</View>

        {/* Right: order */}
        <View style={{ width: 320, borderLeftWidth: 1, borderLeftColor: theme.colors.border, backgroundColor: theme.colors.card }}>
          {renderOrderPanel(true)}
        </View>
      </View>
    );
  }

  // ── Phone: chips + grid + docked order sheet ────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      {/* Top bar */}
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={handleClose} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Icon name="chevronRight" size={18} color={theme.colors.textSecondary} />
            <Text variant="title">{title}</Text>
          </Pressable>
        </View>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar producto" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row' }}>
            {filters.map((f) => renderFilterButton(f, true))}
          </View>
        </ScrollView>
      </View>

      {/* Grid */}
      <View style={{ flex: 1 }}>{renderProductGrid()}</View>

      {/* Docked order summary bar */}
      <Pressable
        onPress={() => setSheetOpen((s) => !s)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg, backgroundColor: theme.colors.primary }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Icon name={sheetOpen ? 'chevronDown' : 'orders'} size={18} color={theme.colors.onPrimary} />
          <Text variant="label" style={{ color: theme.colors.onPrimary }}>{totalQty} art.</Text>
        </View>
        <Text variant="bodyStrong" style={{ color: theme.colors.onPrimary }}>{formatCurrency(subtotal)}</Text>
      </Pressable>

      {/* Expandable order sheet */}
      {sheetOpen && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSheetOpen(false)} />
          <View style={{ height: '70%', backgroundColor: theme.colors.card, borderTopLeftRadius: theme.radius['2xl'], borderTopRightRadius: theme.radius['2xl'], overflow: 'hidden' }}>
            <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center', marginTop: theme.spacing.sm }} />
            {renderOrderPanel(true)}
          </View>
        </View>
      )}
    </View>
  );
}
