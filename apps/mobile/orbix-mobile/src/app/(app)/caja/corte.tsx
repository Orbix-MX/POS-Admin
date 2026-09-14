/**
 * Corte: cerrar el turno.
 *
 * Tres pasos —resumen, conteo, resultado— y **tres resultados**, no dos:
 *
 *   CERRADA             el turno terminó;
 *   PENDIENTE_REVISION  la diferencia superó el umbral del negocio y la caja
 *                       sigue congelada esperando a alguien con
 *                       `pos.cash:authorize`. El turno NO está cerrado;
 *   error               vuelta al conteo con el dato intacto.
 *
 * Tratar el segundo como éxito es el error caro de esta pantalla: el operador
 * se iría a casa creyendo que cortó.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import {
  AnimatedSuccessCheck,
  BackButton,
  OrbixButton,
  OrbixCard,
  OrbixScaffold,
  OrbixSkeleton,
  OrbixText,
  OrbixTextField,
} from '@/components';
import { AuthorizerPinSheet } from '@/features/cash/authorizer-pin-sheet';
import { CountForm, EMPTY_COUNT, type CountValues } from '@/features/cash/count-form';
import { parseAmount } from '@/features/cash/cash-schemas';
import { SessionSummaryCard } from '@/features/cash/session-summary-card';
import { UserBreakdownCard } from '@/features/cash/user-breakdown-card';
import { useCashHandovers, useCloseCashSession } from '@/features/cash/use-cash-count';
import { useActiveCashSession } from '@/features/cash/use-cash-session';
import { usePinAuthorization } from '@/features/cash/use-pin-authorization';
import { useCurrencyFormatVersion } from '@/hooks/use-currency-format-version';
import { useTheme } from '@/hooks/use-theme';
import type { CashSession } from '@/repositories/cash-repository';
import { toUserMessage } from '@/utils/error-message';

import { formatCurrency } from '@/features/pos/pos-totals';
import { useForm } from 'react-hook-form';

type Stage = 'review' | 'count' | 'done';

interface ReasonForm {
  differenceReason: string;
  notes: string;
}

export default function CorteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  useCurrencyFormatVersion();

  const { data: session, isLoading } = useActiveCashSession();
  const { data: handovers } = useCashHandovers(session?.id);

  const [stage, setStage] = useState<Stage>('review');
  const [values, setValues] = useState<CountValues>(EMPTY_COUNT);
  const [closed, setClosed] = useState<CashSession | null>(null);

  const { control, getValues } = useForm<ReasonForm>({
    defaultValues: { differenceReason: '', notes: '' },
  });

  const close = useCloseCashSession(session?.id);

  const closeAuth = usePinAuthorization<{
    cashCounted: number;
    cashCountedUsd?: number;
    differenceReason?: string;
    notes?: string;
  }>((input, handlers) => {
    close.mutate(input, {
      ...handlers,
      onSuccess: (result) => {
        // El `status` decide qué pantalla se pinta. Un 200 no basta.
        setClosed(result);
        setStage('done');
        handlers.onSuccess?.();
      },
    });
  });

  const summary = session?.summary ?? null;
  const expectedMxn = summary?.expectedCash ?? 0;
  const expectedUsd = summary?.expectedCashUsd ?? 0;
  const hasUsd = (summary?.openingAmountUsd ?? 0) > 0 || expectedUsd > 0;

  const countedMxn = parseAmount(values.countedMxn);
  const countedUsd = parseAmount(values.countedUsd);
  const hasCount = Number.isFinite(countedMxn) && countedMxn >= 0;
  const difference = hasCount ? countedMxn - expectedMxn : 0;
  const hasDifference = hasCount && Math.abs(difference) >= 0.005;

  /**
   * El umbral vive en `Tenant.settings.cashDifferenceThreshold` y no llega al
   * cliente, así que el motivo se pide **siempre que haya diferencia**. Es más
   * simple que adivinar y nunca molesta de más: quien cuadra no lo ve.
   */
  const reasonRequired = hasDifference;
  const reasonText = getValues('differenceReason')?.trim() ?? '';

  const submitClose = () => {
    closeAuth.run({
      cashCounted: countedMxn,
      ...(hasUsd && Number.isFinite(countedUsd) ? { cashCountedUsd: countedUsd } : {}),
      ...(reasonText ? { differenceReason: reasonText } : {}),
      ...(getValues('notes')?.trim() ? { notes: getValues('notes').trim() } : {}),
    });
  };

  if (isLoading) {
    return (
      <OrbixScaffold contentStyle={{ gap: theme.spacing.lg }}>
        <OrbixSkeleton height={200} radius={theme.radius.xl} />
      </OrbixScaffold>
    );
  }

  if (!session && stage !== 'done') {
    return (
      <OrbixScaffold contentStyle={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
          <OrbixText size="xl" weight="bold">{t('cash.close.title')}</OrbixText>
        </View>
        <OrbixCard>
          <OrbixText size="sm" tone="mutedForeground">{t('cash.errors.noOpenSession')}</OrbixText>
        </OrbixCard>
      </OrbixScaffold>
    );
  }

  /* ── Resultado ──────────────────────────────────────────────────────── */
  if (stage === 'done' && closed) {
    const pendingReview = closed.status === 'PENDIENTE_REVISION';

    return (
      <OrbixScaffold scrollable contentStyle={{ gap: theme.spacing.xl }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.md, paddingTop: theme.spacing['2xl'] }}>
          {pendingReview ? (
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.warningBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <OrbixText size="2xl" style={{ color: theme.colors.warningFg }}>!</OrbixText>
            </View>
          ) : (
            <AnimatedSuccessCheck size={72} />
          )}

          <OrbixText size="xl" weight="bold" align="center">
            {t(pendingReview ? 'cash.close.pendingTitle' : 'cash.close.doneTitle')}
          </OrbixText>
          <OrbixText size="sm" tone="mutedForeground" align="center">
            {t(pendingReview ? 'cash.close.pendingHint' : 'cash.close.doneHint')}
          </OrbixText>
        </View>

        <OrbixCard style={{ gap: theme.spacing.sm }}>
          <ResultRow label={t('cash.expectedCash')} value={formatCurrency(closed.expectedAmount ?? 0)} />
          <ResultRow label={t('cash.counted')} value={formatCurrency(closed.cashCounted ?? 0)} />
          <View style={{ height: 1, backgroundColor: theme.colors.border }} />
          <ResultRow
            label={t('cash.difference')}
            value={formatCurrency(Math.abs(closed.difference ?? 0))}
            tone={Math.abs(closed.difference ?? 0) < 0.005 ? 'successFg' : 'dangerFg'}
            prefix={(closed.difference ?? 0) > 0 ? '+' : (closed.difference ?? 0) < 0 ? '−' : ''}
            strong
          />
          {closed.differenceReason ? (
            <OrbixText size="xs" tone="mutedForeground">{closed.differenceReason}</OrbixText>
          ) : null}
        </OrbixCard>

        <OrbixButton label={t('common.done')} onPress={() => router.replace('/(app)/caja')} />
      </OrbixScaffold>
    );
  }

  /* ── Resumen → conteo ───────────────────────────────────────────────── */
  return (
    <OrbixScaffold scrollable={false} contentStyle={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton
          onPress={() => (stage === 'count' ? setStage('review') : router.back())}
          accessibilityLabel={t('a11y.back')}
        />
        <View style={{ flex: 1 }}>
          <OrbixText size="xs" weight="semibold" tone="mutedForeground">
            {t(stage === 'review' ? 'cash.close.step1' : 'cash.close.step2').toUpperCase()}
          </OrbixText>
          <OrbixText size="xl" weight="bold" accessibilityRole="header">
            {t('cash.close.title')}
          </OrbixText>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        {stage === 'review' && session ? (
          <>
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
            {/* Quién movió qué, antes de firmar el corte: si no cuadra, es lo
                primero que hay que mirar. */}
            <UserBreakdownCard
              summary={session.summary}
              handovers={handovers ?? []}
              labels={{
                title: t('cash.byUser.title'),
                handoversTitle: t('cash.byUser.handovers'),
                sales: t('cash.sales'),
                movements: t('cash.movements'),
                netCash: t('cash.byUser.netCash'),
                stillIn: t('cash.byUser.stillIn'),
                noUsers: t('cash.byUser.none'),
              }}
            />

            <OrbixButton label={t('cash.close.startCount')} onPress={() => setStage('count')} />
          </>
        ) : null}

        {stage === 'count' ? (
          <>
            <CountForm
              values={values}
              onChange={setValues}
              expectedMxn={expectedMxn}
              expectedUsd={expectedUsd}
              hasUsd={hasUsd}
            />

            {reasonRequired ? (
              <View style={{ gap: theme.spacing.xs }}>
                <OrbixTextField
                  control={control}
                  name="differenceReason"
                  label={t('cash.close.differenceReason')}
                  placeholder={t('cash.close.differenceReasonPlaceholder')}
                />
                <OrbixText size="xs" tone="warningFg">
                  {t('cash.close.differenceReasonHint')}
                </OrbixText>
              </View>
            ) : null}

            <OrbixTextField
              control={control}
              name="notes"
              label={t('cash.notes')}
              placeholder={t('cash.notesPlaceholder')}
            />

            {close.error ? (
              <OrbixText size="xs" tone="dangerFg">{toUserMessage(close.error, t)}</OrbixText>
            ) : null}

            <OrbixButton
              label={t('cash.close.confirm')}
              onPress={submitClose}
              disabled={!hasCount}
              loading={close.isPending}
            />
          </>
        ) : null}
      </ScrollView>

      <AuthorizerPinSheet
        visible={closeAuth.pinRequired}
        invalid={closeAuth.pinInvalid}
        loading={close.isPending}
        operationLabel={t('cash.close.title')}
        onSubmit={closeAuth.submitPin}
        onCancel={closeAuth.cancel}
      />
    </OrbixScaffold>
  );
}

function ResultRow({
  label,
  value,
  tone,
  prefix = '',
  strong = false,
}: {
  label: string;
  value: string;
  tone?: 'successFg' | 'dangerFg';
  prefix?: string;
  strong?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <OrbixText size="sm" tone={strong ? 'foreground' : 'mutedForeground'} weight={strong ? 'semibold' : 'regular'}>
        {label}
      </OrbixText>
      <OrbixText size={strong ? 'base' : 'sm'} weight="bold" tone={tone} style={{ fontVariant: ['tabular-nums'] }}>
        {prefix}{value}
      </OrbixText>
    </View>
  );
}
