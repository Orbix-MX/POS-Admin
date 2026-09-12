/**
 * Detalle de una sesión de caja ya cerrada.
 *
 * `GET /cash-sessions/:id` trae el mismo `summary` que la activa, más el
 * arqueo del cierre (esperado, contado, diferencia y su motivo), que es lo que
 * distingue esta pantalla de la de un turno en curso.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import {
  BackButton,
  OrbixCard,
  OrbixScaffold,
  OrbixSkeleton,
  OrbixText,
} from '@/components';
import { MovementsList } from '@/features/cash/movements-list';
import { SessionSummaryCard, StatusPill } from '@/features/cash/session-summary-card';
import { useCashCounts } from '@/features/cash/use-cash-count';
import { useCashSession } from '@/features/cash/use-cash-session';
import { useCurrencyFormatVersion } from '@/hooks/use-currency-format-version';
import { useTheme } from '@/hooks/use-theme';
import type { CashMovementType } from '@/types/api';
import { toUserMessage } from '@/utils/error-message';

import { formatCurrency } from '@/features/pos/pos-totals';

export default function CashSessionDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  useCurrencyFormatVersion();

  const { data: session, isLoading, error } = useCashSession(id);
  const { data: counts } = useCashCounts(id);

  const opened = session ? new Date(session.openedAt) : null;
  const closed = session?.closedAt ? new Date(session.closedAt) : null;

  return (
    <OrbixScaffold contentStyle={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <View style={{ flex: 1 }}>
          <OrbixText size="xs" weight="semibold" tone="mutedForeground">
            {opened
              ? opened.toLocaleDateString(undefined, { day: '2-digit', month: 'long' }).toUpperCase()
              : ''}
          </OrbixText>
          <OrbixText size="xl" weight="bold" accessibilityRole="header">
            {t('cash.detail.title')}
          </OrbixText>
        </View>
        {session ? (
          <StatusPill status={session.status} label={t(`cash.status.${session.status}`)} />
        ) : null}
      </View>

      {isLoading ? (
        <OrbixSkeleton height={220} radius={theme.radius.xl} />
      ) : error ? (
        <OrbixCard>
          <OrbixText size="sm" tone="dangerFg">{toUserMessage(error, t)}</OrbixText>
        </OrbixCard>
      ) : !session ? null : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}
        >
          <SessionSummaryCard
            session={session}
            labels={{
              expectedCash: t('cash.expectedCash'),
              openingAmount: t('cash.openingAmount'),
              sales: t('cash.sales'),
              income: t('cash.income'),
              expense: t('cash.expense'),
              withdrawal: t('cash.withdrawal'),
              refund: t('cash.refund'),
              cash: t('pos.cash'),
              card: t('pos.card'),
              transfer: t('pos.transfer'),
              movements: t('cash.movements'),
              openedBy: t('cash.openedBy'),
              usdDrawer: t('cash.usdDrawer'),
              noMovements: t('cash.noMovements'),
            }}
          />

          {/* El arqueo del cierre: solo existe una vez cortada. */}
          {session.cashCounted !== null ? (
            <OrbixCard style={{ gap: theme.spacing.sm }}>
              <OrbixText size="xs" weight="semibold" tone="mutedForeground">
                {t('cash.detail.closing').toUpperCase()}
              </OrbixText>
              <Row label={t('cash.expectedCash')} value={formatCurrency(session.expectedAmount ?? 0)} />
              <Row label={t('cash.counted')} value={formatCurrency(session.cashCounted)} />
              <Row
                label={t('cash.difference')}
                value={`${(session.difference ?? 0) > 0 ? '+' : (session.difference ?? 0) < 0 ? '−' : ''}${formatCurrency(Math.abs(session.difference ?? 0))}`}
                tone={Math.abs(session.difference ?? 0) < 0.005 ? 'successFg' : 'dangerFg'}
              />
              {session.differenceReason ? (
                <OrbixText size="xs" tone="mutedForeground">{session.differenceReason}</OrbixText>
              ) : null}
              {closed ? (
                <OrbixText size="xs" tone="mutedForeground">
                  {t('cash.detail.closedAt')} {closed.toLocaleString()}
                  {session.closedByEmail ? ` · ${session.closedByEmail}` : ''}
                </OrbixText>
              ) : null}
            </OrbixCard>
          ) : null}

          {counts && counts.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <OrbixText size="xs" weight="semibold" tone="mutedForeground">
                {t('cash.count.previous').toUpperCase()}
              </OrbixText>
              {counts.map((count) => (
                <OrbixCard key={count.id} style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <OrbixText size="sm" weight="semibold">
                      {formatCurrency(count.countedMxn)}
                    </OrbixText>
                    <OrbixText
                      size="sm"
                      weight="semibold"
                      tone={Math.abs(count.differenceMxn) < 0.005 ? 'successFg' : 'dangerFg'}
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {count.differenceMxn > 0 ? '+' : count.differenceMxn < 0 ? '−' : ''}
                      {formatCurrency(Math.abs(count.differenceMxn))}
                    </OrbixText>
                  </View>
                  <OrbixText size="xs" tone="mutedForeground">
                    {new Date(count.createdAt).toLocaleString()}
                    {count.reason ? ` · ${count.reason}` : ''}
                  </OrbixText>
                </OrbixCard>
              ))}
            </View>
          ) : null}

          <MovementsList
            movements={session.movements}
            labels={{
              title: t('cash.movementsTitle'),
              empty: t('cash.noMovements'),
              typeName: (type: CashMovementType) => t(`cash.movementType.${type}`),
            }}
          />
        </ScrollView>
      )}
    </OrbixScaffold>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'successFg' | 'dangerFg';
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <OrbixText size="sm" tone="mutedForeground">{label}</OrbixText>
      <OrbixText size="sm" weight="semibold" tone={tone} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </OrbixText>
    </View>
  );
}
