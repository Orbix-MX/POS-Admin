/**
 * El PIN del supervisor que respalda una operación de caja.
 *
 * No se pide por adelantado: aparece solo cuando el servidor responde
 * `AUTHORIZATION_REQUIRED` — ver `use-pin-authorization.ts`.
 *
 * El mensaje de error es **uno solo** para PIN inexistente y PIN sin permiso,
 * igual que en el servidor: distinguirlos permitiría sondear qué PINes existen
 * probando en la terminal.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';

import { OrbixButton, OrbixInput, OrbixText } from '@/components';
import { ShieldIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';

/** Longitud que acepta `AuthorizePinDto` en el servidor. */
const MIN_PIN = 4;
const MAX_PIN = 12;

interface AuthorizerPinSheetProps {
  visible: boolean;
  /** El PIN anterior no sirvió. */
  invalid: boolean;
  loading: boolean;
  /** Qué se está autorizando, para que el supervisor sepa qué firma. */
  operationLabel: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}

export function AuthorizerPinSheet({
  visible,
  invalid,
  loading,
  operationLabel,
  onSubmit,
  onCancel,
}: AuthorizerPinSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [pin, setPin] = useState('');

  // Un PIN rechazado se borra: reescribirlo entero es más rápido que corregir
  // a ciegas un campo enmascarado.
  useEffect(() => {
    if (invalid) setPin('');
  }, [invalid]);

  useEffect(() => {
    if (!visible) setPin('');
  }, [visible]);

  const valid = pin.length >= MIN_PIN && pin.length <= MAX_PIN;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        accessibilityLabel={t('common.cancel')}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: theme.spacing.xl }}
      >
        {/* El `Pressable` interior come el toque para que tocar la tarjeta no
            cierre la hoja a través del scrim. */}
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}
        >
          <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.infoBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldIcon size={22} color={theme.colors.infoFg} />
            </View>
            <OrbixText size="lg" weight="bold" align="center">
              {t('cash.pin.title')}
            </OrbixText>
            <OrbixText size="sm" tone="mutedForeground" align="center">
              {t('cash.pin.hint', { operation: operationLabel })}
            </OrbixText>
          </View>

          <OrbixInput
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, MAX_PIN))}
            placeholder="••••"
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            hasError={invalid}
            textAlign="center"
          />

          {invalid ? (
            <OrbixText size="xs" tone="dangerFg" align="center">
              {t('cash.errors.authorizationInvalid')}
            </OrbixText>
          ) : null}

          <View style={{ gap: theme.spacing.sm }}>
            <OrbixButton
              label={t('cash.pin.authorize')}
              onPress={() => onSubmit(pin)}
              disabled={!valid}
              loading={loading}
            />
            <OrbixButton label={t('common.cancel')} variant="secondary" onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
