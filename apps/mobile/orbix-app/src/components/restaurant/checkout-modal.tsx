import { useState, useMemo, useCallback } from 'react';
import { Modal, Pressable, View, TextInput, ActivityIndicator, Alert } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import {
  checkoutDiningOrder,
  type DiningOrder,
  type DiningPaymentMethod,
} from '@/services/restaurant-service';
import { getApiErrorMessage } from '@/services/api-client';

const METHODS: { key: DiningPaymentMethod; label: string }[] = [
  { key: 'CASH', label: 'Efectivo' },
  { key: 'CARD', label: 'Tarjeta' },
  { key: 'TRANSFER', label: 'Transferencia' },
];

const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

interface CheckoutModalProps {
  visible: boolean;
  order: DiningOrder | null;
  branchId: string;
  onClose: () => void;
  onPaid: () => void;
}

/**
 * Charge a dining order. Picks a payment method, captures the cash received (for
 * change), and calls the backend checkout — which generates the financial Order,
 * consumes inventory and records the payment, exactly like POS / Restaurant Web.
 */
export function CheckoutModal({ visible, order, branchId, onClose, onPaid }: CheckoutModalProps) {
  const theme = useTheme();
  const [method, setMethod] = useState<DiningPaymentMethod>('CASH');
  const [received, setReceived] = useState('');
  const [sending, setSending] = useState(false);

  const total = useMemo(
    () => (order ? order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0) : 0),
    [order],
  );

  const receivedNum = Number(received.replace(',', '.')) || 0;
  const change = method === 'CASH' && receivedNum > total ? receivedNum - total : 0;
  // Cash requires covering the total; card/transfer settle the exact amount.
  const canCharge = !sending && total > 0 && (method !== 'CASH' || receivedNum >= total);

  const reset = useCallback(() => {
    setMethod('CASH');
    setReceived('');
  }, []);

  const handleClose = useCallback(() => {
    if (sending) return;
    reset();
    onClose();
  }, [sending, reset, onClose]);

  const handleCharge = useCallback(() => {
    if (!order || !canCharge) return;
    setSending(true);
    (async () => {
      try {
        await checkoutDiningOrder(branchId, order.id, [
          {
            paymentMethod: method,
            amount: total,
            ...(method === 'CASH' && receivedNum > 0
              ? { amountReceived: receivedNum, changeGiven: change }
              : {}),
          },
        ]);
        reset();
        onPaid();
      } catch (e) {
        Alert.alert('No se pudo cobrar', getApiErrorMessage(e, 'Intenta de nuevo.'));
      } finally {
        setSending(false);
      }
    })();
  }, [order, canCharge, branchId, method, total, receivedNum, change, reset, onPaid]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={handleClose}
      >
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

          <View>
            <Text variant="h2">Cobrar</Text>
            <Text variant="small" tone="secondary" style={{ marginTop: theme.spacing.xs }}>
              {order?.reference ?? order?.table?.name ?? 'Cuenta'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="label" tone="secondary">Total</Text>
            <Text variant="h2">{formatCurrency(total)}</Text>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="secondary">Método de pago</Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              {METHODS.map((m) => {
                const active = method === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMethod(m.key)}
                    style={{
                      flex: 1,
                      backgroundColor: active ? theme.colors.primarySoft : theme.colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: active ? theme.colors.primary : 'transparent',
                      borderRadius: theme.radius.lg,
                      paddingVertical: theme.spacing.md,
                      alignItems: 'center',
                    }}
                  >
                    <Text variant="small" style={{ color: active ? theme.colors.primary : theme.colors.text, fontWeight: active ? '700' : '500' }}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {method === 'CASH' && (
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="label" tone="secondary">Recibido</Text>
              <TextInput
                value={received}
                onChangeText={setReceived}
                placeholder={formatCurrency(total)}
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: theme.colors.surfaceMuted,
                  borderRadius: theme.radius.lg,
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  fontSize: 16,
                  color: theme.colors.text,
                }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="small" tone="secondary">Cambio</Text>
                <Text variant="small" style={{ fontWeight: '700' }}>{formatCurrency(change)}</Text>
              </View>
            </View>
          )}

          <Pressable
            onPress={handleCharge}
            disabled={!canCharge}
            style={({ pressed }) => ({
              backgroundColor: pressed ? theme.colors.primaryStrong : theme.colors.primary,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg,
              alignItems: 'center',
              opacity: canCharge ? 1 : 0.5,
            })}
          >
            {sending
              ? <ActivityIndicator color={theme.colors.onPrimary} />
              : <Text variant="body" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>Cobrar {formatCurrency(total)}</Text>
            }
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
