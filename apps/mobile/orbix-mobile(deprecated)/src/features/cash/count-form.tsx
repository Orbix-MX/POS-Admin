/**
 * Capturar el efectivo contado, con desglose opcional por denominación.
 *
 * El **monto manda**: el desglose suma y avisa si no coincide, pero nunca
 * bloquea. Contar billete a billete en un mostrador es lento, y quien ya sabe
 * cuánto tiene debe poder escribirlo y seguir.
 *
 * Comparte forma entre el arqueo de control y el corte, que capturan lo mismo:
 * la diferencia está en qué se hace después con el número.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { OrbixCard, OrbixInput, OrbixText } from '@/components';
import { ChevronDownIcon, ChevronRightIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';

import { parseAmount } from './cash-schemas';
import { formatCurrency } from '@/features/pos/pos-totals';

/**
 * Denominaciones del peso mexicano, de mayor a menor.
 *
 * Fijas y no configurables por ahora: la moneda del tenant todavía no llega al
 * POS de forma fiable (ver `faltantes-app-comercial.md` §5), y un desglose con
 * las denominaciones equivocadas estorba más de lo que ayuda. El campo de
 * monto sigue funcionando en cualquier divisa.
 */
const MXN_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

export interface CountValues {
  countedMxn: string;
  countedUsd: string;
  denominations: Record<string, number>;
}

export const EMPTY_COUNT: CountValues = { countedMxn: '', countedUsd: '', denominations: {} };

/** Suma del desglose: Σ (denominación × cantidad). */
export function sumDenominations(denominations: Record<string, number>): number {
  return Object.entries(denominations).reduce(
    (total, [value, count]) => total + Number(value) * (count || 0),
    0,
  );
}

interface CountFormProps {
  values: CountValues;
  onChange: (values: CountValues) => void;
  /** Esperado según el servidor, para pintar la diferencia en vivo. */
  expectedMxn: number;
  expectedUsd: number;
  /** El cajón maneja dólares: muestra el segundo campo. */
  hasUsd: boolean;
}

export function CountForm({ values, onChange, expectedMxn, expectedUsd, hasUsd }: CountFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const countedMxn = parseAmount(values.countedMxn);
  const countedUsd = parseAmount(values.countedUsd);

  const differenceMxn = Number.isFinite(countedMxn) ? countedMxn - expectedMxn : null;
  const differenceUsd = Number.isFinite(countedUsd) ? countedUsd - expectedUsd : null;

  const breakdownTotal = useMemo(
    () => sumDenominations(values.denominations),
    [values.denominations],
  );

  // Solo se avisa si el desglose tiene algo Y no cuadra con el monto escrito.
  const breakdownMismatch =
    breakdownTotal > 0 && Number.isFinite(countedMxn) && Math.abs(breakdownTotal - countedMxn) > 0.005;

  const setDenomination = (value: number, raw: string) => {
    const count = Number(raw.replace(/\D/g, ''));
    const next = { ...values.denominations };
    if (!count) delete next[String(value)];
    else next[String(value)] = count;
    onChange({ ...values, denominations: next });
  };

  /** Volcar la suma del desglose al campo de monto, que es lo que se envía. */
  const applyBreakdown = () => {
    onChange({ ...values, countedMxn: breakdownTotal.toFixed(2) });
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground">
          {t('cash.countedMxn').toUpperCase()}
        </OrbixText>
        <OrbixInput
          value={values.countedMxn}
          onChangeText={(countedMxnText) => onChange({ ...values, countedMxn: countedMxnText })}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <DifferenceHint
          expected={expectedMxn}
          difference={differenceMxn}
          format={formatCurrency}
        />
      </View>

      {hasUsd ? (
        <View style={{ gap: theme.spacing.xs }}>
          <OrbixText size="xs" weight="semibold" tone="warningFg">
            {t('cash.countedUsd').toUpperCase()}
          </OrbixText>
          <OrbixInput
            value={values.countedUsd}
            onChangeText={(countedUsdText) => onChange({ ...values, countedUsd: countedUsdText })}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          <DifferenceHint
            expected={expectedUsd}
            difference={differenceUsd}
            format={(value) => `${value.toFixed(2)} USD`}
          />
        </View>
      ) : null}

      {/* Desglose: plegado por defecto. Es una ayuda para contar, no un paso. */}
      <View style={{ gap: theme.spacing.sm }}>
        <Pressable
          onPress={() => setBreakdownOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: breakdownOpen }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
        >
          {breakdownOpen ? (
            <ChevronDownIcon size={16} color={theme.colors.mutedForeground} />
          ) : (
            <ChevronRightIcon size={16} color={theme.colors.mutedForeground} />
          )}
          <OrbixText size="sm" weight="semibold" tone="mutedForeground">
            {t('cash.breakdown')}
          </OrbixText>
          {breakdownTotal > 0 ? (
            <OrbixText size="sm" tone="mutedForeground" style={{ fontVariant: ['tabular-nums'] }}>
              · {formatCurrency(breakdownTotal)}
            </OrbixText>
          ) : null}
        </Pressable>

        {breakdownOpen ? (
          <OrbixCard style={{ gap: theme.spacing.sm }}>
            {MXN_DENOMINATIONS.map((value) => (
              <View
                key={value}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
              >
                <OrbixText size="sm" style={{ width: 64, fontVariant: ['tabular-nums'] }}>
                  {formatCurrency(value)}
                </OrbixText>
                <View style={{ width: 72 }}>
                  <OrbixInput
                    value={String(values.denominations[String(value)] ?? '')}
                    onChangeText={(raw) => setDenomination(value, raw)}
                    placeholder="0"
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                </View>
                <OrbixText
                  size="sm"
                  tone="mutedForeground"
                  style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}
                >
                  {formatCurrency(value * (values.denominations[String(value)] ?? 0))}
                </OrbixText>
              </View>
            ))}

            {breakdownTotal > 0 ? (
              <Pressable
                onPress={applyBreakdown}
                accessibilityRole="button"
                style={{
                  marginTop: theme.spacing.xs,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.lg,
                  backgroundColor: theme.colors.brandBlue50,
                  alignItems: 'center',
                }}
              >
                <OrbixText size="sm" weight="semibold" style={{ color: theme.colors.brandBlue600 }}>
                  {t('cash.useBreakdown', { total: formatCurrency(breakdownTotal) })}
                </OrbixText>
              </Pressable>
            ) : null}
          </OrbixCard>
        ) : null}

        {breakdownMismatch ? (
          <OrbixText size="xs" tone="warningFg">
            {t('cash.breakdownMismatch')}
          </OrbixText>
        ) : null}
      </View>
    </View>
  );
}

/** Esperado, y la diferencia con signo en cuanto hay un número que comparar. */
function DifferenceHint({
  expected,
  difference,
  format,
}: {
  expected: number;
  difference: number | null;
  format: (value: number) => string;
}) {
  const { t } = useTranslation();

  const tone = difference === null || Math.abs(difference) < 0.005
    ? 'mutedForeground'
    : difference > 0
      ? 'successFg'
      : 'dangerFg';

  return (
    <OrbixText size="xs" tone={tone} style={{ fontVariant: ['tabular-nums'] }}>
      {t('cash.expectedShort')}: {format(expected)}
      {difference !== null && Math.abs(difference) >= 0.005
        ? ` · ${t('cash.difference')}: ${difference > 0 ? '+' : '−'}${format(Math.abs(difference))}`
        : ''}
    </OrbixText>
  );
}
