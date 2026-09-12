/**
 * Devolución: total o por líneas.
 *
 * Con líneas seleccionadas el servidor **restaura el inventario** de
 * exactamente esas unidades; sin ellas es una devolución solo de dinero. Son
 * dos operaciones distintas y la hoja lo dice, porque el efecto sobre el
 * almacén no se puede deshacer con un botón.
 *
 * Las cantidades se acotan por (vendido − ya devuelto), el mismo tope que
 * aplica el servidor: ofrecer más solo produciría un 400 tras teclearlo.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  OrbixBottomSheet,
  OrbixButton,
  OrbixInput,
  OrbixText,
  type OrbixBottomSheetRef,
} from '@/components';
import { MinusIcon, PlusIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';
import type { Order } from '@/repositories/orders-repository';
import { toUserMessage } from '@/utils/error-message';

import { useRefundOrder } from './use-order-mutations';
import { formatCurrency } from '@/features/pos/pos-totals';

/** Unidades que todavía se pueden devolver de una línea. */
export function refundableUnits(line: Order['lines'][number]): number {
  return Math.max(0, line.quantity - line.refundedQuantity);
}

/**
 * Importe de las líneas elegidas, prorrateando lo que se cobró por unidad.
 *
 * Se usa `total` de la línea —que ya lleva su impuesto y su descuento— y no el
 * precio de catálogo: devolver el precio de lista de algo vendido con descuento
 * saca del cajón más dinero del que entró.
 */
export function refundAmountOf(order: Order, selection: Record<string, number>): number {
  const total = order.lines.reduce((sum, line) => {
    const units = selection[line.id] ?? 0;
    if (units <= 0) return sum;
    const perUnit = line.quantity > 0 ? line.total / line.quantity : 0;
    return sum + perUnit * units;
  }, 0);
  return Math.round(total * 100) / 100;
}

interface RefundSheetProps {
  sheetRef: React.RefObject<OrbixBottomSheetRef | null>;
  order: Order;
  onDone: () => void;
}

export function RefundSheet({ sheetRef, order, onDone }: RefundSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [selection, setSelection] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');

  const refund = useRefundOrder(order.id);

  const lines = useMemo(
    () => order.lines.filter((line) => refundableUnits(line) > 0),
    [order.lines],
  );

  const amount = refundAmountOf(order, selection);
  const selectedUnits = Object.values(selection).reduce((sum, units) => sum + units, 0);
  const canSubmit = selectedUnits > 0 && reason.trim().length > 0;

  const setUnits = (lineId: string, units: number, max: number) => {
    const clamped = Math.max(0, Math.min(units, max));
    setSelection((current) => {
      const next = { ...current };
      if (clamped === 0) delete next[lineId];
      else next[lineId] = clamped;
      return next;
    });
  };

  const submit = () => {
    refund.mutate(
      {
        amount,
        refundMethod: order.payments[0]?.method ?? 'CASH',
        reason: reason.trim(),
        items: Object.entries(selection).map(([orderItemId, quantity]) => ({
          orderItemId,
          quantity,
        })),
      },
      {
        onSuccess: () => {
          setSelection({});
          setReason('');
          onDone();
          sheetRef.current?.close();
        },
      },
    );
  };

  return (
    <OrbixBottomSheet
      ref={sheetRef}
      title={t('orders.refund.title')}
      snapPoints={['80%']}
      keyboardBehavior="interactive"
    >
      <View style={{ gap: theme.spacing.md }}>
        {lines.length === 0 ? (
          <OrbixText size="sm" tone="mutedForeground">
            {t('orders.refund.nothingLeft')}
          </OrbixText>
        ) : (
          <>
            <OrbixText size="sm" tone="mutedForeground">
              {t('orders.refund.hint')}
            </OrbixText>

            {lines.map((line) => {
              const max = refundableUnits(line);
              const units = selection[line.id] ?? 0;
              return (
                <View
                  key={line.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    paddingVertical: theme.spacing.xs,
                  }}
                >
                  <View style={{ flex: 1, gap: 1 }}>
                    <OrbixText size="sm" numberOfLines={1}>{line.name}</OrbixText>
                    <OrbixText size="xs" tone="mutedForeground">
                      {t('orders.refund.available', { count: max })}
                      {line.refundedQuantity > 0
                        ? ` · ${t('orders.refund.alreadyReturned', { count: line.refundedQuantity })}`
                        : ''}
                    </OrbixText>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                    <Pressable
                      onPress={() => setUnits(line.id, units - 1, max)}
                      disabled={units === 0}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.back')}
                      hitSlop={8}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: theme.radius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.colors.muted,
                        opacity: units === 0 ? 0.4 : 1,
                      }}
                    >
                      <MinusIcon size={13} color={theme.colors.foreground} />
                    </Pressable>

                    <OrbixText
                      size="sm"
                      weight="bold"
                      style={{ minWidth: 22, textAlign: 'center', fontVariant: ['tabular-nums'] }}
                    >
                      {units}
                    </OrbixText>

                    <Pressable
                      onPress={() => setUnits(line.id, units + 1, max)}
                      disabled={units >= max}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.continue')}
                      hitSlop={8}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: theme.radius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.colors.muted,
                        opacity: units >= max ? 0.4 : 1,
                      }}
                    >
                      <PlusIcon size={13} color={theme.colors.foreground} />
                    </Pressable>
                  </View>
                </View>
              );
            })}

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                padding: theme.spacing.md,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.muted,
              }}
            >
              <OrbixText size="sm" weight="semibold">{t('orders.refund.amount')}</OrbixText>
              <OrbixText size="base" weight="bold" style={{ fontVariant: ['tabular-nums'] }}>
                {formatCurrency(amount)}
              </OrbixText>
            </View>

            <View style={{ gap: theme.spacing.xs }}>
              <OrbixText size="xs" weight="semibold" tone="mutedForeground">
                {t('orders.refund.reason').toUpperCase()}
              </OrbixText>
              <OrbixInput
                value={reason}
                onChangeText={setReason}
                placeholder={t('orders.refund.reasonPlaceholder')}
              />
            </View>

            {refund.error ? (
              <OrbixText size="xs" tone="dangerFg">{toUserMessage(refund.error, t)}</OrbixText>
            ) : null}

            <OrbixButton
              label={t('orders.refund.confirm')}
              onPress={submit}
              disabled={!canSubmit}
              loading={refund.isPending}
              variant="destructive"
            />
          </>
        )}
      </View>
    </OrbixBottomSheet>
  );
}
