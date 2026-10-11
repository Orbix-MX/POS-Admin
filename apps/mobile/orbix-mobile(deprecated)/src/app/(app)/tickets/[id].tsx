/**
 * Detalle del ticket, y las tres formas de deshacerlo.
 *
 * Cancelar y devolver son operaciones distintas aunque acaben pareciéndose:
 * cancelar anula la venta entera —el servidor revierte inventario, caja y
 * CxC—, devolver deshace unidades concretas. Las dos piden motivo, y las dos
 * son irreversibles, así que ambas pasan por confirmación explícita.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import {
  BackButton,
  OrbixButton,
  OrbixCard,
  OrbixInput,
  OrbixModal,
  OrbixScaffold,
  OrbixSkeleton,
  OrbixText,
  toast,
  type OrbixBottomSheetRef,
} from '@/components';
import { OrderStatusPill } from '@/features/orders/order-status-pill';
import { paymentMethodLabel } from '@/features/orders/payment-method';
import { RefundSheet } from '@/features/orders/refund-sheet';
import { useCancelOrder, useReturnOrder } from '@/features/orders/use-order-mutations';
import { useOrder } from '@/features/orders/use-orders';
import { useSendReceipt } from '@/features/pos/use-pos';
import { useCurrencyFormatVersion } from '@/hooks/use-currency-format-version';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/utils/error-message';

import { formatCurrency } from '@/features/pos/pos-totals';

type Confirming = 'cancel' | 'return' | null;

export default function TicketDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = usePermissions();
  useCurrencyFormatVersion();

  const { data: order, isLoading, error, refetch } = useOrder(id);

  const [confirming, setConfirming] = useState<Confirming>(null);
  const [reason, setReason] = useState('');
  const [email, setEmail] = useState('');
  const refundSheet = useRef<OrbixBottomSheetRef>(null);

  const cancel = useCancelOrder(id);
  const returnSale = useReturnOrder(id);
  const sendReceipt = useSendReceipt();

  /** Una venta ya anulada o devuelta entera no admite nada más. */
  const voided = order?.status === 'CANCELLED' || order?.status === 'REFUNDED';
  const hasRefundableLines =
    order?.lines.some((line) => line.quantity - line.refundedQuantity > 0) ?? false;

  const confirmAction = () => {
    const mutation = confirming === 'cancel' ? cancel : returnSale;
    mutation.mutate(
      { reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(t(confirming === 'cancel' ? 'orders.cancelled' : 'orders.returned'));
          setConfirming(null);
          setReason('');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <OrbixScaffold contentStyle={{ gap: theme.spacing.lg }}>
        <OrbixSkeleton height={220} radius={theme.radius.xl} />
      </OrbixScaffold>
    );
  }

  if (error || !order) {
    return (
      <OrbixScaffold contentStyle={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
          <OrbixText size="xl" weight="bold">{t('orders.detail.title')}</OrbixText>
        </View>
        <OrbixCard>
          <OrbixText size="sm" tone="dangerFg">
            {error ? toUserMessage(error, t) : t('orders.detail.notFound')}
          </OrbixText>
        </OrbixCard>
      </OrbixScaffold>
    );
  }

  const at = new Date(order.createdAt);

  return (
    <OrbixScaffold contentStyle={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <View style={{ flex: 1 }}>
          <OrbixText size="xs" weight="semibold" tone="mutedForeground">
            {at.toLocaleString()}
          </OrbixText>
          <OrbixText size="xl" weight="bold" accessibilityRole="header">
            {order.orderNumber}
          </OrbixText>
        </View>
        <OrderStatusPill order={order} label={(key) => t(`orders.badge.${key}`)} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        {order.cancellationReason ? (
          <OrbixCard style={{ gap: 2, borderColor: theme.colors.dangerFg, backgroundColor: theme.colors.dangerBg }}>
            <OrbixText size="sm" weight="bold" style={{ color: theme.colors.dangerFg }}>
              {t('orders.badge.cancelled')}
            </OrbixText>
            <OrbixText size="sm" style={{ color: theme.colors.dangerFg }}>
              {order.cancellationReason}
            </OrbixText>
          </OrbixCard>
        ) : null}

        {/* Líneas. */}
        <OrbixCard style={{ gap: theme.spacing.sm }}>
          {order.lines.map((line) => (
            <View key={line.id} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <OrbixText size="sm" weight="semibold" style={{ width: 28, fontVariant: ['tabular-nums'] }}>
                {line.quantity}×
              </OrbixText>
              <View style={{ flex: 1, gap: 1 }}>
                <OrbixText size="sm" numberOfLines={2}>{line.name}</OrbixText>
                {line.refundedQuantity > 0 ? (
                  <OrbixText size="xs" tone="warningFg">
                    {t('orders.refund.alreadyReturned', { count: line.refundedQuantity })}
                  </OrbixText>
                ) : null}
              </View>
              <OrbixText size="sm" style={{ fontVariant: ['tabular-nums'] }}>
                {formatCurrency(line.total)}
              </OrbixText>
            </View>
          ))}

          <View style={{ height: 1, backgroundColor: theme.colors.border, marginTop: 4 }} />

          <TotalRow label={t('pos.subtotal')} value={formatCurrency(order.subtotal)} />
          {order.discount > 0 ? (
            <TotalRow label={t('orders.detail.discount')} value={`− ${formatCurrency(order.discount)}`} />
          ) : null}
          <TotalRow label={t('pos.tax')} value={formatCurrency(order.tax)} />
          <TotalRow label={t('pos.total')} value={formatCurrency(order.total)} strong />
          {order.refundedAmount > 0 ? (
            <TotalRow
              label={t('orders.detail.refunded')}
              value={`− ${formatCurrency(order.refundedAmount)}`}
              tone="dangerFg"
            />
          ) : null}
        </OrbixCard>

        {/* Pagos. */}
        {order.payments.length > 0 ? (
          <OrbixCard style={{ gap: theme.spacing.sm }}>
            <OrbixText size="xs" weight="semibold" tone="mutedForeground">
              {t('orders.detail.payments').toUpperCase()}
            </OrbixText>
            {order.payments.map((payment) => (
              <View key={payment.id} style={{ gap: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <OrbixText size="sm">{paymentMethodLabel(payment.method, t)}</OrbixText>
                  <OrbixText size="sm" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatCurrency(payment.amount)}
                  </OrbixText>
                </View>
                {payment.changeGiven != null && payment.changeGiven > 0 ? (
                  <OrbixText size="xs" tone="mutedForeground">
                    {t('pos.change')}: {formatCurrency(payment.changeGiven)}
                  </OrbixText>
                ) : null}
              </View>
            ))}
          </OrbixCard>
        ) : null}

        {/* Reenviar comprobante. */}
        <OrbixCard style={{ gap: theme.spacing.sm }}>
          <OrbixText size="xs" weight="semibold" tone="mutedForeground">
            {t('orders.detail.resend').toUpperCase()}
          </OrbixText>
          <OrbixInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('pos.receiptEmailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <OrbixButton
            label={t('pos.sendReceipt')}
            variant="secondary"
            disabled={!email.trim()}
            loading={sendReceipt.isPending}
            onPress={() =>
              sendReceipt.mutate(
                { orderId: order.id, email: email.trim() },
                {
                  onSuccess: () => {
                    toast.success(t('pos.receiptSent'));
                    setEmail('');
                  },
                },
              )
            }
          />
        </OrbixCard>

        {/* Deshacer. Solo con permiso, y solo si queda algo que deshacer. */}
        {!voided ? (
          <View style={{ gap: theme.spacing.sm }}>
            {can('refunds:create') && hasRefundableLines ? (
              <OrbixButton
                label={t('orders.refund.title')}
                variant="secondary"
                onPress={() => refundSheet.current?.expand()}
              />
            ) : null}
            {can('orders:edit') ? (
              <>
                <OrbixButton
                  label={t('orders.returnAll')}
                  variant="outline"
                  onPress={() => setConfirming('return')}
                />
                <OrbixButton
                  label={t('orders.cancel')}
                  variant="destructive"
                  onPress={() => setConfirming('cancel')}
                />
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Motivo obligatorio: el servidor lo exige y queda en la bitácora. */}
      <OrbixModal
        visible={confirming !== null}
        title={t(confirming === 'cancel' ? 'orders.cancelConfirmTitle' : 'orders.returnConfirmTitle')}
        description={t(
          confirming === 'cancel' ? 'orders.cancelConfirmDescription' : 'orders.returnConfirmDescription',
          { number: order.orderNumber },
        )}
        confirmLabel={t(confirming === 'cancel' ? 'orders.cancel' : 'orders.returnAll')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={cancel.isPending || returnSale.isPending}
        confirmDisabled={!reason.trim()}
        onConfirm={confirmAction}
        onDismiss={() => {
          setConfirming(null);
          setReason('');
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <OrbixInput
            value={reason}
            onChangeText={setReason}
            placeholder={t('orders.reasonPlaceholder')}
          />
          {cancel.error || returnSale.error ? (
            <OrbixText size="xs" tone="dangerFg">
              {toUserMessage(cancel.error ?? returnSale.error, t)}
            </OrbixText>
          ) : null}
        </View>
      </OrbixModal>

      <RefundSheet sheetRef={refundSheet} order={order} onDone={() => void refetch()} />
    </OrbixScaffold>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'dangerFg';
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <OrbixText size="sm" tone={strong ? 'foreground' : 'mutedForeground'} weight={strong ? 'bold' : 'regular'}>
        {label}
      </OrbixText>
      <OrbixText
        size={strong ? 'base' : 'sm'}
        weight={strong ? 'bold' : 'medium'}
        tone={tone}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </OrbixText>
    </View>
  );
}
