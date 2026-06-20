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
import { View, Pressable, ScrollView, FlatList, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';

import { Text, Icon, SearchBar, Stepper } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useNetwork } from '@/hooks/use-network';
import { useDeviceStore } from '@/store/device-store';
import { localOrderService, refreshSyncPending, newId } from '@/db';
import {
  fetchOrder, addOrderItem, updateOrderItem, removeOrderItem,
  searchProducts, fetchCategories, changeOrderStatus, fireRound, openDiningOrder, discardOrder,
} from '@/services/restaurant-service';
import { getApiErrorMessage } from '@/services/api-client';
import { CheckoutModal } from '@/components/restaurant/checkout-modal';
import type {
  DiningOrder, DiningOrderItem, ProductResult, ProductCategory, DiningOrderStatus,
} from '@/services/restaurant-service';

// Estados desde los que una cuenta puede cobrarse (igual que el backend).
const PAYABLE_STATUSES: DiningOrderStatus[] = ['READY_FOR_PAYMENT', 'DELIVERED'];

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

// Normaliza el ítem del backend (unitPrice llega como Decimal/string).
function normalizeItem(saved: DiningOrderItem): DiningOrderItem {
  return { ...saved, unitPrice: Number(saved.unitPrice) };
}

/**
 * Reemplaza/inserta un ítem confirmado por el servidor dentro de la lista,
 * descartando opcionalmente la línea optimista temporal (`dropId`). Si el id ya
 * existe (p. ej. el backend fusionó por producto+nota), lo reemplaza en lugar de
 * duplicarlo. Reconciliación por-ítem: no recarga toda la orden.
 */
function upsertItem(items: DiningOrderItem[], saved: DiningOrderItem, dropId?: string): DiningOrderItem[] {
  const base = dropId ? items.filter((i) => i.id !== dropId) : items;
  return base.some((i) => i.id === saved.id)
    ? base.map((i) => (i.id === saved.id ? saved : i))
    : [...base, saved];
}

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

// Atajos de nota frecuentes para capturar modificadores en un toque.
const NOTE_SUGGESTIONS = ['Sin cebolla', 'Sin hielo', 'Extra queso', 'Término medio', 'Poco picante', 'Para llevar'];

/**
 * ItemConfigSheet — hoja inferior para configurar una línea: cantidad + nota.
 * Se abre al MANTENER PRESIONADO un producto (alta con config) o al TOCAR una
 * línea existente (edición). El tap normal sobre el producto agrega rápido.
 */
interface ItemConfigSheetProps {
  visible: boolean;
  title: string;
  initialQuantity: number;
  initialNote: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (quantity: number, note: string) => void;
}

