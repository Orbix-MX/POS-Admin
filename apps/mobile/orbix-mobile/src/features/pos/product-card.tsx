/**
 * Two-per-row product tile for the POS grid.
 *
 * Tapping anywhere on the tile adds one unit — the small `+` affordance is the
 * visual anchor from the prototype, not the only hit target, which matters on a
 * counter device where the operator taps fast and imprecisely.
 */
import { memo, useCallback } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';

import { OrbixGradient, OrbixText } from '@/components';
import { Ripple, useRipple } from '@/components/animations/ripple';
import { PackageIcon, PlusIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';
import type { Product } from '@/repositories/products-repository';

import { formatCurrency } from './pos-totals';

interface ProductCardProps {
  product: Product;
  /** Units of this product already in the cart. */
  quantity: number;
  onAdd: (product: Product) => void;
  labels: { lowStock: string; outOfStock: string };
}

function ProductCardComponent({ product, quantity, onAdd, labels }: ProductCardProps) {
  const theme = useTheme();
  const ripple = useRipple();

  const inCart = quantity > 0;
  const outOfStock = product.trackInventory && product.stock <= 0;
  const lowStock =
    product.trackInventory && !outOfStock && product.stock <= product.lowStockAlert;

  const handleAdd = useCallback(() => {
    if (!outOfStock) onAdd(product);
  }, [onAdd, outOfStock, product]);

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (outOfStock) return;
      ripple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY);
    },
    [outOfStock, ripple],
  );

  const subtitle = outOfStock
    ? labels.outOfStock
    : product.trackInventory
      ? `${product.stock}`
      : product.sku;

  return (
    <Pressable
      onPress={handleAdd}
      onPressIn={handlePressIn}
      disabled={outOfStock}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatCurrency(product.price)}`}
      accessibilityState={{ disabled: outOfStock }}
      // Objeto estático + `Ripple`, no la forma `style={({pressed}) => …}`:
      // con nativewind + React Compiler esa forma descarta el estilo en
      // silencio (ver `google-button.tsx`), y aquí se llevaba por delante el
      // fondo, el borde y el radio de la tarjeta.
      style={{
        flex: 1,
        gap: 9,
        padding: 10,
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: inCart ? theme.colors.accentPurple : theme.colors.border,
        opacity: outOfStock ? 0.5 : 1,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'relative',
          height: 74,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.muted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PackageIcon size={24} color={theme.colors.mutedForeground} />

        {lowStock ? (
          <View
            style={{
              position: 'absolute',
              top: 7,
              left: 7,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.warningBg,
            }}
          >
            <OrbixText size="xs" weight="bold" tone="warningFg">
              {labels.lowStock}
            </OrbixText>
          </View>
        ) : null}

        {inCart ? (
          <OrbixGradient
            variant="primary"
            style={{
              position: 'absolute',
              top: 7,
              right: 7,
              minWidth: 19,
              height: 19,
              paddingHorizontal: 5,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <OrbixText size="xs" weight="bold" tone="onDark">
              {String(quantity)}
            </OrbixText>
          </OrbixGradient>
        ) : null}
      </View>

      <View style={{ gap: 2, paddingHorizontal: 2 }}>
        <OrbixText size="sm" weight="semibold" numberOfLines={2}>
          {product.name}
        </OrbixText>
        <OrbixText size="xs" tone="mutedForeground" numberOfLines={1}>
          {subtitle}
        </OrbixText>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          paddingHorizontal: 2,
        }}
      >
        <OrbixText size="md" weight="bold">
          {formatCurrency(product.price)}
        </OrbixText>

        {inCart ? (
          <OrbixGradient
            variant="primary"
            style={{ width: 28, height: 28, borderRadius: theme.radius.full, alignItems: 'center', justifyContent: 'center' }}
          >
            <PlusIcon size={14} color={theme.colors.onDark} />
          </OrbixGradient>
        ) : (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: outOfStock ? theme.colors.muted : theme.colors.foreground,
            }}
          >
            <PlusIcon size={14} color={outOfStock ? theme.colors.mutedForeground : theme.colors.card} />
          </View>
        )}
      </View>

      {outOfStock ? null : (
        <Ripple {...ripple} color={theme.colors.primary} borderRadius={theme.radius.xl} />
      )}
    </Pressable>
  );
}

export const ProductCard = memo(ProductCardComponent);
