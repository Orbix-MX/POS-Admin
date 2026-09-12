/**
 * POS — product picker + cart + checkout. `POST /orders` does order creation,
 * inventory consumption and the cash-session movement atomically server-side
 * (`OrdersService.create`); this screen only has to collect items and a
 * payment method and gate on an open cash session (required server-side too).
 *
 * Laid out from the "Orbix POS" Claude Design prototype: wash background,
 * category chips, a two-up product grid, a floating gradient cart bar and a
 * three-stage checkout sheet.
 */
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import {
  AppDrawer,
  DrawerButton,
  OrbixInput,
  OrbixScaffold,
  OrbixSkeleton,
  OrbixText,
  toast,
} from '@/components';
import { SearchIcon } from '@/components/ui/icons';
import { OpenCashSessionPanel } from '@/features/cash/open-session-panel';
import { CartBar } from '@/features/pos/cart-bar';
import { CategoryChips, type CategoryChip } from '@/features/pos/category-chips';
import {
  CheckoutSheet,
  type CheckoutStage,
  type PaymentOption,
  type PosPaymentMethod,
} from '@/features/pos/checkout-sheet';
import { computeTotals, formatCurrency, type CartLine } from '@/features/pos/pos-totals';
import { ProductCard } from '@/features/pos/product-card';
import { useActiveCashSession, useCreateSaleOrder, useSendReceipt } from '@/features/pos/use-pos';
import { useCategories, useProducts } from '@/features/products/use-products';
import { usePosSortByPref } from '@/features/settings/use-settings-prefs';
import { useAuth } from '@/hooks/use-auth';
import { useCurrencyFormatVersion } from '@/hooks/use-currency-format-version';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import type { Order } from '@/repositories/orders-repository';
import type { Product } from '@/repositories/products-repository';
import { toUserMessage } from '@/utils/error-message';

/** Invisible tile that pads an odd-length grid to a full final row. */
interface GridSpacer {
  id: string;
  spacer: true;
}