function ItemConfigSheet({ visible, title, initialQuantity, initialNote, confirmLabel, onCancel, onConfirm }: ItemConfigSheetProps) {
  const theme = useTheme();
  const [qty, setQty] = useState(initialQuantity);
  const [note, setNote] = useState(initialNote);

  // Re-seed when (re)opened for a new target.
  useEffect(() => {
    if (visible) { setQty(initialQuantity); setNote(initialNote); }
  }, [visible, initialQuantity, initialNote]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={onCancel}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: theme.radius['2xl'], borderTopRightRadius: theme.radius['2xl'], padding: theme.spacing['2xl'], gap: theme.spacing.lg }}
        >
          <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center' }} />

          <Text variant="h2" numberOfLines={2}>{title}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="label" tone="secondary">Cantidad</Text>
            <Stepper value={qty} onChange={setQty} min={1} size="lg" />
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="secondary">Nota / modificador</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Ej. sin cebolla, término medio"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, fontSize: 16, color: theme.colors.text, minHeight: 48 }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {NOTE_SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setNote((prev) => prev.trim() ? `${prev.trim()}, ${s}` : s)}
                  style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surfaceMuted, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm })}
                >
                  <Text variant="small" tone="secondary">{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            onPress={() => onConfirm(qty, note)}
            style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.primaryStrong : theme.colors.primary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, alignItems: 'center' })}
          >
            <Text variant="body" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>{confirmLabel}</Text>
          </Pressable>
          <Pressable onPress={onCancel} style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}>
            <Text variant="small" tone="secondary">Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

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
  // Cobro de una cuenta ya pagable (READY_FOR_PAYMENT/DELIVERED).
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  // Configuración de línea (cantidad + nota). 'add' desde mantener presionado un
  // producto; 'edit' al tocar una línea de la orden.
  const [configTarget, setConfigTarget] = useState<
    | { mode: 'add'; product: ProductResult }
    | { mode: 'edit'; item: DiningOrderItem }
    | null
  >(null);

  const [products, setProducts] = useState<ProductResult[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  // Paginación server-side del catálogo (infinite scroll).
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  // Ignora respuestas obsoletas cuando el usuario teclea/cambia filtro rápido.
  const catalogReqId = useRef(0);

  const [filter, setFilter] = useState<string>(FILTER_ALL);
  const [search, setSearch] = useState('');

  // Phone-only: order sheet expanded?
  const [sheetOpen, setSheetOpen] = useState(false);

  // Dedupe the lazy create: many fast taps must yield a single order.
  const createInFlight = useRef<Promise<string | null> | null>(null);

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

  // Load existing order + categories when opened. Products load separately
  // (server-side, debounced). Drafts skip the order fetch.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const existingId = target?.kind === 'existing' ? target.orderId : null;
    if (existingId) setLoadingOrder(true);
    (async () => {
      const [o, cats] = await Promise.allSettled([
        existingId ? fetchOrder(branchId, existingId) : Promise.resolve(null),
        fetchCategories(),
      ]);
      if (!alive) return;
      if (o.status === 'fulfilled' && o.value) setOrder(o.value);
      if (cats.status === 'fulfilled') setCategories(cats.value);
      setLoadingOrder(false);
    })();
    return () => { alive = false; };
  }, [visible, target, branchId]);

  // Reset transient UI when closing.
  useEffect(() => {
    if (!visible) { setSearch(''); setFilter(FILTER_ALL); setSheetOpen(false); }
  }, [visible]);

  // Build the server query from the active filter (category id or COMBO type).
  const buildQuery = useCallback((pageNum: number) => ({
    page: pageNum,
    limit: 30,
    search: search.trim() || undefined,
    ...(filter === FILTER_COMBOS ? { type: 'COMBO' as const }
      : filter !== FILTER_ALL ? { categoryId: filter } : {}),
  }), [search, filter]);

  // Fetch page 1 (replace) — server-side search/filter. Guarded against stale
  // responses so fast typing always reflects the latest query.
  const loadFirstPage = useCallback(async () => {
    const reqId = ++catalogReqId.current;
    setLoadingCatalog(true);
    try {
      const res = await searchProducts(buildQuery(1));
      if (reqId !== catalogReqId.current) return; // a newer query superseded this
      setProducts(res.products);
      setPage(res.page);
      setHasMore(res.page < res.totalPages);
    } catch {
      if (reqId === catalogReqId.current) { setProducts([]); setHasMore(false); }
    } finally {
      if (reqId === catalogReqId.current) setLoadingCatalog(false);
    }
  }, [buildQuery]);

  // Append the next page (infinite scroll).
  const loadMore = useCallback(async () => {
    if (loadingMore || loadingCatalog || !hasMore) return;
    const reqId = catalogReqId.current; // tied to the current query
    setLoadingMore(true);
    try {
      const res = await searchProducts(buildQuery(page + 1));
      if (reqId !== catalogReqId.current) return; // query changed mid-fetch
      setProducts((prev) => [...prev, ...res.products]);
      setPage(res.page);
      setHasMore(res.page < res.totalPages);
    } catch {
      // keep what we have; user can retry by scrolling
    } finally {
      if (reqId === catalogReqId.current) setLoadingMore(false);
    }
  }, [loadingMore, loadingCatalog, hasMore, page, buildQuery]);

  // Debounced re-query on open / search / filter change. 250 ms keeps typing
  // fluid on mid-range Android without hammering the API.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => { void loadFirstPage(); }, 250);
    return () => clearTimeout(t);
  }, [visible, search, filter, loadFirstPage]);

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
  // Editable mientras la cuenta no esté cerrada (permite rondas sobre cuentas
  // ya enviadas a cocina). Solo PAID/CANCELLED bloquean.
  const isEditable = status !== 'PAID' && status !== 'CANCELLED';
  const isPayable = PAYABLE_STATUSES.includes(status);
  // Cocina terminó (READY): el mesero puede marcarla lista para cobro.
  const isReady = status === 'READY';
  // Hay productos pendientes de enviar (ronda en captura).
  const hasPending = items.some((i) => !i.sentToKitchenAt);
  const isPending = (i: DiningOrderItem) => !i.sentToKitchenAt;

  // ── Mutations ──────────────────────────────────────────────────────────────
  // Draft (new capture): mutate local state only — instant, the hot path.
  // Persisted (orden ya sincronizada): UI optimista + (online) sync inmediato o
  // (offline / fallo de red) encolar para sincronizar al reconectar. Cada línea
  // lleva un id de cliente (uuid) estable, así update/remove funcionan aun antes
  // de que el ADD llegue al backend. Solo un error real (4xx) revierte la op.
  const sameNote = (a: string | null, b: string | null) => (a ?? '').trim() === (b ?? '').trim();
  const normNote = (n?: string | null) => { const t = (n ?? '').trim(); return t.length ? t : null; };
  const isNetworkError = (e: unknown) => !(e as { response?: unknown })?.response;
  const setItemPending = (id: string, pending: boolean) =>
    setOrder((prev) => prev && { ...prev, items: prev.items.map((i) => i.id === id ? { ...i, pendingSync: pending } : i) });

  // Persiste un alta de línea: online la sube; offline/sin red la encola.
  const persistAdd = useCallback(async (line: DiningOrderItem) => {
    const item = {
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      unitPrice: Number(line.unitPrice),
      quantity: line.quantity,
      notes: line.notes,
    };
    const enqueue = async () => {
      await localOrderService.queueRemoteAddItem({ branchId, orderId: orderId!, item });
      await refreshSyncPending();
      setItemPending(line.id, true);
    };
    if (!isConnected) { await enqueue(); return; }
    try {
      await addOrderItem(branchId, orderId!, {
        id: item.id,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        ...(item.productId ? { productId: item.productId } : {}),
        ...(item.notes ? { notes: item.notes } : {}),
      });
      setItemPending(line.id, false);
    } catch (e) {
      if (isNetworkError(e)) { await enqueue(); return; }
      setOrder((prev) => prev && { ...prev, items: prev.items.filter((i) => i.id !== line.id) });
      Alert.alert('No se pudo agregar', getApiErrorMessage(e, 'Intenta de nuevo.'));
    }
  }, [isConnected, branchId, orderId]);

  // Persiste un cambio de línea (cantidad/nota). `revert` deshace el optimismo.
  const persistUpdate = useCallback(async (itemId: string, patch: { quantity?: number; notes?: string | null }, revert: () => void) => {
    const enqueue = async () => {
      await localOrderService.queueRemoteUpdateItem({ branchId, orderId: orderId!, itemId, ...patch });
      await refreshSyncPending();
      setItemPending(itemId, true);
    };
    if (!isConnected) { await enqueue(); return; }
    try {
      const saved = await updateOrderItem(branchId, orderId!, itemId, patch);
      setOrder((prev) => prev && { ...prev, items: prev.items.map((i) => i.id === itemId ? { ...normalizeItem(saved), pendingSync: false } : i) });
    } catch (e) {
      if (isNetworkError(e)) { await enqueue(); return; }
      revert();
      Alert.alert('No se pudo actualizar', getApiErrorMessage(e, 'Intenta de nuevo.'));
    }
  }, [isConnected, branchId, orderId]);

  // Persiste una baja de línea. `reinsert` la reinserta si el backend la rechaza.
  const persistRemove = useCallback(async (itemId: string, reinsert: () => void) => {
    const enqueue = async () => {
      await localOrderService.queueRemoteRemoveItem({ branchId, orderId: orderId!, itemId });
      await refreshSyncPending();
    };
    if (!isConnected) { await enqueue(); return; }
    try {
      await removeOrderItem(branchId, orderId!, itemId);
    } catch (e) {
      if (isNetworkError(e)) { await enqueue(); return; }
      reinsert();
      Alert.alert('No se pudo eliminar', getApiErrorMessage(e, 'Intenta de nuevo.'));
    }
  }, [isConnected, branchId, orderId]);

  // Add a product line. quantity ≥1; notes null for the quick path. Lines with a
  // different note are kept separate; same product + same note accumulate.
  const addLine = useCallback((product: ProductResult, quantity: number, notes: string | null) => {
    if (!isEditable) return;
    const note = normNote(notes);

    if (!isPersisted) {
      setLocalItems((prev) => {
        const existing = prev.find((i) => i.productId === product.id && sameNote(i.notes, note));
        if (existing) {
          return prev.map((i) => i === existing ? { ...i, quantity: i.quantity + quantity } : i);
        }
        return [...prev, {
          id: newId(),
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity,
          notes: note,
          sentToKitchenAt: null,
          createdAt: new Date().toISOString(),
        }];
      });
      return;
    }

    // Persistida: fusiona con una línea PENDIENTE existente (incrementa su
    // cantidad vía UPDATE) o agrega una línea nueva con id de cliente.
    const existing = order?.items.find((i) => i.productId === product.id && sameNote(i.notes, note) && isPending(i));
    if (existing) {
      const prevQty = existing.quantity;
      const newQty = prevQty + quantity;
      setOrder((prev) => prev && { ...prev, items: prev.items.map((i) => i.id === existing.id ? { ...i, quantity: newQty } : i) });
      void persistUpdate(existing.id, { quantity: newQty }, () =>
        setOrder((prev) => prev && { ...prev, items: prev.items.map((i) => i.id === existing.id ? { ...i, quantity: prevQty } : i) }),
      );
      return;
    }
    const line: DiningOrderItem = {
      id: newId(),
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity,
      notes: note,
      sentToKitchenAt: null,
      createdAt: new Date().toISOString(),
      pendingSync: !isConnected,
    };
    setOrder((prev) => prev && { ...prev, items: [...prev.items, line] });
    void persistAdd(line);
  }, [isPersisted, isEditable, isConnected, order, persistAdd, persistUpdate]);

  // Quick add (tap): +1, no note.
  const addProduct = useCallback((product: ProductResult) => addLine(product, 1, null), [addLine]);

  // Edit an existing line (quantity and/or note) — from the config sheet.
  // Solo líneas pendientes (lo enviado a cocina queda bloqueado).
  const editLine = useCallback((item: DiningOrderItem, quantity: number, notes: string | null) => {
    if (!isEditable || !isPending(item)) return;
    const note = normNote(notes);
    if (!isPersisted) {
      setLocalItems((prev) => prev.map((i) => i.id === item.id ? { ...i, quantity, notes: note } : i));
      return;
    }
    const snapshot = { quantity: item.quantity, notes: item.notes };
    setOrder((prev) => prev && { ...prev, items: prev.items.map((i) => i.id === item.id ? { ...i, quantity, notes: note } : i) });
    void persistUpdate(item.id, { quantity, notes: note }, () =>
      setOrder((prev) => prev && { ...prev, items: prev.items.map((i) => i.id === item.id ? { ...i, ...snapshot } : i) }),
    );
  }, [isPersisted, isEditable, persistUpdate]);

  const changeQty = useCallback((item: DiningOrderItem, delta: number) => {
    if (!isEditable || !isPending(item)) return;
    const newQty = item.quantity + delta;
    if (newQty < 1) return;

    if (!isPersisted) {
      setLocalItems((prev) => prev.map((i) => i.id === item.id ? { ...i, quantity: newQty } : i));
      return;
    }
    const prevQty = item.quantity;
    setOrder((prev) => prev && { ...prev, items: prev.items.map((i) => i.id === item.id ? { ...i, quantity: newQty } : i) });
    void persistUpdate(item.id, { quantity: newQty }, () =>
      setOrder((prev) => prev && { ...prev, items: prev.items.map((i) => i.id === item.id ? { ...i, quantity: prevQty } : i) }),
    );
  }, [isPersisted, isEditable, persistUpdate]);

  const removeItem = useCallback((item: DiningOrderItem) => {
    if (!isEditable || !isPending(item)) return;
    const doRemove = () => {
      if (!isPersisted) {
        setLocalItems((prev) => prev.filter((i) => i.id !== item.id));
        return;
      }
      // Optimista: quita ya. Si el backend la rechaza, reinserta en su posición.
      let index = -1;
      setOrder((prev) => {
        if (!prev) return prev;
        index = prev.items.findIndex((i) => i.id === item.id);
        return { ...prev, items: prev.items.filter((i) => i.id !== item.id) };
      });
      void persistRemove(item.id, () =>
        setOrder((prev) => {
          if (!prev || prev.items.some((i) => i.id === item.id)) return prev;
          const items = [...prev.items];
          items.splice(index < 0 ? items.length : index, 0, item);
          return { ...prev, items };
        }),
      );
    };
    Alert.alert('Eliminar producto', `¿Quitar "${item.productName}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: doRemove },
    ]);
  }, [isPersisted, isEditable, persistRemove]);

  // Config sheet confirm → add a configured line or apply edits to an existing one.
  const handleConfigConfirm = useCallback((quantity: number, note: string) => {
    if (!configTarget) return;
    if (configTarget.mode === 'add') addLine(configTarget.product, quantity, note);
    else editLine(configTarget.item, quantity, note);
    setConfigTarget(null);
  }, [configTarget, addLine, editLine]);

  // Confirm the capture. This is the ONLY point a new order is persisted: create
  // the DiningOrder, save its items, then advance to the kitchen/checkout state.
  // Editing an existing order just advances the status (items already saved).
  const sendOrder = useCallback(() => {
    if (!hasPending) {
      Alert.alert('Sin pendientes', 'No hay productos pendientes de enviar.');
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
        // Envía solo la ronda pendiente (no re-envía lo ya preparado).
        if (!isConnected) {
          // Existing order offline → queue fire so the sync worker calls fireRound later.
          await localOrderService.queueRemoteFire({ branchId, orderId: id! });
          // Mark all pending items as pendingSync so the UI reflects the queued state.
          setOrder((prev) =>
            prev
              ? {
                  ...prev,
                  items: prev.items.map((it) =>
                    it.sentToKitchenAt == null ? { ...it, pendingSync: true } : it,
                  ),
                }
              : prev,
          );
          await refreshSyncPending();
          Alert.alert(successTitle, `${successBody}\n\nSe guardó sin conexión y se sincronizará al reconectar.`, [
            { text: 'OK', onPress: onClose },
          ]);
          return;
        }
        const updated = await fireRound(branchId, id!);
        setOrder((prev) => prev && { ...prev, status: updated.status, items: updated.items });
        Alert.alert(successTitle, successBody, [{ text: 'OK', onPress: onClose }]);
      } catch (e) {
        Alert.alert('No se pudo continuar', getApiErrorMessage(e, 'Intenta de nuevo.'));
      } finally {
        setSending(false);
      }
    })();
  }, [hasPending, isConnected, target, subtotal, orderId, ensureOrder, localItems, branchId, kitchenEnabled, onClose]);

  // Cocina entregó (READY) → marcar lista para cobro (READY_FOR_PAYMENT) para
  // habilitar el cobro desde mesas/comandas.
  const markReadyForPayment = useCallback(() => {
    if (!orderId) return;
    setSending(true);
    (async () => {
      try {
        const updated = await changeOrderStatus(branchId, orderId, 'READY_FOR_PAYMENT');
        setOrder((prev) => prev && { ...prev, status: updated.status });
      } catch (e) {
        Alert.alert('No se pudo actualizar', getApiErrorMessage(e, 'Intenta de nuevo.'));
      } finally {
        setSending(false);
      }
    })();
  }, [orderId, branchId]);

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
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={productCols}
        columnWrapperStyle={{ gap: theme.spacing.md }}
        contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        removeClippedSubviews
        initialNumToRender={18}
        windowSize={7}
        ListEmptyComponent={
          <Text variant="body" tone="secondary" style={{ textAlign: 'center', marginTop: theme.spacing.xl }}>
            {search.trim() ? `Sin resultados para “${search.trim()}”.` : 'Sin productos.'}
          </Text>
        }
        ListFooterComponent={
          loadingMore
            ? <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: theme.spacing.lg }} />
            : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => addProduct(item)}
            onLongPress={() => isEditable && setConfigTarget({ mode: 'add', product: item })}
            delayLongPress={250}
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
    const saving = item.id.startsWith('temp-');     // optimista, sin id de servidor
    const sent = !!item.sentToKitchenAt;            // ya enviado a cocina → bloqueado
    const editable = isEditable && !sent && !saving;
    return (
      <View
        key={item.id}
        style={{
          paddingVertical: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          gap: theme.spacing.sm,
          opacity: saving ? 0.6 : 1,
        }}
      >
        {/* Nombre + total. Tocar abre la configuración (cantidad + nota) si editable. */}
        <Pressable
          onPress={() => editable && setConfigTarget({ mode: 'edit', item })}
          disabled={!editable}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
            <Text variant="label" style={{ flex: 1 }} numberOfLines={2}>{item.productName}</Text>
            <Text variant="bodyStrong">{formatCurrency(lineTotal)}</Text>
          </View>
          {item.notes ? (
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
              <Text variant="small" tone="primary">↳</Text>
              <Text variant="small" tone="primary" style={{ flex: 1 }}>{item.notes}</Text>
            </View>
          ) : editable ? (
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>+ Agregar nota</Text>
          ) : null}
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="small" tone="secondary">{formatCurrency(Number(item.unitPrice))} c/u</Text>
          {sent ? (
            // Línea ya enviada a cocina: bloqueada (no se re-prepara ni se edita).
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="check" size={13} color={theme.colors.success} />
              <Text variant="caption" tone="success">Enviada · {item.quantity}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Pressable onPress={() => removeItem(item)} disabled={!editable} hitSlop={8} style={({ pressed }) => ({ opacity: !editable ? 0.35 : pressed ? 0.5 : 1, padding: theme.spacing.xs })}>
                <Icon name="trash" size={16} color={theme.colors.danger} />
              </Pressable>
              <Pressable
                onPress={() => changeQty(item, -1)}
                disabled={atMin || !editable}
                hitSlop={6}
                style={({ pressed }) => ({ width: 34, height: 34, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', opacity: (atMin || !editable) ? 0.35 : pressed ? 0.6 : 1 })}
              >
                <Icon name="minus" size={16} color={theme.colors.text} />
              </Pressable>
              <Text variant="body" style={{ minWidth: 22, textAlign: 'center', fontWeight: '700' }}>{item.quantity}</Text>
              <Pressable
                onPress={() => changeQty(item, 1)}
                disabled={!editable}
                hitSlop={6}
                style={({ pressed }) => ({ width: 34, height: 34, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', opacity: !editable ? 0.35 : pressed ? 0.6 : 1 })}
              >
                <Icon name="plus" size={16} color={theme.colors.text} />
              </Pressable>
            </View>
          )}
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
        {hasPending ? (
          // Hay ronda pendiente → enviar solo lo nuevo (a cocina o a caja).
          <Pressable
            onPress={sendOrder}
            disabled={sending}
            style={({ pressed }) => ({
              paddingVertical: theme.spacing.lg,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              opacity: sending ? 0.45 : pressed ? 0.85 : 1,
            })}
          >
            {sending
              ? <ActivityIndicator color={theme.colors.onPrimary} />
              : <Text variant="bodyStrong" style={{ color: theme.colors.onPrimary }}>{kitchenEnabled ? 'Enviar a Cocina' : 'Enviar a Caja'}</Text>
            }
          </Pressable>
        ) : isPayable ? (
          // Cuenta lista para cobro → cobrar (genera Order + pago + ticket).
          <Pressable
            onPress={() => setCheckoutVisible(true)}
            disabled={sending || totalQty === 0}
            style={({ pressed }) => ({
              paddingVertical: theme.spacing.lg,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              opacity: (sending || totalQty === 0) ? 0.45 : pressed ? 0.85 : 1,
            })}
          >
            <Text variant="bodyStrong" style={{ color: theme.colors.onPrimary }}>Cobrar {formatCurrency(subtotal)}</Text>
          </Pressable>
        ) : isReady ? (
          // Cocina entregó → habilitar el cobro.
          <Pressable
            onPress={markReadyForPayment}
            disabled={sending}
            style={({ pressed }) => ({
              paddingVertical: theme.spacing.lg,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              opacity: sending ? 0.45 : pressed ? 0.85 : 1,
            })}
          >
            {sending
              ? <ActivityIndicator color={theme.colors.onPrimary} />
              : <Text variant="bodyStrong" style={{ color: theme.colors.onPrimary }}>Marcar lista para cobro</Text>
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

  // Modal de cobro, compartido por ambos layouts. Al pagar, cierra la captura
  // (el padre refresca mesas/comandas).
  const checkoutModal = (
    <CheckoutModal
      visible={checkoutVisible}
      order={order}
      branchId={branchId}
      onClose={() => setCheckoutVisible(false)}
      onPaid={() => { setCheckoutVisible(false); onClose(); }}
    />
  );

  // Hoja de cantidad + nota (alta con config / edición de línea).
  const configSheet = (
    <ItemConfigSheet
      visible={configTarget != null}
      title={configTarget?.mode === 'add' ? configTarget.product.name : configTarget?.mode === 'edit' ? configTarget.item.productName : ''}
      initialQuantity={configTarget?.mode === 'edit' ? configTarget.item.quantity : 1}
      initialNote={configTarget?.mode === 'edit' ? (configTarget.item.notes ?? '') : ''}
      confirmLabel={configTarget?.mode === 'edit' ? 'Guardar' : 'Agregar'}
      onCancel={() => setConfigTarget(null)}
      onConfirm={handleConfigConfirm}
    />
  );

  // ── Tablet: 3 panels ────────────────────────────────────────────────────────
  if (isTablet) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.colors.canvas }}>
        {checkoutModal}
        {configSheet}
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
      {checkoutModal}
      {configSheet}
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
