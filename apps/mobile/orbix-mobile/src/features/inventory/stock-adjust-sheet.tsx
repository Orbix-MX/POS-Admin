/**
 * Ajustar la existencia de un producto.
 *
 * La UI pregunta **cuánto entra o cuánto sale**, no cuánta hay: el servidor
 * recibe un delta, y pedir el total obligaría a restar mentalmente — que es
 * justo donde se cuelan los errores al recibir mercancía a las siete de la
 * mañana. El resultado se muestra siempre (`actual → nuevo`), para que nadie
 * tenga que fiarse del signo.
 */
import { useEffect, useMemo, useState } from 'react';
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
import type { Product } from '@/repositories/products-repository';
import { toUserMessage } from '@/utils/error-message';

import { stockAdjustmentBlocker, useAdjustStock } from './use-stock-adjustment';

type Direction = 'in' | 'out';

/** Solo enteros: no se reciben 2.5 unidades de nada que se cuente por pieza. */
function parseUnits(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits === '' ? NaN : Number(digits);
}

interface StockAdjustSheetProps {
  sheetRef: React.RefObject<OrbixBottomSheetRef | null>;
  product: Product;
  onDone?: () => void;
}

export function StockAdjustSheet({ sheetRef, product, onDone }: StockAdjustSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [direction, setDirection] = useState<Direction>('in');
  const [units, setUnits] = useState('');
  const [variantId, setVariantId] = useState<string | undefined>(undefined);

  const adjust = useAdjustStock(product.id);
  const blocker = stockAdjustmentBlocker(product);

  const hasVariants = product.variants.length > 0;

  // Con presentaciones hay que elegir una: el ajuste cae sobre la variante, no
  // sobre un total que no existe.
  useEffect(() => {
    if (hasVariants && !variantId) setVariantId(product.variants[0]?.id);
  }, [hasVariants, variantId, product.variants]);

  const selectedVariant = useMemo(
    () => product.variants.find((variant) => variant.id === variantId),
    [product.variants, variantId],
  );

  const current = selectedVariant?.stock ?? product.stock;
  const amount = parseUnits(units);
  const delta = Number.isFinite(amount) ? (direction === 'in' ? amount : -amount) : 0;
  const next = current + delta;

  const insufficient = direction === 'out' && Number.isFinite(amount) && next < 0;
  const canSubmit = Number.isFinite(amount) && amount > 0 && !insufficient && !blocker;

  const submit = () => {
    adjust.mutate(
      { quantity: delta, ...(selectedVariant ? { variantId: selectedVariant.id } : {}) },
      {
        onSuccess: () => {
          setUnits('');
          onDone?.();
          sheetRef.current?.close();
        },
      },
    );
  };

  return (
    <OrbixBottomSheet
      ref={sheetRef}
      title={t('inventory.adjust.title')}
      keyboardBehavior="interactive"
    >
      <View style={{ gap: theme.spacing.md }}>
        {blocker ? (
          <OrbixText size="sm" tone="mutedForeground">
            {t(
              blocker === 'untracked'
                ? 'inventory.adjust.untracked'
                : 'inventory.adjust.unsupportedType',
            )}
          </OrbixText>
        ) : (
          <>
            {/* Presentación, cuando el producto se dividió en varias. */}
            {hasVariants ? (
              <View style={{ gap: theme.spacing.xs }}>
                <OrbixText size="xs" weight="semibold" tone="mutedForeground">
                  {t('inventory.adjust.variant').toUpperCase()}
                </OrbixText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                  {product.variants.map((variant) => {
                    const active = variant.id === variantId;
                    return (
                      <Pressable
                        key={variant.id}
                        onPress={() => setVariantId(variant.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={{
                          paddingHorizontal: theme.spacing.md,
                          paddingVertical: 8,
                          borderRadius: theme.radius.full,
                          borderWidth: 1.5,
                          borderColor: active ? theme.colors.accentPurple : theme.colors.border,
                          backgroundColor: active ? theme.colors.secondary : theme.colors.card,
                        }}
                      >
                        <OrbixText size="sm" weight={active ? 'semibold' : 'regular'}>
                          {variant.name} · {variant.stock}
                        </OrbixText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Entra / sale, en vez de pedir el total y obligar a restar. */}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              {(['in', 'out'] as const).map((value) => {
                const active = direction === value;
                const Icon = value === 'in' ? PlusIcon : MinusIcon;
                const tint = value === 'in' ? theme.colors.successFg : theme.colors.dangerFg;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setDirection(value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 12,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1.5,
                      borderColor: active ? tint : theme.colors.border,
                      backgroundColor: active
                        ? value === 'in'
                          ? theme.colors.successBg
                          : theme.colors.dangerBg
                        : theme.colors.card,
                    }}
                  >
                    <Icon size={15} color={active ? tint : theme.colors.mutedForeground} />
                    <OrbixText size="sm" weight="semibold" style={active ? { color: tint } : undefined}>
                      {t(value === 'in' ? 'inventory.adjust.in' : 'inventory.adjust.out')}
                    </OrbixText>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ gap: theme.spacing.xs }}>
              <OrbixText size="xs" weight="semibold" tone="mutedForeground">
                {t('inventory.adjust.units').toUpperCase()}
              </OrbixText>
              <OrbixInput
                value={units}
                onChangeText={(value) => setUnits(value.replace(/\D/g, ''))}
                placeholder="0"
                keyboardType="number-pad"
                hasError={insufficient}
              />
            </View>

            {/* El resultado, siempre: nadie debería fiarse del signo. */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                padding: theme.spacing.md,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.muted,
              }}
            >
              <OrbixText size="sm" tone="mutedForeground">
                {t('inventory.adjust.result')}
              </OrbixText>
              <OrbixText size="sm" weight="bold" style={{ fontVariant: ['tabular-nums'] }}>
                {current} → {Number.isFinite(amount) ? next : current}
              </OrbixText>
            </View>

            {insufficient ? (
              <OrbixText size="xs" tone="dangerFg">
                {t('inventory.adjust.insufficient')}
              </OrbixText>
            ) : null}

            {adjust.error ? (
              <OrbixText size="xs" tone="dangerFg">
                {toUserMessage(adjust.error, t)}
              </OrbixText>
            ) : null}

            <OrbixButton
              label={t('inventory.adjust.confirm')}
              onPress={submit}
              disabled={!canSubmit}
              loading={adjust.isPending}
            />
          </>
        )}
      </View>
    </OrbixBottomSheet>
  );
}
