/**
 * Los movimientos del turno, del más reciente al más antiguo.
 *
 * Agrupados por tipo y no en una lista plana: al cuadrar un cajón se busca
 * "¿cuánto salió en gastos?", no el orden cronológico. El servidor ya los
 * devuelve ordenados por fecha descendente dentro de la sesión.
 */
import { memo } from 'react';
import { View } from 'react-native';

import { OrbixCard } from '@/components/cards/orbix-card';
import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';
import type { CashMovement } from '@/repositories/cash-repository';
import type { CashMovementType } from '@/types/api';

import { formatCurrency } from '@/features/pos/pos-totals';

/** Signo del movimiento sobre el cajón. Decide color y prefijo. */
const OUTFLOW: ReadonlySet<CashMovementType> = new Set(['EXPENSE', 'WITHDRAWAL', 'REFUND']);

/** Orden de lectura del corte: primero lo que entró, luego lo que salió. */
const TYPE_ORDER: readonly CashMovementType[] = [
  'SALE',
  'CXC_PAYMENT',
  'INCOME',
  'EXPENSE',
  'WITHDRAWAL',
  'REFUND',
  'SUPPLIER_PAYMENT',
];

export interface MovementsListLabels {
  title: string;
  empty: string;
  /** `cash.movementType.*`, ya resuelto por quien llama. */
  typeName: (type: CashMovementType) => string;
}

function timeOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function MovementRow({ movement }: { movement: CashMovement }) {
  const theme = useTheme();
  const isOut = OUTFLOW.has(movement.type);
  const isUsd = movement.currency.toUpperCase() === 'USD';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <OrbixText size="sm" numberOfLines={1}>
          {movement.notes?.trim() || timeOf(movement.createdAt)}
        </OrbixText>
        <OrbixText size="xs" tone="mutedForeground">
          {timeOf(movement.createdAt)}
          {movement.paymentMethod !== 'CASH' ? ` · ${movement.paymentMethod}` : ''}
        </OrbixText>
      </View>
      <OrbixText
        size="sm"
        weight="semibold"
        tone={isOut ? 'dangerFg' : 'successFg'}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {isOut ? '−' : '+'}{' '}
        {isUsd ? `${movement.amount.toFixed(2)} USD` : formatCurrency(movement.amount)}
      </OrbixText>
    </View>
  );
}

interface MovementsListProps {
  movements: CashMovement[];
  labels: MovementsListLabels;
}

function MovementsListComponent({ movements, labels }: MovementsListProps) {
  const theme = useTheme();

  if (movements.length === 0) {
    return (
      <OrbixCard>
        <OrbixText size="sm" tone="mutedForeground" align="center">
          {labels.empty}
        </OrbixText>
      </OrbixCard>
    );
  }

  const byType = TYPE_ORDER.map((type) => ({
    type,
    items: movements.filter((movement) => movement.type === type),
  })).filter((group) => group.items.length > 0);

  return (
    <View style={{ gap: theme.spacing.md }}>
      <OrbixText size="xs" weight="semibold" tone="mutedForeground">
        {labels.title.toUpperCase()}
      </OrbixText>

      {byType.map((group) => (
        <OrbixCard key={group.type} style={{ gap: 2 }}>
          <OrbixText size="xs" weight="semibold" tone="mutedForeground">
            {labels.typeName(group.type)}
          </OrbixText>
          {group.items.map((movement, index) => (
            <View key={movement.id}>
              {index > 0 ? (
                <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              ) : null}
              <MovementRow movement={movement} />
            </View>
          ))}
        </OrbixCard>
      ))}
    </View>
  );
}

export const MovementsList = memo(MovementsListComponent);
