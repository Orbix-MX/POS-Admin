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
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';

import {
  AppDrawer,
  DrawerButton,
  OrbixButton,
  OrbixInput,
  OrbixScaffold,
  OrbixSkeleton,
  OrbixText,
  toast,
} from '@/components';
import { CreditCardIcon, SearchIcon } from '@/components/ui/icons';
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
import {
  useActiveCashSession,
  useCreateSaleOrder,
  useOpenCashSession,
  useSendReceipt,
} from '@/features/pos/use-pos';
import { useCategories, useProducts } from '@/features/products/use-products';
import { usePosSortByPref } from '@/features/settings/use-settings-prefs';
import { useAuth } from '@/hooks/use-auth';
import { useCurrencyFormatVersion } from '@/hooks/use-currency-format-version';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import type { Order } from '@/repositories/pos-repository';
import type { Product } from '@/repositories/products-repository';
import { toUserMessage } from '@/utils/error-message';

/** Invisible tile that pads an odd-length grid to a full final row. */
interface GridSpacer {
  id: string;
  spacer: true;
}

/** `''` → 0, so an untouched optional field never becomes NaN. */
function parseAmount(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Opening-cash-drawer gate, shown instead of the product picker until a session
 * exists. The drawer can be floated in both currencies: `openingAmountUsd` is
 * optional server-side, but `exchangeRateUsdMxn` is not — and it is frozen for
 * the whole session (closing computes `differenceUsd` against it), so it is
 * only demanded when dollars are actually being deposited.
 */
function OpenCashSessionPanel() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingAmountUsd, setOpeningAmountUsd] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const openSession = useOpenCashSession();

  const usdAmount = openingAmountUsd.trim() ? parseAmount(openingAmountUsd) : 0;
  const hasUsd = Number.isFinite(usdAmount) && usdAmount > 0;

  const handleOpen = () => {
    const amount = openingAmount.trim() ? parseAmount(openingAmount) : 0;
    if (!Number.isFinite(amount) || amount < 0) return;
    if (!Number.isFinite(usdAmount) || usdAmount < 0) return;

    const rate = exchangeRate.trim() ? parseAmount(exchangeRate) : 0;
    // The API requires a rate ≥ 0.01 always. With no dollars in the drawer it
    // carries no meaning, so send the schema's neutral default instead of
    // inventing a number that would later be reported as the session's FX rate.
    if (hasUsd && (!Number.isFinite(rate) || rate < 0.01)) {
      setValidationError(t('pos.exchangeRateRequired'));
      return;
    }
    setValidationError(null);

    openSession.mutate({
      exchangeRateUsdMxn: Number.isFinite(rate) && rate >= 0.01 ? rate : 1,
      openingAmount: amount,
      ...(hasUsd ? { openingAmountUsd: usdAmount } : {}),
    });
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg, paddingHorizontal: theme.spacing.xl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.brandBlue50,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CreditCardIcon size={26} color={theme.colors.brandBlue600} />
      </View>
      <View style={{ gap: 4, alignItems: 'center' }}>
        <OrbixText size="lg" weight="bold">{t('pos.noCashSession')}</OrbixText>
        <OrbixText size="sm" tone="mutedForeground" align="center">
          {t('pos.noCashSessionHint')}
        </OrbixText>
      </View>

      <View style={{ width: '100%', gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <OrbixText size="xs" weight="semibold" tone="mutedForeground">
              {t('pos.openingAmountMxn').toUpperCase()}
            </OrbixText>
            <OrbixInput
              value={openingAmount}
              onChangeText={setOpeningAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <OrbixText size="xs" weight="semibold" tone="warningFg">
              {t('pos.openingAmountUsd').toUpperCase()}
            </OrbixText>
            <OrbixInput
              value={openingAmountUsd}
              onChangeText={setOpeningAmountUsd}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {hasUsd ? (
          <View style={{ gap: theme.spacing.xs }}>
            <OrbixText size="xs" weight="semibold" tone="mutedForeground">
              {t('pos.exchangeRate').toUpperCase()}
            </OrbixText>
            <OrbixInput
              value={exchangeRate}
              onChangeText={setExchangeRate}
              placeholder="19.45"
              keyboardType="decimal-pad"
              hasError={Boolean(validationError)}
            />
            <OrbixText size="xs" tone="mutedForeground">{t('pos.exchangeRateHint')}</OrbixText>
          </View>
        ) : null}

        {validationError ? (
          <OrbixText size="xs" tone="dangerFg">{validationError}</OrbixText>
        ) : null}
        {openSession.error ? (
          <OrbixText size="xs" tone="dangerFg">{toUserMessage(openSession.error, t)}</OrbixText>
        ) : null}

        <OrbixButton label={t('pos.openCashSession')} onPress={handleOpen} loading={openSession.isPending} />
      </View>
    </View>
  );
}

export default function PosScreen() {
  const theme = useTheme();
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
    <OrbixScaffold background="wash" contentStyle={{ gap: theme.spacing.md }}>
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
              contentContainerStyle={{ paddingBottom: cart.length ? 130 : theme.spacing.xl }}
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
