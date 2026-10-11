/**
 * Estado de una venta, legible de un vistazo.
 *
 * Dos ejes distintos que el servidor guarda por separado: `status` (dónde está
 * la venta) y `paymentStatus` (cómo está el dinero). Se pinta el que aporta
 * información — una venta CONFIRMED y PAID es lo normal y no necesita etiqueta;
 * una cancelada o una devuelta a medias sí.
 */
import { memo } from 'react';
import { View } from 'react-native';

import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';
import type { Order } from '@/repositories/orders-repository';
import type { ThemeColors } from '@/theme/types';

type Tone = { bg: keyof ThemeColors; fg: keyof ThemeColors };

/**
 * Union cerrada, no `string`: es lo que hace que el esquema tipado de i18n
 * pueda comprobar `orders.badge.${key}` en tiempo de compilación.
 */
export type OrderBadgeKey =
  | 'cancelled'
  | 'refunded'
  | 'partiallyRefunded'
  | 'partiallyPaid'
  | 'unpaid'
  | 'failed'
  | 'layaway'
  | 'pending';

const NEUTRAL: Tone = { bg: 'neutralBg', fg: 'neutralFg' };
const DANGER: Tone = { bg: 'dangerBg', fg: 'dangerFg' };
const WARNING: Tone = { bg: 'warningBg', fg: 'warningFg' };
const SUCCESS: Tone = { bg: 'successBg', fg: 'successFg' };

/**
 * Qué decir de esta venta, o `null` si no hay nada que añadir.
 *
 * El orden importa: cancelada gana sobre cualquier estado de pago, y una
 * devolución parcial es más informativa que "pagada".
 */
export function orderBadge(order: Order): { key: OrderBadgeKey; tone: Tone } | null {
  if (order.status === 'CANCELLED') return { key: 'cancelled', tone: DANGER };
  if (order.status === 'REFUNDED' || order.paymentStatus === 'REFUNDED') {
    return { key: 'refunded', tone: DANGER };
  }
  if (order.paymentStatus === 'PARTIALLY_REFUNDED') return { key: 'partiallyRefunded', tone: WARNING };
  if (order.paymentStatus === 'PARTIALLY_PAID') return { key: 'partiallyPaid', tone: WARNING };
  if (order.paymentStatus === 'PENDING') return { key: 'unpaid', tone: NEUTRAL };
  if (order.paymentStatus === 'FAILED') return { key: 'failed', tone: DANGER };
  if (order.status === 'LAYAWAY') return { key: 'layaway', tone: NEUTRAL };
  // CONFIRMED + PAID: la venta normal. Una etiqueta aquí sería ruido en cada fila.
  if (order.paymentStatus === 'PAID') return null;
  return { key: 'pending', tone: SUCCESS };
}

interface OrderStatusPillProps {
  order: Order;
  /** `t(\`orders.badge.${key}\`)`, resuelto por quien llama. */
  label: (key: OrderBadgeKey) => string;
}

function OrderStatusPillComponent({ order, label }: OrderStatusPillProps) {
  const theme = useTheme();
  const badge = orderBadge(order);

  if (!badge) return null;

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors[badge.tone.bg],
      }}
    >
      <OrbixText size="xs" weight="semibold" style={{ color: theme.colors[badge.tone.fg] }}>
        {label(badge.key)}
      </OrbixText>
    </View>
  );
}

export const OrderStatusPill = memo(OrderStatusPillComponent);
