/**
 * Arqueo de control: contar el cajón sin cerrar el turno.
 *
 * El flujo tiene un paréntesis que hay que abrir y cerrar:
 *
 *   ABIERTA ──start-count──▶ EN_ARQUEO ──resume──▶ ABIERTA
 *                                │
 *                                └── el POS no vende mientras dure
 *
 * Congelar es deliberado —el efectivo no puede moverse bajo los pies de quien
 * cuenta—, pero también es el riesgo de esta pantalla: un arqueo abandonado
 * deja la caja parada. De ahí el aviso antes de congelar y la confirmación al
 * salir sin reanudar.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import {
  BackButton,
  OrbixButton,
  OrbixCard,
  OrbixModal,
  OrbixScaffold,
  OrbixSkeleton,
  OrbixText,
  toast,
} from '@/components';
import { AuthorizerPinSheet } from '@/features/cash/authorizer-pin-sheet';
import { CountForm, EMPTY_COUNT, type CountValues } from '@/features/cash/count-form';
import { parseAmount } from '@/features/cash/cash-schemas';
import {
  useCashCounts,
  useCreateCashCount,
  useResumeCashSession,
  useStartCashCount,
} from '@/features/cash/use-cash-count';
import { useActiveCashSession } from '@/features/cash/use-cash-session';
import { usePinAuthorization } from '@/features/cash/use-pin-authorization';
import { useCurrencyFormatVersion } from '@/hooks/use-currency-format-version';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/utils/error-message';

import { formatCurrency } from '@/features/pos/pos-totals';

export default function ArqueoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  useCurrencyFormatVersion();

  const { data: session, isLoading } = useActiveCashSession();
  const { data: counts } = useCashCounts(session?.id);

  const [values, setValues] = useState<CountValues>(EMPTY_COUNT);
  const [confirmFreeze, setConfirmFreeze] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const startCount = useStartCashCount(session?.id);
  const resume = useResumeCashSession(session?.id);
  const createCount = useCreateCashCount();

  const startAuth = usePinAuthorization<Record<string, never>>(
    (input, handlers) => startCount.mutate(input, handlers),
  );
  const resumeAuth = usePinAuthorization<Record<string, never>>(
    (input, handlers) => resume.mutate(input, handlers),
    () => router.back(),
  );
  const countAuth = usePinAuthorization<{
    type: 'PARCIAL';
    countedMxn: number;
    countedUsd?: number;
    denominations?: Record<string, number>;
  }>((input, handlers) => createCount.mutate(input, handlers), () => {
    toast.success(t('cash.countSaved'));
    setValues(EMPTY_COUNT);
  });

  const summary = session?.summary ?? null;
  const expectedMxn = summary?.expectedCash ?? 0;
  const expectedUsd = summary?.expectedCashUsd ?? 0;
  const hasUsd = (summary?.openingAmountUsd ?? 0) > 0 || expectedUsd > 0;

  const frozen = session?.status === 'EN_ARQUEO';
  const countedMxn = parseAmount(values.countedMxn);
  const canSubmit = frozen && Number.isFinite(countedMxn) && countedMxn >= 0;

  const submitCount = () => {
    const usd = parseAmount(values.countedUsd);
    countAuth.run({
      type: 'PARCIAL',
      countedMxn,
      ...(hasUsd && Number.isFinite(usd) ? { countedUsd: usd } : {}),
      ...(Object.keys(values.denominations).length > 0
        ? { denominations: values.denominations }
        : {}),
    });
  };

  /** Salir con la caja congelada la deja parada: hay que decirlo. */
  const handleBack = () => {
    if (frozen) setConfirmLeave(true);
    else router.back();
  };

  const serverError = startCount.error ?? resume.error ?? createCount.error;

  return (
    <OrbixScaffold scrollable={false} contentStyle={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={handleBack} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t('cash.count.title')}
        </OrbixText>
      </View>

      {isLoading ? (
        <OrbixSkeleton height={200} radius={theme.radius.xl} />
      ) : !session ? (
        <OrbixCard>
          <OrbixText size="sm" tone="mutedForeground">
            {t('cash.errors.noOpenSession')}
          </OrbixText>
        </OrbixCard>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Paso 1: congelar. Sin esto el efectivo se mueve mientras se cuenta. */}
          {!frozen ? (
            <OrbixCard style={{ gap: theme.spacing.md }}>
              <OrbixText size="sm" weight="bold">
                {t('cash.count.freezeTitle')}
              </OrbixText>
              <OrbixText size="sm" tone="mutedForeground">
                {t('cash.count.freezeHint')}
              </OrbixText>
              <OrbixButton
                label={t('cash.count.freeze')}
                onPress={() => setConfirmFreeze(true)}
                loading={startCount.isPending}
              />
            </OrbixCard>
          ) : (
            <>
              <OrbixCard
                style={{
                  gap: 4,
                  borderColor: theme.colors.infoFg,
                  backgroundColor: theme.colors.infoBg,
                }}
              >
                <OrbixText size="sm" weight="bold" style={{ color: theme.colors.infoFg }}>
                  {t('cash.frozen.countingTitle')}
                </OrbixText>
                <OrbixText size="sm" style={{ color: theme.colors.infoFg }}>
                  {t('cash.count.frozenHint')}
                </OrbixText>
              </OrbixCard>

              <CountForm
                values={values}
                onChange={setValues}
                expectedMxn={expectedMxn}
                expectedUsd={expectedUsd}
                hasUsd={hasUsd}
              />

              {serverError ? (
                <OrbixText size="xs" tone="dangerFg">
                  {toUserMessage(serverError, t)}
                </OrbixText>
              ) : null}

              <View style={{ gap: theme.spacing.sm }}>
                <OrbixButton
                  label={t('cash.count.save')}
                  onPress={submitCount}
                  disabled={!canSubmit}
                  loading={createCount.isPending}
                />
                {/* Reanudar cierra el paréntesis. Es la salida correcta de un
                    arqueo de control, y la que evita dejar la caja parada. */}
                <OrbixButton
                  label={t('cash.count.resume')}
                  variant="secondary"
                  onPress={() => resumeAuth.run({})}
                  loading={resume.isPending}
                />
              </View>
            </>
          )}

          {/* Arqueos previos del turno. */}
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
        </ScrollView>
      )}

      <OrbixModal
        visible={confirmFreeze}
        title={t('cash.count.freezeConfirmTitle')}
        description={t('cash.count.freezeConfirmDescription')}
        confirmLabel={t('cash.count.freeze')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          setConfirmFreeze(false);
          startAuth.run({});
        }}
        onDismiss={() => setConfirmFreeze(false)}
      />

      <OrbixModal
        visible={confirmLeave}
        title={t('cash.count.leaveConfirmTitle')}
        description={t('cash.count.leaveConfirmDescription')}
        confirmLabel={t('cash.count.leaveAnyway')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          setConfirmLeave(false);
          router.back();
        }}
        onDismiss={() => setConfirmLeave(false)}
      />

      <AuthorizerPinSheet
        visible={startAuth.pinRequired || resumeAuth.pinRequired || countAuth.pinRequired}
        invalid={startAuth.pinInvalid || resumeAuth.pinInvalid || countAuth.pinInvalid}
        loading={startCount.isPending || resume.isPending || createCount.isPending}
        operationLabel={t('cash.count.title')}
        onSubmit={(pin) => {
          if (startAuth.pinRequired) startAuth.submitPin(pin);
          else if (resumeAuth.pinRequired) resumeAuth.submitPin(pin);
          else countAuth.submitPin(pin);
        }}
        onCancel={() => {
          startAuth.cancel();
          resumeAuth.cancel();
          countAuth.cancel();
        }}
      />
    </OrbixScaffold>
  );
}
