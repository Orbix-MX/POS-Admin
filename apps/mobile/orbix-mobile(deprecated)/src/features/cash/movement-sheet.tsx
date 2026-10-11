/**
 * Registrar un movimiento del turno: gasto, ingreso o retiro.
 *
 * Una sola hoja con tres modos, no tres pantallas: los campos son casi los
 * mismos y el operador elige el tipo *después* de decidir que va a mover
 * dinero, no antes.
 *
 * Gasto e ingreso van por `POST /cash-sessions/active/movement`; el retiro por
 * `/active/withdraw`, que es otro endpoint y otro permiso — un retiro no es un
 * gasto del negocio, es efectivo que cambia de lugar, y el corte los reporta
 * en filas distintas.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  OrbixBottomSheet,
  OrbixButton,
  OrbixText,
  OrbixTextField,
  type OrbixBottomSheetRef,
} from '@/components';
import { useTheme } from '@/hooks/use-theme';
import type { CashSessionSummary } from '@/repositories/cash-repository';
import { toUserMessage } from '@/utils/error-message';

import {
  EMPTY_MOVEMENT_FORM,
  buildMovementSchema,
  exceedsAvailable,
  parseAmount,
  type MovementFormValues,
} from './cash-schemas';
import { useCreateCashMovement, useWithdrawCash } from './use-cash-movements';
import { formatCurrency } from '@/features/pos/pos-totals';

export type MovementKind = 'EXPENSE' | 'INCOME' | 'WITHDRAWAL';

/** Conceptos frecuentes, como atajo sobre el campo libre. */
const QUICK_REASONS: Record<MovementKind, readonly string[]> = {
  // No hay taxonomía de gastos en el backend — `reason` es texto libre. Estos
  // son atajos de escritura, no una tabla de categorías que haya que mantener.
  EXPENSE: ['cash.quickReasons.supplies', 'cash.quickReasons.transport', 'cash.quickReasons.services'],
  INCOME: ['cash.quickReasons.extraFloat', 'cash.quickReasons.ownerDeposit'],
  WITHDRAWAL: ['cash.quickReasons.safe', 'cash.quickReasons.bank'],
} as const;

interface MovementSheetProps {
  sheetRef: React.RefObject<OrbixBottomSheetRef | null>;
  kind: MovementKind;
  /** Para avisar de un retiro que excede el cajón antes de mandarlo. */
  summary: CashSessionSummary | null;
  onDone: () => void;
}

export function MovementSheet({ sheetRef, kind, summary, onDone }: MovementSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const isWithdrawal = kind === 'WITHDRAWAL';
  const schema = useMemo(() => buildMovementSchema(t), [t]);

  const { control, handleSubmit, reset, setValue } = useForm<MovementFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_MOVEMENT_FORM,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const createMovement = useCreateCashMovement();
  const withdraw = useWithdrawCash();
  const pending = createMovement.isPending || withdraw.isPending;
  const serverError = createMovement.error ?? withdraw.error;

  const currency = useWatch({ control, name: 'currency' });
  const amountText = useWatch({ control, name: 'amount' });

  // El formulario se limpia al cambiar de tipo: el concepto de un gasto no
  // tiene sentido pegado a un retiro.
  useEffect(() => {
    reset(EMPTY_MOVEMENT_FORM);
    createMovement.reset();
    withdraw.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const available = summary
    ? currency === 'USD'
      ? summary.expectedCashUsd
      : summary.expectedCash
    : 0;

  const amount = parseAmount(amountText ?? '');
  const overdraft = isWithdrawal && exceedsAvailable(amount, available);

  const hasUsd = (summary?.openingAmountUsd ?? 0) > 0 || (summary?.expectedCashUsd ?? 0) > 0;

  const onSubmit = (values: MovementFormValues) => {
    const parsed = parseAmount(values.amount);
    if (!Number.isFinite(parsed)) return;

    const done = () => {
      reset(EMPTY_MOVEMENT_FORM);
      onDone();
      sheetRef.current?.close();
    };

    if (isWithdrawal) {
      withdraw.mutate(
        { amount: parsed, currency: values.currency, reason: values.reason.trim() },
        { onSuccess: done },
      );
      return;
    }

    createMovement.mutate(
      {
        type: kind,
        amount: parsed,
        currency: values.currency,
        reason: values.reason.trim(),
        ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
      },
      { onSuccess: done },
    );
  };

  return (
    <OrbixBottomSheet
      ref={sheetRef}
      title={t(`cash.movementKind.${kind}`)}
      // La hoja lleva campos de texto: sin `interactive` el teclado tapa el que
      // se está escribiendo.
      keyboardBehavior="interactive"
    >
      <View style={{ gap: theme.spacing.md }}>
        {/* Disponible: el dato que decide si el retiro cabe. Solo en retiro —
            en un gasto no acota nada, el gasto puede pagarse con lo que sea. */}
        {isWithdrawal && summary ? (
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
              {t('cash.availableCash')}
            </OrbixText>
            <OrbixText size="sm" weight="bold" style={{ fontVariant: ['tabular-nums'] }}>
              {currency === 'USD' ? `${available.toFixed(2)} USD` : formatCurrency(available)}
            </OrbixText>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <OrbixTextField
              control={control}
              name="amount"
              label={t('cash.amount')}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>

          {/* El selector de divisa solo aparece si el cajón tiene dólares:
              ofrecer USD en una caja que nunca los vio es ruido. */}
          {hasUsd ? (
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <View style={{ gap: theme.spacing.xs, paddingTop: 22 }}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {(['MXN', 'USD'] as const).map((code) => {
                      const active = field.value === code;
                      return (
                        <Pressable
                          key={code}
                          onPress={() => field.onChange(code)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={{
                            paddingHorizontal: theme.spacing.md,
                            paddingVertical: 12,
                            borderRadius: theme.radius.lg,
                            borderWidth: 1.5,
                            borderColor: active ? theme.colors.accentPurple : theme.colors.border,
                            backgroundColor: active ? theme.colors.secondary : theme.colors.card,
                          }}
                        >
                          <OrbixText size="sm" weight="semibold">
                            {code}
                          </OrbixText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            />
          ) : null}
        </View>

        {overdraft ? (
          <OrbixText size="xs" tone="dangerFg">
            {t('cash.errors.overdraft')}
          </OrbixText>
        ) : null}

        <OrbixTextField
          control={control}
          name="reason"
          label={t('cash.reason')}
          placeholder={t(`cash.reasonPlaceholder.${kind}`)}
        />

        {/* Atajos de escritura sobre el concepto. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {QUICK_REASONS[kind].map((key) => (
            <Pressable
              key={key}
              onPress={() => setValue('reason', t(key as 'cash.quickReasons.supplies'), { shouldValidate: true })}
              accessibilityRole="button"
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: 6,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.muted,
              }}
            >
              <OrbixText size="xs" tone="mutedForeground">
                {t(key as 'cash.quickReasons.supplies')}
              </OrbixText>
            </Pressable>
          ))}
        </View>

        {!isWithdrawal ? (
          <OrbixTextField
            control={control}
            name="notes"
            label={t('cash.notes')}
            placeholder={t('cash.notesPlaceholder')}
          />
        ) : null}

        {serverError ? (
          <OrbixText size="xs" tone="dangerFg">
            {toUserMessage(serverError, t)}
          </OrbixText>
        ) : null}

        <OrbixButton
          label={t(`cash.submit.${kind}`)}
          onPress={handleSubmit(onSubmit)}
          loading={pending}
          disabled={overdraft}
        />
      </View>
    </OrbixBottomSheet>
  );
}