export default function PosScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { can } = usePermissions();
  useCurrencyFormatVersion();

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [stage, setStage] = useState<CheckoutStage>('cart');
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('CASH');
  const [amountReceived, setAmountReceived] = useState('');
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [receiptEmail, setReceiptEmail] = useState('');
  const [receiptSent, setReceiptSent] = useState(false);

  const { data: cashSession, isLoading: isLoadingSession } = useActiveCashSession();
  const { data: productsResult, isLoading: isLoadingProducts } = useProducts({
    search: search || undefined,
    status: 'ACTIVE',
    limit: 100,
  });
  const { data: categories } = useCategories();
  const createOrder = useCreateSaleOrder();
  const sendReceipt = useSendReceipt();
  const { value: sortBy } = usePosSortByPref();

  const allProducts = useMemo(() => {
    const products = productsResult?.products ?? [];
    // A copy — `sort` is in-place and `products` is React Query's cached
    // array, mutating it would corrupt the cache other screens read from.
    return [...products].sort((a, b) =>
      sortBy === 'name'
        ? a.name.localeCompare(b.name)
        // Newest first — a just-registered product is the one someone is
        // most likely mid-stocking-and-selling right now.
        : b.createdAt.localeCompare(a.createdAt),
    );
  }, [productsResult, sortBy]);

  /**
   * Counts describe the loaded page, not a server aggregate — the chips must
   * agree with what tapping them will actually reveal.
   */
  const categoryChips = useMemo<CategoryChip[]>(() => {
    const counts = new Map<string, number>();
    for (const product of allProducts) {
      if (!product.categoryId) continue;
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }

    const chips: CategoryChip[] = [
      { id: null, label: t('pos.allCategories'), count: allProducts.length },
    ];
    for (const category of categories ?? []) {
      const count = counts.get(category.id) ?? 0;
      if (count > 0) chips.push({ id: category.id, label: category.name, count });
    }
    return chips;
  }, [allProducts, categories, t]);

  const visibleProducts = useMemo(
    () => (categoryId ? allProducts.filter((p) => p.categoryId === categoryId) : allProducts),
    [allProducts, categoryId],
  );

  const quantityByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) map.set(line.productId, line.quantity);
    return map;
  }, [cart]);

  const totals = useMemo(() => computeTotals(cart), [cart]);

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          quantity: 1,
          stock: product.stock,
          trackInventory: product.trackInventory,
          taxRate: product.taxRate,
        },
      ];
    });
  }, []);

  const increment = useCallback((productId: string) => {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l)));
  }, []);

  /**
   * Emptying the cart from inside the sheet closes it — there is nothing left
   * to charge. Computed from the current cart rather than inside the updater,
   * which React may run more than once.
   */
  const decrement = useCallback(
    (productId: string) => {
      const next = cart
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0);
      setCart(next);
      if (next.length === 0) setCheckoutVisible(false);
    },
    [cart],
  );

  const received = Number(amountReceived);
  const change =
    paymentMethod === 'CASH' && Number.isFinite(received) ? Math.max(0, received - totals.total) : 0;

  const openCheckout = useCallback(() => {
    setStage('cart');
    setCheckoutVisible(true);
  }, []);

  const closeCheckout = useCallback(() => setCheckoutVisible(false), []);

  const resetSale = useCallback(() => {
    setCart([]);
    setCheckoutVisible(false);
    setStage('cart');
    setAmountReceived('');
    setLastOrder(null);
    setReceiptEmail('');
    setReceiptSent(false);
    setSearch('');
    setCategoryId(null);
  }, []);

  const handleConfirm = useCallback(() => {
    setStage('processing');
    createOrder.mutate(
      {
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, price: l.price })),
        paymentMethod,
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        ...(paymentMethod === 'CASH' && Number.isFinite(received) && received > 0
          ? { payments: [{ method: 'CASH', amount: totals.total, amountReceived: received, changeGiven: change }] }
          : {}),
      },
      {
        onSuccess: (order) => {
          setLastOrder(order);
          setStage('done');
          toast.success(t('pos.saleCompleted', { number: order.orderNumber }));
        },
        // Back to the cart so the operator can retry or change the method —
        // the sheet must never strand them on a spinner.
        onError: () => setStage('cart'),
      },
    );
  }, [cart, change, createOrder, paymentMethod, received, t, totals.total]);

  const handleSendReceipt = useCallback(() => {
    if (!lastOrder) return;
    sendReceipt.mutate(
      { orderId: lastOrder.id, email: receiptEmail.trim() },
      { onSuccess: () => setReceiptSent(true) },
    );
  }, [lastOrder, receiptEmail, sendReceipt]);

  const paymentOptions = useMemo<PaymentOption[]>(
    () => [
      { id: 'CASH', label: t('pos.cash') },
      { id: 'CARD', label: t('pos.card') },
      { id: 'TRANSFER', label: t('pos.transfer') },
    ],
    [t],
  );

  /**
   * A trailing spacer keeps the last row two-up: without it the odd card gets
   * the whole row from `flex: 1` and reads as a different, wider tile.
   */
  const gridData = useMemo<(Product | GridSpacer)[]>(
    () =>
      visibleProducts.length % 2 === 1
        ? [...visibleProducts, { id: '__spacer__', spacer: true }]
        : visibleProducts,
    [visibleProducts],
  );

  const renderProduct = useCallback(
    ({ item }: { item: Product | GridSpacer }) => {
      if ('spacer' in item) return <View style={{ flex: 1 }} />;
      return (
        <ProductCard
          product={item}
          quantity={quantityByProduct.get(item.id) ?? 0}
          onAdd={addToCart}
          labels={{ lowStock: t('pos.lowStock'), outOfStock: t('pos.outOfStock') }}
        />
      );
    },
    [addToCart, quantityByProduct, t],
  );

  const hasBranch = Boolean(session?.branchId);
  const showLoading = !hasBranch || isLoadingSession;
  const canSell = can('orders:create');

  return (
    <OrbixScaffold contentStyle={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        {/* Ventas es una pantalla raíz, no un detalle: no hay nada detrás a lo
            que volver, así que el hueco del header lo ocupa el acceso al
            drawer, igual que en Inicio. */}
        <DrawerButton onPress={() => setDrawerVisible(true)} accessibilityLabel={t('drawer.title')} />
        <View style={{ flex: 1 }}>
          <OrbixText size="xs" weight="semibold" tone="mutedForeground">
            {(cashSession ? t('pos.cashOpen') : t('pos.title')).toUpperCase()}
          </OrbixText>
          <OrbixText size="xl" weight="bold" accessibilityRole="header">
            {t('pos.newSale')}
          </OrbixText>
        </View>
        {/* El efectivo esperado, no una etiqueta fija: es el dato que el cajero
            necesita a mano durante todo el turno, y ya viaja en el `summary` de
            la sesión. Toca para ir a Caja. */}
        {cashSession?.summary ? (
          <Pressable
            onPress={() => router.push('/(app)/caja')}
            accessibilityRole="button"
            accessibilityLabel={t('cash.expectedCash')}
            style={{ alignItems: 'flex-end' }}
          >
            <OrbixText size="xs" weight="semibold" tone="mutedForeground">
              {t('cash.expectedCash').toUpperCase()}
            </OrbixText>
            <OrbixText size="base" weight="bold" style={{ fontVariant: ['tabular-nums'] }}>
              {formatCurrency(cashSession.summary.expectedCash)}
            </OrbixText>
          </Pressable>
        ) : null}
      </View>
      <AppDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

      {showLoading ? (
        <View style={{ gap: theme.spacing.sm }}>
          <OrbixSkeleton height={64} radius={theme.radius.lg} />
          <OrbixSkeleton height={64} radius={theme.radius.lg} />
        </View>
      ) : !cashSession ? (
        <OpenCashSessionPanel />
      ) : (
        <>
          <OrbixInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('pos.searchPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            borderRadius={theme.radius.full}
            leftAdornment={<SearchIcon size={15} color={theme.colors.mutedForeground} />}
          />

          {categoryChips.length > 1 ? (
            <CategoryChips categories={categoryChips} selectedId={categoryId} onSelect={setCategoryId} />
          ) : null}

          {isLoadingProducts ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <OrbixSkeleton height={168} radius={theme.radius.xl} style={{ flex: 1 }} />
              <OrbixSkeleton height={168} radius={theme.radius.xl} style={{ flex: 1 }} />
            </View>
          ) : (
            <FlatList
              data={gridData}
              keyExtractor={(item) => item.id}
              renderItem={renderProduct}
              numColumns={2}
              columnWrapperStyle={{ gap: 11 }}
              ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
              showsVerticalScrollIndicator={false}
              // La rejilla se ancla arriba de forma explícita: sin `flex: 1` la
              // lista se dimensiona por su contenido y queda a merced de cómo
              // reparta el hueco la columna del scaffold, en vez de ocupar todo
              // el espacio restante y empezar en su borde superior.
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'flex-start',
                paddingBottom: cart.length ? 130 : theme.spacing.xl,
              }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', gap: 8, paddingVertical: 56, paddingHorizontal: 20 }}>
                  <SearchIcon size={38} color={theme.colors.mutedForeground} />
                  <OrbixText size="base" weight="semibold">{t('pos.noResults')}</OrbixText>
                  <OrbixText size="sm" tone="mutedForeground" align="center" style={{ maxWidth: 220 }}>
                    {search ? t('pos.noResultsHint', { query: search }) : t('pos.noProducts')}
                  </OrbixText>
                </View>
              }
            />
          )}

          {cart.length > 0 ? (
            <CartBar
              countLabel={
                totals.itemCount === 1
                  ? t('pos.cartItemOne')
                  : t('pos.cartItemOther', { count: totals.itemCount })
              }
              totalLabel={formatCurrency(totals.total)}
              chargeLabel={t('pos.confirmSale')}
              disabled={!canSell}
              onPress={openCheckout}
            />
          ) : null}
        </>
      )}

      <CheckoutSheet
        visible={checkoutVisible}
        stage={stage}
        lines={cart}
        totals={totals}
        paymentMethod={paymentMethod}
        paymentOptions={paymentOptions}
        onSelectPayment={setPaymentMethod}
        amountReceived={amountReceived}
        onChangeAmountReceived={setAmountReceived}
        change={change}
        receiptEmail={receiptEmail}
        onChangeReceiptEmail={setReceiptEmail}
        onSendReceipt={handleSendReceipt}
        sendingReceipt={sendReceipt.isPending}
        receiptSent={receiptSent}
        order={lastOrder}
        errorMessage={createOrder.error ? toUserMessage(createOrder.error, t) : null}
        canConfirm={canSell && cart.length > 0}
        onIncrement={increment}
        onDecrement={decrement}
        onConfirm={handleConfirm}
        onClose={closeCheckout}
        onNewSale={resetSale}
        labels={{
          summary: t('pos.summary'),
          close: t('pos.close'),
          subtotal: t('pos.subtotal'),
          tax: t('pos.tax'),
          total: t('pos.total'),
          paymentMethod: t('pos.paymentMethod'),
          completeSale: t('pos.completeSale'),
          processingPayment: t('pos.processingPayment'),
          saleDone: t('pos.saleDone'),
          folio: t('pos.folio'),
          newSale: t('pos.newSale'),
          sendReceipt: t('pos.sendReceipt'),
          receiptEmailPlaceholder: t('pos.receiptEmailPlaceholder'),
          receiptSent: t('pos.receiptSent'),
          amountReceivedPlaceholder: t('pos.amountReceivedPlaceholder'),
          change: t('pos.change'),
        }}
      />
    </OrbixScaffold>
  );
}
