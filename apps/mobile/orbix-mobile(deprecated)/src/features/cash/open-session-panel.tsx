/**
 * Puerta de entrada al turno: declarar el fondo y abrir la caja.
 *
 * Vivía dentro de `pos/index.tsx`. Se saca aquí porque ahora lo necesitan dos
 * pantallas —el POS, que no deja vender sin caja, y la sección Caja, que es
 * donde el dueño la abre por la mañana— y duplicarlo garantizaba que se
 * separaran.
 *
 * El fondo puede ir en las dos divisas. `openingAmountUsd` es opcional en el
 * servidor pero `exchangeRateUsdMxn` no, y queda **fijado para toda la sesión**
 * (el cierre calcula `differenceUsd` contra él), así que solo se pide cuando de
 * verdad hay dólares en el cajón: inventar un número lo convertiría en el tipo
 * de cambio oficial del turno.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { OrbixButton, OrbixInput, OrbixText } from '@/components';
import { CreditCardIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/utils/error-message';

import { useOpenCashSession } from './use-cash-session';

/** `''` → 0, para que un campo opcional sin tocar no acabe en `NaN`. */
function parseAmount(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

export interface OpenCashSessionPanelProps {
  /** Caja física en la que abrir. Sin ella el servidor toma la primera libre. */
  cashRegisterId?: string;
  onOpened?: () => void;
}

export function OpenCashSessionPanel({ cashRegisterId, onOpened }: OpenCashSessionPanelProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingAmountUsd, setOpeningAmountUsd] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const openSession = useOpenCashSession();

  const usdAmount = openingAmountUsd.trim() ? parseAmount(openingAmountUsd) : 0;
  const hasUsd = Number.isFinite(usdAmount) && usdAmount > 0;

  const handleOpen = () => {
    const amount = openingAmount.trim() ? parseAmount(openingAmount) : 0;
    if (!Number.isFinite(amount) || amount < 0) return;
    if (!Number.isFinite(usdAmount) || usdAmount < 0) return;

    const rate = exchangeRate.trim() ? parseAmount(exchangeRate) : 0;
    if (hasUsd && (!Number.isFinite(rate) || rate < 0.01)) {
      setValidationError(t('pos.exchangeRateRequired'));
      return;
    }
    setValidationError(null);

    openSession.mutate(
      {
        // La API exige una tasa ≥ 0.01 siempre. Sin dólares no significa nada,
        // así que va el neutro del esquema en vez de un número inventado que
        // luego se reportaría como el tipo de cambio de la sesión.
        exchangeRateUsdMxn: Number.isFinite(rate) && rate >= 0.01 ? rate : 1,
        openingAmount: amount,
        ...(hasUsd ? { openingAmountUsd: usdAmount } : {}),
        ...(cashRegisterId ? { cashRegisterId } : {}),
      },
      { onSuccess: () => onOpened?.() },
    );
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.lg,
        paddingHorizontal: theme.spacing.xl,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.brandBlue50,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CreditCardIcon size={26} color={theme.colors.brandBlue600} />
      </View>

      <View style={{ gap: 4, alignItems: 'center' }}>
        <OrbixText size="lg" weight="bold">
          {t('pos.noCashSession')}
        </OrbixText>
        <OrbixText size="sm" tone="mutedForeground" align="center">
          {t('pos.noCashSessionHint')}
        </OrbixText>
      </View>

      <View style={{ width: '100%', gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <OrbixText size="xs" weight="semibold" tone="mutedForeground">
              {t('pos.openingAmountMxn').toUpperCase()}
            </OrbixText>
            <OrbixInput
              value={openingAmount}
              onChangeText={setOpeningAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <OrbixText size="xs" weight="semibold" tone="warningFg">
              {t('pos.openingAmountUsd').toUpperCase()}
            </OrbixText>
            <OrbixInput
              value={openingAmountUsd}
              onChangeText={setOpeningAmountUsd}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {hasUsd ? (
          <View style={{ gap: theme.spacing.xs }}>
            <OrbixText size="xs" weight="semibold" tone="mutedForeground">
              {t('pos.exchangeRate').toUpperCase()}
            </OrbixText>
            <OrbixInput
              value={exchangeRate}
              onChangeText={setExchangeRate}
              placeholder="19.45"
              keyboardType="decimal-pad"
              hasError={Boolean(validationError)}
            />
            <OrbixText size="xs" tone="mutedForeground">
              {t('pos.exchangeRateHint')}
            </OrbixText>
          </View>
        ) : null}

        {validationError ? (
          <OrbixText size="xs" tone="dangerFg">
            {validationError}
          </OrbixText>
        ) : null}
        {openSession.error ? (
          <OrbixText size="xs" tone="dangerFg">
            {toUserMessage(openSession.error, t)}
          </OrbixText>
        ) : null}

        <OrbixButton
          label={t('pos.openCashSession')}
          onPress={handleOpen}
          loading={openSession.isPending}
        />
      </View>
    </View>
  );
}
