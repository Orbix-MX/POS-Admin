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
 * Architecture note: quick-action buttons (Enviar a cocina, Cobrar) are wired as
 * disabled placeholders — kitchen routing and payments land in later phases.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Pressable, ScrollView, FlatList, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';

import { Text, Icon, SearchBar } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import {
  fetchOrder, addOrderItem, updateOrderItem, removeOrderItem,
  searchProducts, fetchCategories,
} from '@/services/restaurant-service';
import type {
  DiningOrder, DiningOrderItem, ProductResult, ProductCategory,
} from '@/services/restaurant-service';

const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

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
  orderId: string | null;
  branchId: string;
  title: string;
  onClose: () => void;
}

export function OrderCapture({ visible, orderId, branchId, title, onClose }: OrderCaptureProps) {
  const theme = useTheme();
  const { isTablet } = useResponsive();

  const [order, setOrder] = useState<DiningOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const [products, setProducts] = useState<ProductResult[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [filter, setFilter] = useState<string>(FILTER_ALL);
  const [search, setSearch] = useState('');

  // Phone-only: order sheet expanded?
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const o = await fetchOrder(branchId, orderId);
      setOrder(o);
    } catch {
      // keep last known state
    }
  }, [orderId, branchId]);

  // Load order + catalog when opened.
  useEffect(() => {
    if (!visible || !orderId) return;
    let alive = true;
    setLoadingOrder(true);
    setLoadingCatalog(true);
    (async () => {
      const [o, prods, cats] = await Promise.allSettled([
        fetchOrder(branchId, orderId),
        searchProducts(),
        fetchCategories(),
      ]);
      if (!alive) return;
      if (o.status === 'fulfilled') setOrder(o.value);
      if (prods.status === 'fulfilled') setProducts(prods.value);
      if (cats.status === 'fulfilled') setCategories(cats.value);
      setLoadingOrder(false);
      setLoadingCatalog(false);
    })();
    return () => { alive = false; };
  }, [visible, orderId, branchId]);

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

  const subtotal = useMemo(
    () => (order?.items ?? []).reduce((acc, i) => acc + Number(i.unitPrice) * i.quantity, 0),
    [order],
  );
  const totalQty = useMemo(
    () => (order?.items ?? []).reduce((acc, i) => acc + i.quantity, 0),
    [order],
  );

  // ── Mutations (optimistic) ─────────────────────────────────────────────────
  const addProduct = useCallback((product: ProductResult) => {
    if (!orderId) return;
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
    addOrderItem(branchId, orderId, {
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity: 1,
    })
      .then((saved) => {
        // Reconcile server id/price onto the (at most one) row for this product.
        setOrder((prev) => prev && {
          ...prev,
          items: prev.items.map((i) =>
            i.productId === product.id
              ? { ...saved, unitPrice: Number(saved.unitPrice) }
              : i),
        });
      })
      .catch(() => void loadOrder());
  }, [orderId, branchId, loadOrder]);

  const changeQty = useCallback((item: DiningOrderItem, delta: number) => {
    if (!orderId) return;
    if (item.id.startsWith('temp-')) return; // wait for server id
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    setOrder((prev) => prev && {
      ...prev,
      items: prev.items.map((i) => i.id === item.id ? { ...i, quantity: newQty } : i),
    });
    updateOrderItem(branchId, orderId, item.id, newQty).catch(() => void loadOrder());
  }, [orderId, branchId, loadOrder]);

  const removeItem = useCallback((item: DiningOrderItem) => {
    if (!orderId) return;
    const doRemove = () => {
      setOrder((prev) => prev && { ...prev, items: prev.items.filter((i) => i.id !== item.id) });
      if (!item.id.startsWith('temp-')) {
        removeOrderItem(branchId, orderId, item.id).catch(() => void loadOrder());
      }
    };
    Alert.alert('Eliminar producto', `¿Quitar "${item.productName}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: doRemove },
    ]);
  }, [orderId, branchId, loadOrder]);

  const handleClose = useCallback(() => { onClose(); }, [onClose]);

  if (!visible || !orderId) return null;

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
      ) : (order?.items.length ?? 0) === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
          <Icon name="orders" size={32} color={theme.colors.textMuted} />
          <Text variant="body" tone="secondary" style={{ textAlign: 'center', marginTop: theme.spacing.md }}>
            Toca un producto para agregarlo a la orden.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg }} keyboardShouldPersistTaps="handled">
          {(order?.items ?? []).map(renderOrderItem)}
        </ScrollView>
      )}

      {/* Footer: subtotal + quick actions */}
      <View style={{ padding: theme.spacing.lg, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="body" tone="secondary">Subtotal</Text>
          <Text variant="h2">{formatCurrency(subtotal)}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {/* Future: kitchen routing */}
          <Pressable
            disabled
            style={{ flex: 1, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', opacity: 0.45 }}
          >
            <Text variant="label" tone="secondary">Enviar a cocina</Text>
          </Pressable>
          {/* Future: payments */}
          <Pressable
            disabled
            style={{ flex: 1, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary, alignItems: 'center', opacity: 0.45 }}
          >
            <Text variant="label" style={{ color: theme.colors.onPrimary }}>Cobrar</Text>
          </Pressable>
        </View>
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
