/**
 * Artículos — catálogo de productos, solo lectura. Búsqueda + filtro de
 * categoría server-side (mismo patrón que OrderCapture), sin acciones de venta:
 * tocar un producto abre una hoja de detalle informativa (nombre, SKU, precio,
 * categoría, tipo). No hay alta/edición aquí — ese flujo vive en el panel web.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Pressable, ScrollView, FlatList, ActivityIndicator, Modal, RefreshControl } from 'react-native';

import { Screen, Text, Icon } from '@/components/ui';
import { AppHeader, BranchSelectorModal } from '@/components/navigation';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useBranchSelector } from '@/hooks/use-branch-selector';
import { searchProducts, fetchCategories } from '@/services/restaurant-service';
import type { ProductResult, ProductCategory } from '@/services/restaurant-service';

const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

const FILTER_ALL = 'all';
const FILTER_COMBOS = 'combos';

// ── Detail sheet (read-only) ──────────────────────────────────────────────────
function ProductDetailSheet({ product, onClose }: { product: ProductResult | null; onClose: () => void }) {
  const theme = useTheme();
  if (!product) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: theme.radius['2xl'],
            borderTopRightRadius: theme.radius['2xl'],
            padding: theme.spacing['2xl'],
            gap: theme.spacing.lg,
          }}
        >
          <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center' }} />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text variant="h2" numberOfLines={2}>{product.name}</Text>
              <Text variant="small" tone="secondary" style={{ marginTop: 2 }}>SKU {product.sku}</Text>
            </View>
            {product.type === 'COMBO' && (
              <View style={{ backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.sm, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text variant="caption" style={{ color: theme.colors.primary }}>combo</Text>
              </View>
            )}
          </View>

          <View style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg, padding: theme.spacing.lg, gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="label" tone="secondary">Precio</Text>
              <Text variant="h2" tone="success">{formatCurrency(product.price)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="label" tone="secondary">Categoría</Text>
              <Text variant="body">{product.category?.name ?? 'Sin categoría'}</Text>
            </View>
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surfaceMuted,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg,
              alignItems: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text variant="small" tone="secondary">Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function ArticulosScreen() {
  const theme = useTheme();
  const { isTablet } = useResponsive();
  const { modalVisible, activeBranch, availableBranches, openSelector, closeSelector, handleSelect, canSwitch } = useBranchSelector();

  const [products, setProducts] = useState<ProductResult[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const reqId = useRef(0);

  const [filter, setFilter] = useState<string>(FILTER_ALL);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProductResult | null>(null);

  useEffect(() => {
    void fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const buildQuery = useCallback((pageNum: number) => ({
    page: pageNum,
    limit: 30,
    search: search.trim() || undefined,
    ...(filter === FILTER_COMBOS ? { type: 'COMBO' as const }
      : filter !== FILTER_ALL ? { categoryId: filter } : {}),
  }), [search, filter]);

  const loadFirstPage = useCallback(async (isRefresh = false) => {
    const id = ++reqId.current;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await searchProducts(buildQuery(1));
      if (id !== reqId.current) return;
      setProducts(res.products);
      setPage(res.page);
      setHasMore(res.page < res.totalPages);
    } catch {
      if (id === reqId.current) { setProducts([]); setHasMore(false); }
    } finally {
      if (id === reqId.current) { if (isRefresh) setRefreshing(false); else setLoading(false); }
    }
  }, [buildQuery]);

  const onRefresh = useCallback(() => {
    void fetchCategories().then(setCategories).catch(() => {});
    void loadFirstPage(true);
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    const id = reqId.current;
    setLoadingMore(true);
    try {
      const res = await searchProducts(buildQuery(page + 1));
      if (id !== reqId.current) return;
      setProducts((prev) => [...prev, ...res.products]);
      setPage(res.page);
      setHasMore(res.page < res.totalPages);
    } catch {
      // mantiene lo cargado; el usuario reintenta al hacer scroll de nuevo
    } finally {
      if (id === reqId.current) setLoadingMore(false);
    }
  }, [loadingMore, loading, hasMore, page, buildQuery]);

  useEffect(() => {
    const t = setTimeout(() => { void loadFirstPage(); }, 250);
    return () => clearTimeout(t);
  }, [search, filter, loadFirstPage]);

  const filters: { key: string; label: string }[] = [
    { key: FILTER_ALL, label: 'Todos' },
    { key: FILTER_COMBOS, label: 'Combos' },
    ...categories.map((c) => ({ key: c.id, label: c.name })),
  ];

  const cols = isTablet ? 4 : 2;

  return (
    <Screen edges={[]}>
      <AppHeader
        branchName={activeBranch?.name ?? 'Sucursal'}
        searchPlaceholder="Buscar artículo o SKU"
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

      <ProductDetailSheet product={selected} onClose={() => setSelected(null)} />

      <View style={{ paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: theme.spacing.xl }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {filters.map((f) => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={({ pressed }) => ({
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.lg,
                    borderRadius: theme.radius.full,
                    backgroundColor: active ? theme.colors.primary : theme.colors.surfaceMuted,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text variant="label" numberOfLines={1} style={{ color: active ? theme.colors.onPrimary : theme.colors.textSecondary }}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.xl }} />
      ) : (
        <FlatList
          key={`grid-${cols}`}
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={cols}
          columnWrapperStyle={{ gap: theme.spacing.md }}
          contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.xl }}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
          removeClippedSubviews
          initialNumToRender={18}
          windowSize={7}
          ListEmptyComponent={
            <Text variant="body" tone="secondary" style={{ textAlign: 'center', marginTop: theme.spacing.xl }}>
              {search.trim() ? `Sin resultados para "${search.trim()}".` : 'Sin artículos.'}
            </Text>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: theme.spacing.lg }} /> : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item)}
              style={({ pressed }) => ({
                flex: 1 / cols,
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.lg,
                overflow: 'hidden',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View style={{ height: 64, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="package" size={22} color={theme.colors.textMuted} />
              </View>
              <View style={{ padding: theme.spacing.md, gap: 4 }}>
                <Text variant="label" numberOfLines={2} style={{ minHeight: 34 }}>{item.name}</Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>SKU {item.sku}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                  <Text variant="mono" tone="success">{formatCurrency(item.price)}</Text>
                  {item.type === 'COMBO' && (
                    <View style={{ backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text variant="caption" style={{ color: theme.colors.primary }}>combo</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
