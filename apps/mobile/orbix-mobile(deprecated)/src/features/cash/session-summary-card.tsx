/**
 * El estado del turno de un vistazo: cuánto debería haber en el cajón y de
 * dónde salió.
 *
 * Todas las cifras vienen del `summary` que calcula el servidor. Aquí no se
 * suma nada: el cliente no recalcula dinero, igual que no recalcula el total de
 * una venta (ver `pos-totals.ts`).
 */
import { memo } from 'react';
import { View } from 'react-native';

import { OrbixCard } from '@/components/cards/orbix-card';
import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';
import type { CashSession } from '@/repositories/cash-repository';
import type { ThemeColors } from '@/theme/types';

import { formatCurrency } from '@/features/pos/pos-totals';

/** Estado de la sesión traducido a color y copy. */
export interface SessionStatusLabels {
  ABIERTA: string;
  EN_ARQUEO: string;
  PENDIENTE_REVISION: string;
  CERRADA: string;
}

const STATUS_TONE: Record<
  CashSession['status'],
  { bg: keyof ThemeColors; fg: keyof ThemeColors }
> = {
  ABIERTA: { bg: 'successBg', fg: 'successFg' },
  EN_ARQUEO: { bg: 'infoBg', fg: 'infoFg' },
  // Ámbar y no rojo: la caja no falló, está esperando a que alguien firme.
  PENDIENTE_REVISION: { bg: 'warningBg', fg: 'warningFg' },
  CERRADA: { bg: 'neutralBg', fg: 'neutralFg' },
};

export function StatusPill({ status, label }: { status: CashSession['status']; label: string }) {
  const theme = useTheme();
  const tone = STATUS_TONE[status];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 3,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors[tone.bg],
      }}
    >
      <OrbixText size="xs" weight="semibold" style={{ color: theme.colors[tone.fg] }}>
        {label}
      </OrbixText>
    </View>
  );
}

/** Una fila del desglose: concepto a la izquierda, importe alineado a la derecha. */
function Row({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'mutedForeground' | 'dangerFg' | 'successFg';
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <OrbixText size="sm" tone={strong ? 'foreground' : 'mutedForeground'} weight={strong ? 'semibold' : 'regular'}>
        {label}
      </OrbixText>
      <OrbixText
        size="sm"
        weight={strong ? 'bold' : 'medium'}
        tone={tone}
        // Tabulares para que los importes de las filas se alineen por la coma.
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </OrbixText>
    </View>
  );
}

export interface SessionSummaryLabels {
  expectedCash: string;
  openingAmount: string;
  sales: string;
  income: string;
  expense: string;
  withdrawal: string;
  refund: string;
  cash: string;
  card: string;
  transfer: string;
  movements: string;
  openedBy: string;
  usdDrawer: string;
  noMovements: string;
}

interface SessionSummaryCardProps {
  session: CashSession;
  labels: SessionSummaryLabels;
}

function SessionSummaryCardComponent({ session, labels }: SessionSummaryCardProps) {
  const theme = useTheme();
  const summary = session.summary;

  // Sin summary la tarjeta no puede decir nada honesto: el listado no lo trae,
  // y preferimos no pintar ceros que parecen datos.
  if (!summary) return null;

  const { totals } = summary;
  const hasUsd = summary.openingAmountUsd > 0 || summary.expectedCashUsd > 0;

  return (
    <OrbixCard elevation="md" style={{ gap: theme.spacing.lg }}>
      {/* Efectivo esperado — la cifra que el cajero busca al abrir esta pantalla. */}
      <View style={{ gap: 2 }}>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground">
          {labels.expectedCash.toUpperCase()}
        </OrbixText>
        <OrbixText size="3xl" weight="extrabold" leading="tight" style={{ fontVariant: ['tabular-nums'] }}>
          {formatCurrency(summary.expectedCash)}
        </OrbixText>
        {hasUsd ? (
          <OrbixText size="sm" tone="warningFg" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
            {labels.usdDrawer}: {summary.expectedCashUsd.toFixed(2)} USD
          </OrbixText>
        ) : null}
      </View>

      <View style={{ height: 1, backgroundColor: theme.colors.border }} />

      <View style={{ gap: theme.spacing.sm }}>
        <Row label={labels.openingAmount} value={formatCurrency(summary.openingAmount)} />

        {/* Ventas, con su desglose por método solo cuando hay más de uno en juego. */}
        <Row label={labels.sales} value={formatCurrency(totals.sales.total)} strong />
        {totals.sales.cash > 0 ? (
          <Row label={`   ${labels.cash}`} value={formatCurrency(totals.sales.cash)} />
        ) : null}
        {totals.sales.card > 0 ? (
          <Row label={`   ${labels.card}`} value={formatCurrency(totals.sales.card)} />
        ) : null}
        {totals.sales.transfer > 0 ? (
          <Row label={`   ${labels.transfer}`} value={formatCurrency(totals.sales.transfer)} />
        ) : null}

        {totals.income.total > 0 ? (
          <Row label={labels.income} value={formatCurrency(totals.income.total)} tone="successFg" />
        ) : null}
        {totals.expense.total > 0 ? (
          <Row label={labels.expense} value={`− ${formatCurrency(totals.expense.total)}`} tone="dangerFg" />
        ) : null}
        {totals.withdrawal.total > 0 ? (
          <Row label={labels.withdrawal} value={`− ${formatCurrency(totals.withdrawal.total)}`} tone="dangerFg" />
        ) : null}
        {totals.refund.total > 0 ? (
          <Row label={labels.refund} value={`− ${formatCurrency(totals.refund.total)}`} tone="dangerFg" />
        ) : null}
      </View>

      <View style={{ height: 1, backgroundColor: theme.colors.border }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <OrbixText size="xs" tone="mutedForeground">
          {summary.movementsCount === 0
            ? labels.noMovements
            : `${summary.movementsCount} ${labels.movements}`}
        </OrbixText>
        {session.openedByEmail ? (
          <OrbixText size="xs" tone="mutedForeground" numberOfLines={1} style={{ flexShrink: 1 }}>
            {labels.openedBy} {session.openedByEmail}
          </OrbixText>
        ) : null}
      </View>
    </OrbixCard>
  );
}

export const SessionSummaryCard = memo(SessionSummaryCardComponent);
