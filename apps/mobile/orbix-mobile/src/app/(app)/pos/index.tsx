/**
 * POS — product picker + cart + checkout. `POST /orders` does order creation,
 * inventory consumption and the cash-session movement atomically server-side
 * (`OrdersService.create`); this screen only has to collect items and a
 * payment method and gate on an open cash session (required server-side too).
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import {
  BackButton,
  OrbixButton,
  OrbixInput,
  OrbixModal,
  OrbixScaffold,
  OrbixSkeleton,
  OrbixText,
  toast,
} from '@/components';
import { CreditCardIcon, MinusIcon, PackageIcon, PlusIcon, TrashIcon } from '@/components/ui/icons';
import { useProducts } from '@/features/products/use-products';
import { useActiveCashSession, useCreateSaleOrder, useOpenCashSession } from '@/features/pos/use-pos';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import type { Product } from '@/repositories/products-repository';
import { toUserMessage } from '@/utils/error-message';

interface CartLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  trackInventory: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(value);
}

/** Opening-cash-drawer gate, shown instead of the product picker until a session exists. */
function OpenCashSessionPanel() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [openingAmount, setOpeningAmount] = useState('');
  const openSession = useOpenCashSession();

  const handleOpen = () => {
    const amount = Number(openingAmount);
    if (!Number.isFinite(amount) || amount < 0) return;
    openSession.mutate({ exchangeRateUsdMxn: 17.5, openingAmount: amount });
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
        <OrbixText size="sm" tone="mutedForeground" style={{ textAlign: 'center' }}>
          {t('pos.noCashSessionHint')}
        </OrbixText>
      </View>
      <View style={{ width: '100%', gap: theme.spacing.sm }}>
        <OrbixInput
          value={openingAmount}
          onChangeText={setOpeningAmount}
          placeholder={t('pos.openingAmountPlaceholder')}
          keyboardType="decimal-pad"
        />
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
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { can } = usePermissions();

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [amountReceived, setAmountReceived] = useState('');

  const { data: cashSession, isLoading: isLoadingSession } = useActiveCashSession();
  const { data: productsResult, isLoading: isLoadingProducts } = useProducts({
    search: search || undefined,
    status: 'ACTIVE',
    limit: 100,
  });
  const createOrder = useCreateSaleOrder();

  const total = useMemo(() => cart.reduce((sum, line) => sum + line.price * line.quantity, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1, stock: product.stock, trackInventory: product.trackInventory }];
    });
  };

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const removeLine = (productId: string) => setCart((prev) => prev.filter((l) => l.productId !== productId));

  const received = Number(amountReceived);
  const change = paymentMethod === 'CASH' && Number.isFinite(received) ? Math.max(0, received - total) : 0;

  const handleCheckout = () => {
    createOrder.mutate(
      {
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, price: l.price })),
        paymentMethod,
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        ...(paymentMethod === 'CASH' && Number.isFinite(received) && received > 0
          ? { payments: [{ method: 'CASH', amount: total, amountReceived: received, changeGiven: change }] }
          : {}),
      },
      {
        onSuccess: (order) => {
          toast.success(t('pos.saleCompleted', { number: order.orderNumber }));
          setCart([]);
          setCheckoutVisible(false);
          setAmountReceived('');
        },
      },
    );
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const inCart = cart.find((l) => l.productId === item.id);
    const outOfStock = item.trackInventory && item.stock <= 0;
    return (
      <Pressable
        onPress={() => !outOfStock && addToCart(item)}
        disabled={outOfStock}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.lg,
          backgroundColor: pressed ? theme.colors.muted : theme.colors.card,
          borderWidth: 1,
          borderColor: inCart ? theme.colors.primary : theme.colors.border,
          opacity: outOfStock ? 0.5 : 1,
        })}
      >
        <View style={{ width: 40, height: 40, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandBlue50, alignItems: 'center', justifyContent: 'center' }}>
          <PackageIcon size={18} color={theme.colors.brandBlue600} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <OrbixText size="sm" weight="semibold" numberOfLines={1}>{item.name}</OrbixText>
          <OrbixText size="xs" tone="mutedForeground">
            {outOfStock ? t('pos.outOfStock') : item.trackInventory ? t('products.stockCount', { count: item.stock }) : item.sku}
          </OrbixText>
        </View>
        <OrbixText size="sm" weight="semibold">{formatCurrency(item.price)}</OrbixText>
        {inCart ? (
          <View style={{ minWidth: 26, height: 26, borderRadius: theme.radius.full, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
            <OrbixText size="xs" weight="bold" tone="primaryForeground">{inCart.quantity}</OrbixText>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const hasBranch = Boolean(session?.branchId);
  const showLoading = !hasBranch || isLoadingSession;

  return (
    <OrbixScaffold background="surface" contentStyle={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" style={{ flex: 1 }} accessibilityRole="header">
          {t('pos.title')}
        </OrbixText>
      </View>

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
          />

          {isLoadingProducts ? (
            <View style={{ gap: theme.spacing.sm }}>
              {[0, 1, 2].map((i) => <OrbixSkeleton key={i} height={64} radius={theme.radius.lg} />)}
            </View>
          ) : (
            <FlatList
              data={productsResult?.products ?? []}
              keyExtractor={(item) => item.id}
              renderItem={renderProduct}
              ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: cart.length ? 180 : theme.spacing.xl }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: theme.spacing['3xl'] }}>
                  <OrbixText size="sm" tone="mutedForeground">{t('pos.noProducts')}</OrbixText>
                </View>
              }
            />
          )}

          {cart.length > 0 ? (
            <View
              style={{
                position: 'absolute',
                left: theme.spacing.xl,
                right: theme.spacing.xl,
                bottom: theme.spacing.xl,
                backgroundColor: theme.colors.card,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.lg,
                gap: theme.spacing.sm,
              }}
            >
              {cart.map((line) => (
                <View key={line.productId} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <OrbixText size="xs" style={{ flex: 1 }} numberOfLines={1}>{line.name}</OrbixText>
                  <Pressable onPress={() => changeQty(line.productId, -1)} hitSlop={6}>
                    <MinusIcon size={14} color={theme.colors.mutedForeground} />
                  </Pressable>
                  <OrbixText size="xs" weight="semibold">{line.quantity}</OrbixText>
                  <Pressable onPress={() => changeQty(line.productId, 1)} hitSlop={6}>
                    <PlusIcon size={14} color={theme.colors.mutedForeground} />
                  </Pressable>
                  <OrbixText size="xs" weight="semibold" style={{ minWidth: 64, textAlign: 'right' }}>
                    {formatCurrency(line.price * line.quantity)}
                  </OrbixText>
                  <Pressable onPress={() => removeLine(line.productId)} hitSlop={6}>
                    <TrashIcon size={14} color={theme.colors.dangerFg} />
                  </Pressable>
                </View>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: theme.spacing.xs, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                <OrbixText size="sm" weight="bold">{t('pos.total')}</OrbixText>
                <OrbixText size="sm" weight="bold">{formatCurrency(total)}</OrbixText>
              </View>
              <OrbixButton
                label={t('pos.charge', { count: itemCount })}
                onPress={() => setCheckoutVisible(true)}
                disabled={!can('orders:create')}
              />
            </View>
          ) : null}
        </>
      )}

      <OrbixModal
        visible={checkoutVisible}
        title={t('pos.checkout')}
        description={formatCurrency(total)}
        confirmLabel={t('pos.confirmSale')}
        cancelLabel={t('common.cancel')}
        loading={createOrder.isPending}
        onConfirm={handleCheckout}
        onDismiss={() => setCheckoutVisible(false)}
      >
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Pressable
              onPress={() => setPaymentMethod('CASH')}
              style={{
                flex: 1,
                paddingVertical: theme.spacing.sm + 2,
                borderRadius: theme.radius.lg,
                alignItems: 'center',
                backgroundColor: paymentMethod === 'CASH' ? theme.colors.brandBlue50 : theme.colors.muted,
                borderWidth: paymentMethod === 'CASH' ? 1 : 0,
                borderColor: theme.colors.primary,
              }}
            >
              <OrbixText size="sm" weight={paymentMethod === 'CASH' ? 'semibold' : 'regular'} tone={paymentMethod === 'CASH' ? 'primary' : 'foreground'}>
                {t('pos.cash')}
              </OrbixText>
            </Pressable>
            <Pressable
              onPress={() => setPaymentMethod('CARD')}
              style={{
                flex: 1,
                paddingVertical: theme.spacing.sm + 2,
                borderRadius: theme.radius.lg,
                alignItems: 'center',
                backgroundColor: theme.colors.muted,
                borderWidth: paymentMethod === 'CARD' ? 1 : 0,
                borderColor: theme.colors.primary,
              }}
            >
              <OrbixText size="sm" weight={paymentMethod === 'CARD' ? 'semibold' : 'regular'} tone={paymentMethod === 'CARD' ? 'primary' : 'foreground'}>
                {t('pos.card')}
              </OrbixText>
            </Pressable>
          </View>

          {paymentMethod === 'CASH' ? (
            <View style={{ gap: theme.spacing.xs }}>
              <OrbixInput
                value={amountReceived}
                onChangeText={setAmountReceived}
                placeholder={t('pos.amountReceivedPlaceholder')}
                keyboardType="decimal-pad"
              />
              {amountReceived ? (
                <OrbixText size="xs" tone="mutedForeground">{t('pos.change')}: {formatCurrency(change)}</OrbixText>
              ) : null}
            </View>
          ) : null}

          {createOrder.error ? (
            <OrbixText size="xs" tone="dangerFg">{toUserMessage(createOrder.error, t)}</OrbixText>
          ) : null}
        </View>
      </OrbixModal>
    </OrbixScaffold>
  );
}
