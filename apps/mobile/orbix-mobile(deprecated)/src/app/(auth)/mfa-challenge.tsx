/**
 * MFA challenge — segundo paso del login cuando la cuenta tiene 2FA activo.
 *
 * `RouteGuard` redirige aquí en cuanto `status === 'mfa-pending'` (ver
 * `src/app/route-guard.tsx`); esta pantalla es la única alcanzable en ese
 * estado.
 *
 * Dos modos, porque el API acepta dos formatos distintos: el TOTP de 6 dígitos
 * va en las cajas de OTP, y el código de respaldo —`randomBytes(5).toString('hex')`,
 * o sea 10 caracteres hex, ver `MfaService.confirmSetup`— necesita un campo de
 * texto normal, ya que no cabe en un input numérico de seis posiciones.
 *
 * El envío es SIEMPRE explícito, nunca automático al completar las cajas:
 * `MfaService.verifyChallenge` marca el ticket como usado ANTES de comprobar el
 * código, así que el desafío es de un solo intento —un segundo POST devuelve
 * "el desafío expiró" aunque el código sea correcto—. Con autoenvío, un dígito
 * mal tecleado quemaba el ticket sin que el usuario pudiera revisar nada, y el
 * botón se convertía en un segundo envío que fallaba siempre.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  AuthScreen,
  FieldGroup,
  InlineError,
  OrbixButton,
  OrbixOtpInput,
  OrbixText,
  OrbixTextField,
} from '@/components';
import { buildMfaChallengeSchema, type MfaChallengeValues } from '@/features/auth/schemas';
import { useVerifyMfa } from '@/features/auth/use-auth-mutations';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/services/api';
import { toUserMessage } from '@/utils/error-message';

const OTP_LENGTH = 6;

export default function MfaChallengeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { cancelMfa } = useAuth();

  const [formError, setFormError] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [otp, setOtp] = useState('');

  const schema = useMemo(() => buildMfaChallengeSchema(t), [t]);
  const { control, handleSubmit } = useForm<MfaChallengeValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  // Se desestructura a propósito: react-query mantiene `mutate` estable entre
  // renders, mientras que el objeto de la mutación es nuevo cada vez. Poner el
  // objeto entero en las dependencias de `submit` cambiaba su identidad —y con
  // ella la de `onOtpComplete`— en cada render, lo que reentraba en el efecto
  // de `OrbixOtpInput` sin parar.
  const { mutate: verifyMfaMutate, isPending } = useVerifyMfa();

  // Cerrojo síncrono: `isPending` solo se refleja en el siguiente render, y un
  // doble toque rápido cabe de sobra en esa ventana. Un segundo envío gasta el
  // único intento que da el ticket, así que no basta con deshabilitar el botón.
  const sending = useRef(false);

  const submit = useCallback(
    (code: string) => {
      if (sending.current) return;
      sending.current = true;
      setFormError(null);
      verifyMfaMutate(code, {
        onError: (error) => {
          setOtp('');
          // Un 401 aquí es el ticket agotado o caducado, no unas credenciales
          // malas: `toUserMessage` lo traduciría como "correo o contraseña
          // incorrectos", que en esta pantalla no significa nada.
          const expired = error instanceof ApiError && error.kind === 'unauthorized';
          setFormError(expired ? t('auth.mfa.expired') : toUserMessage(error, t));
        },
        onSettled: () => {
          sending.current = false;
        },
      });
    },
    [verifyMfaMutate, t],
  );

  const onSubmitBackup = useCallback(
    (values: MfaChallengeValues) => submit(values.code.trim()),
    [submit],
  );

  const toggleMode = useCallback(() => {
    setFormError(null);
    setOtp('');
    setUseBackupCode((current) => !current);
  }, []);

  const onCancel = useCallback(() => {
    cancelMfa();
    // `cancelMfa` solo cambia `status` a `'unauthenticated'`; `RouteGuard` no
    // navega fuera de `(auth)` porque ya estamos en ese grupo (ver el guard).
    router.replace('/(auth)/sign-in');
  }, [cancelMfa, router]);

  return (
    <AuthScreen>
      <View style={{ gap: theme.spacing.sm }}>
        <OrbixText size="3xl" weight="medium" align="center" accessibilityRole="header">
          {t('auth.mfa.title')}
        </OrbixText>
        <OrbixText size="md" tone="mutedForeground" align="center">
          {useBackupCode ? t('auth.mfa.backupSubtitle') : t('auth.mfa.subtitle')}
        </OrbixText>
      </View>

      <InlineError message={formError} />

      {useBackupCode ? (
        <>
          <FieldGroup>
            <OrbixTextField
              control={control}
              name="code"
              label={t('auth.mfa.backupCodeLabel')}
              placeholder={t('auth.mfa.backupCodePlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleSubmit(onSubmitBackup)}
            />
          </FieldGroup>

          <OrbixButton
            label={t('auth.mfa.submit')}
            onPress={handleSubmit(onSubmitBackup)}
            loading={isPending}
          />
        </>
      ) : (
        <>
          <OrbixOtpInput
            value={otp}
            onChange={setOtp}
            length={OTP_LENGTH}
            hasError={Boolean(formError)}
            editable={!isPending}
            digitAccessibilityLabel={(index, total) =>
              t('a11y.otpDigit', { index: String(index), total: String(total) })
            }
          />

          <OrbixButton
            label={t('auth.mfa.submit')}
            onPress={() => submit(otp)}
            disabled={otp.length < OTP_LENGTH}
            loading={isPending}
          />
        </>
      )}

      <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
        <Pressable onPress={toggleMode} hitSlop={8} accessibilityRole="button">
          <OrbixText size="sm" weight="medium" tone="primary">
            {useBackupCode ? t('auth.mfa.useAuthenticator') : t('auth.mfa.useBackupCode')}
          </OrbixText>
        </Pressable>

        <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button">
          <OrbixText size="sm" tone="mutedForeground">
            {t('auth.mfa.cancel')}
          </OrbixText>
        </Pressable>
      </View>
    </AuthScreen>
  );
}
