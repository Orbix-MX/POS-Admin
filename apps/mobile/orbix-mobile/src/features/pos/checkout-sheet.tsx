/**
 * Checkout bottom sheet — cart → processing → done, as three stages of one
 * surface so the operator never loses the sale's context mid-payment.
 *
 * Built on RN's `Modal` rather than `OrbixBottomSheet`: this sheet owns a
 * scrolling body *and* a pinned footer, and it must stay put while the sale is
 * in flight (no swipe-to-dismiss during `processing`), neither of which the
 * gorhom wrapper exposes.
 */
import { memo, useCallback, useEffect } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AnimatedSuccessCheck, OrbixButton, OrbixGradient, OrbixInput, OrbixSpinner, OrbixText } from '@/components';
import { MinusIcon, PackageIcon, PlusIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';
import type { Order } from '@/repositories/pos-repository';

import { formatCurrency, type CartLine, type CartTotals } from './pos-totals';

export type CheckoutStage = 'cart' | 'processing' | 'done';
export type PosPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

export interface PaymentOption {
  id: PosPaymentMethod;
  label: string;
}

interface CheckoutSheetProps {
  visible: boolean;
  stage: CheckoutStage;
  lines: CartLine[];
  totals: CartTotals;
  paymentMethod: PosPaymentMethod;
  paymentOptions: PaymentOption[];
  onSelectPayment: (method: PosPaymentMethod) => void;
  amountReceived: string;
  onChangeAmountReceived: (value: string) => void;
  change: number;
  receiptEmail: string;
  onChangeReceiptEmail: (value: string) => void;
  onSendReceipt: () => void;
  sendingReceipt: boolean;
  receiptSent: boolean;
  order: Order | null;
  errorMessage: string | null;
  canConfirm: boolean;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  onNewSale: () => void;
  labels: {
    summary: string;
    close: string;
    subtotal: string;
    tax: string;
    total: string;
    paymentMethod: string;
    completeSale: string;
    processingPayment: string;
    saleDone: string;
    folio: string;
    newSale: string;
    sendReceipt: string;
    receiptEmailPlaceholder: string;
    receiptSent: string;
    amountReceivedPlaceholder: string;
    change: string;
  };
}

interface LineRowProps {
  line: CartLine;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
}

function LineRow({ line, onIncrement, onDecrement }: LineRowProps) {
  const theme = useTheme();
  const handleInc = useCallback(() => onIncrement(line.productId), [line.productId, onIncrement]);
  const handleDec = useCallback(() => onDecrement(line.productId), [line.productId, onDecrement]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.muted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PackageIcon size={17} color={theme.colors.mutedForeground} />
      </View>

      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <OrbixText size="base" weight="semibold" numberOfLines={1}>
          {line.name}
        </OrbixText>
        <OrbixText size="xs" tone="mutedForeground">
          {formatCurrency(line.price)}
        </OrbixText>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          onPress={handleDec}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`−1 ${line.name}`}
          style={{
            width: 26,
            height: 26,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MinusIcon size={13} color={theme.colors.foreground} />
        </Pressable>

        <OrbixText size="base" weight="bold" style={{ minWidth: 16, textAlign: 'center' }}>
          {String(line.quantity)}
        </OrbixText>

        <Pressable
          onPress={handleInc}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`+1 ${line.name}`}
        >
          <OrbixGradient
            variant="primary"
            style={{ width: 26, height: 26, borderRadius: theme.radius.full, alignItems: 'center', justifyContent: 'center' }}
          >
            <PlusIcon size={13} color={theme.colors.onDark} />
          </OrbixGradient>
        </Pressable>
      </View>

      <OrbixText size="base" weight="bold" style={{ width: 72, textAlign: 'right' }}>
        {formatCurrency(line.price * line.quantity)}
      </OrbixText>
    </View>
  );
}

function CheckoutSheetComponent(props: CheckoutSheetProps) {
  const theme = useTheme();
  const {
    visible,
    stage,
    lines,
    totals,
    paymentMethod,
    paymentOptions,
    onSelectPayment,
    amountReceived,
    onChangeAmountReceived,
    change,
    receiptEmail,
    onChangeReceiptEmail,
    onSendReceipt,
    sendingReceipt,
    receiptSent,
    order,
    errorMessage,
    canConfirm,
    onIncrement,
    onDecrement,
    onConfirm,
    onClose,
    onNewSale,
    labels,
  } = props;

  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(visible ? 1 : 0, { duration: visible ? 280 : 160 });
  }, [enter, visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - enter.value) * 480 }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: enter.value }));

  /** Only the cart stage is dismissible — a sale in flight must not be swiped away. */
  const dismissible = stage === 'cart';
  const handleBackdrop = useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);

  // The server's figures are authoritative once the sale exists.
  const doneTotal = order ? formatCurrency(order.total) : formatCurrency(totals.total);
  const paymentLabel = paymentOptions.find((o) => o.id === paymentMethod)?.label ?? '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      // Without this the modal window stops above the system navigation bar,
      // leaving a strip of the dimmed screen under the sheet.
      navigationBarTranslucent
      onRequestClose={handleBackdrop}
    >
      <View style={{ flex: 1 }}>
        <Animated.View
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,14,26,0.42)' },
            backdropStyle,
          ]}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={handleBackdrop}
            accessibilityRole="button"
            accessibilityLabel={labels.close}
            disabled={!dismissible}
          />
        </Animated.View>

        {/*
          `flex: 1` + `flex-end` rather than letting this size to its content:
          an auto-height wrapper leaves the sheet floating above the window
          bottom, exposing a band of the dimmed screen beneath it.
        */}
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View
            style={[
              {
                maxHeight: '86%',
                backgroundColor: theme.colors.card,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                overflow: 'hidden',
              },
              sheetStyle,
            ]}
          >
            {stage === 'cart' ? (
              <View style={{ flexShrink: 1 }}>
                <View
                  style={{
                    paddingTop: 10,
                    paddingBottom: 12,
                    paddingHorizontal: theme.spacing.xl,
                    alignItems: 'center',
                    gap: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border,
                  }}
                >
                  <View style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: theme.colors.border }} />
                  <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <OrbixText size="xl" weight="bold">
                      {labels.summary}
                    </OrbixText>
                    <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
                      <OrbixText size="sm" weight="semibold" tone="mutedForeground">
                        {labels.close}
                      </OrbixText>
                    </Pressable>
                  </View>
                </View>

                <ScrollView
                  style={{ flexShrink: 1 }}
                  contentContainerStyle={{ paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {lines.map((line) => (
                    <LineRow
                      key={line.productId}
                      line={line}
                      onIncrement={onIncrement}
                      onDecrement={onDecrement}
                    />
                  ))}

                  <View style={{ gap: 7, paddingTop: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <OrbixText size="sm" tone="mutedForeground">{labels.subtotal}</OrbixText>
                      <OrbixText size="sm" tone="mutedForeground">{formatCurrency(totals.subtotal)}</OrbixText>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <OrbixText size="sm" tone="mutedForeground">{labels.tax}</OrbixText>
                      <OrbixText size="sm" tone="mutedForeground">{formatCurrency(totals.tax)}</OrbixText>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderTopColor: theme.colors.border,
                      }}
                    >
                      <OrbixText size="md" weight="bold">{labels.total}</OrbixText>
                      <OrbixText size="2xl" weight="extrabold">{formatCurrency(totals.total)}</OrbixText>
                    </View>
                  </View>

                  <View style={{ gap: 8, paddingTop: 16 }}>
                    <OrbixText size="xs" weight="semibold" tone="mutedForeground">
                      {labels.paymentMethod.toUpperCase()}
                    </OrbixText>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {paymentOptions.map((option) => {
                        const active = option.id === paymentMethod;
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => onSelectPayment(option.id)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            style={{
                              flex: 1,
                              alignItems: 'center',
                              gap: 5,
                              paddingVertical: 11,
                              paddingHorizontal: 6,
                              borderRadius: theme.radius.lg,
                              borderWidth: 1.5,
                              borderColor: active ? theme.colors.accentPurple : theme.colors.border,
                              backgroundColor: active ? theme.colors.secondary : theme.colors.card,
                            }}
                          >
                            <OrbixText size="sm" weight="semibold">{option.label}</OrbixText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {paymentMethod === 'CASH' ? (
                    <View style={{ gap: theme.spacing.xs, paddingTop: theme.spacing.md }}>
                      <OrbixInput
                        value={amountReceived}
                        onChangeText={onChangeAmountReceived}
                        placeholder={labels.amountReceivedPlaceholder}
                        keyboardType="decimal-pad"
                      />
                      {amountReceived ? (
                        <OrbixText size="xs" tone="mutedForeground">
                          {labels.change}: {formatCurrency(change)}
                        </OrbixText>
                      ) : null}
                    </View>
                  ) : null}

                  {errorMessage ? (
                    <OrbixText size="xs" tone="dangerFg" style={{ paddingTop: theme.spacing.sm }}>
                      {errorMessage}
                    </OrbixText>
                  ) : null}
                </ScrollView>

                <View
                  style={{
                    paddingHorizontal: theme.spacing.xl,
                    paddingTop: 14,
                    paddingBottom: theme.spacing.lg,
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.border,
                  }}
                >
                  <OrbixButton
                    label={`${labels.completeSale} · ${formatCurrency(totals.total)}`}
                    onPress={onConfirm}
                    disabled={!canConfirm}
                  />
                </View>
              </View>
            ) : null}

            {stage === 'processing' ? (
              <View style={{ paddingVertical: 64, paddingHorizontal: 28, alignItems: 'center', gap: 16 }}>
                <OrbixSpinner size={34} color={theme.colors.accentPurple} />
                <View style={{ gap: 4, alignItems: 'center' }}>
                  <OrbixText size="lg" weight="bold">{labels.processingPayment}</OrbixText>
                  <OrbixText size="sm" tone="mutedForeground">
                    {paymentLabel} · {formatCurrency(totals.total)}
                  </OrbixText>
                </View>
              </View>
            ) : null}

            {stage === 'done' ? (
              <View
                style={{
                  paddingTop: 44,
                  paddingHorizontal: 28,
                  paddingBottom: theme.spacing.lg,
                  alignItems: 'center',
                  gap: 18,
                }}
              >
                <OrbixGradient
                  variant="primary"
                  style={{ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' }}
                >
                  <AnimatedSuccessCheck size={36} color={theme.colors.onDark} />
                </OrbixGradient>

                <View style={{ gap: 5, alignItems: 'center' }}>
                  <OrbixText size="2xl" weight="extrabold">{labels.saleDone}</OrbixText>
                  <OrbixText size="base" tone="mutedForeground" align="center">
                    {doneTotal} · {paymentLabel}
                    {order ? ` · ${labels.folio} ${order.orderNumber}` : ''}
                  </OrbixText>
                </View>

                <View style={{ width: '100%', gap: 8 }}>
                  <OrbixButton label={labels.newSale} onPress={onNewSale} />

                  {receiptSent ? (
                    <OrbixText size="sm" tone="successFg" align="center">
                      {labels.receiptSent}
                    </OrbixText>
                  ) : (
                    <>
                      <OrbixInput
                        value={receiptEmail}
                        onChangeText={onChangeReceiptEmail}
                        placeholder={labels.receiptEmailPlaceholder}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <OrbixButton
                        label={labels.sendReceipt}
                        variant="outline"
                        onPress={onSendReceipt}
                        loading={sendingReceipt}
                        disabled={!receiptEmail.trim() || !order}
                      />
                    </>
                  )}
                </View>
              </View>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export const CheckoutSheet = memo(CheckoutSheetComponent);
