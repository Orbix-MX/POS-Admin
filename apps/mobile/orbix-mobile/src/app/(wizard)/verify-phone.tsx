/**
 * Wizard step 3 — phone verification.
 *
 * Los endpoints ya existen (`POST /auth/phone/send-code` y `/verify-code`),
 * pero **el envío depende de que haya un proveedor de SMS contratado**, y hoy
 * no lo hay: sin él el servidor responde 503.
 *
 * La pantalla degrada ante ese 503 exactamente como antes degradaba ante la
 * ausencia del endpoint — dice que la verificación no está disponible y deja
 * continuar con `phoneVerified: false`. No se falsea ningún código: enseñar un
 * flujo que no es el real es peor que admitir que falta una pieza.
 *
 * Todo lo demás es de verdad: las seis casillas, el autoavance, el enfriamiento
 * de 60 s y las transiciones verificando/verificado. El día que se contrate el
 * proveedor, solo sale la cláusula del 503.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import {
  CheckIcon,
  InlineError,
  OrbixButton,
  OrbixOtpInput,
  OrbixScaffold,
  OrbixSpinner,
  OrbixText,
} from '@/components';
import { WizardHeader } from '@/features/tenant/wizard-header';
import {
  useSendPhoneCode,
  useVerifyPhoneCode,
} from '@/features/tenant/use-tenant-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { useWizard } from '@/providers';
import { NotImplementedError } from '@/services/api';
import { isServiceUnavailable, toUserMessage } from '@/utils/error-message';

const RESEND_SECONDS = 60;
const OTP_LENGTH = 6;

type Phase = 'idle' | 'verifying' | 'success';

export default function VerifyPhoneScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { draft, totalSteps, update, goToStep } = useWizard();

  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [verificationUnavailable, setVerificationUnavailable] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const verificationId = useRef<string | null>(draft.verificationId ?? null);

  const sendCode = useSendPhoneCode();
  const verifyCode = useVerifyPhoneCode();

  useEffect(() => {
    goToStep(3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Resend cooldown ───────────────────────────────────────────────────── */

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  /* ── Send ──────────────────────────────────────────────────────────────── */

  const requestCode = useCallback(() => {
    setError(null);
    sendCode.mutate(
      { phone: draft.phone, countryCode: draft.countryCode },
      {
        onSuccess: (response) => {
          verificationId.current = response.verificationId;
          update({ verificationId: response.verificationId });
          setSecondsLeft(response.resendAfterSeconds || RESEND_SECONDS);
        },
        onError: (sendError) => {
          // 503 = no hay proveedor de SMS detrás. No es un fallo del usuario
          // ni de la red: es una pieza que falta, y el wizard sigue sin ella.
          if (isServiceUnavailable(sendError) || sendError instanceof NotImplementedError) {
            setVerificationUnavailable(true);
            return;
          }
          setError(toUserMessage(sendError, t));
        },
      },
    );
  }, [sendCode, draft.phone, draft.countryCode, update, t]);

  // Fire once when the step opens.
  useEffect(() => {
    requestCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Verify ────────────────────────────────────────────────────────────── */

  const goToSuccess = useCallback(
    (verified: boolean) => {
      update({ phoneVerified: verified, step: 4 });
      router.push('/(wizard)/success');
    },
    [update, router],
  );

  const onComplete = useCallback(
    (value: string) => {
      if (!verificationId.current) return;
      setPhase('verifying');
      setError(null);

      verifyCode.mutate(
        { verificationId: verificationId.current, code: value },
        {
          onSuccess: (response) => {
            if (!response.verified) {
              setPhase('idle');
              setError(t('wizard.step3.invalidCode'));
              return;
            }
            setPhase('success');
            // Brief hold on the success state before advancing, as in the design.
            setTimeout(() => goToSuccess(true), 700);
          },
          onError: (verifyError) => {
            setPhase('idle');
            setError(toUserMessage(verifyError, t));
          },
        },
      );
    },
    [verifyCode, t, goToSuccess],
  );

  const last2 = draft.phone.slice(-2) || '••';
  const canResend = secondsLeft === 0 && !verificationUnavailable;

  return (
    <OrbixScaffold
      scrollable
      topPadding={theme.spacing.md}
      contentStyle={{ gap: theme.spacing.xl }}
    >
      <WizardHeader step={3} totalSteps={totalSteps} onBack={() => router.back()} />

      <View style={{ gap: theme.spacing.xs }}>
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t('wizard.step3.title')}
        </OrbixText>
        <OrbixText size="base" tone="mutedForeground">
          {t('wizard.step3.subtitle', { last2 })}
        </OrbixText>
      </View>

      <InlineError message={error} />

      {verificationUnavailable ? (
        // TODO(backend): remove once POST /auth/phone/send-code exists.
        <View style={{ gap: theme.spacing.lg }}>
          <InlineError message={t('errors.notImplemented')} />
          <OrbixButton label={t('common.continue')} onPress={() => goToSuccess(false)} />
        </View>
      ) : (
        <>
          <OrbixOtpInput
            value={code}
            onChange={setCode}
            onComplete={onComplete}
            length={OTP_LENGTH}
            hasError={Boolean(error)}
            editable={phase === 'idle'}
            digitAccessibilityLabel={(index, total) =>
              t('a11y.otpDigit', { index: String(index), total: String(total) })
            }
          />

          {phase === 'idle' ? (
            <View style={{ alignItems: 'center' }}>
              {canResend ? (
                <Pressable
                  onPress={requestCode}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('wizard.step3.resend')}
                >
                  <OrbixText size="sm" weight="semibold" tone="primary">
                    {t('wizard.step3.resend')}
                  </OrbixText>
                </Pressable>
              ) : (
                <OrbixText size="sm" tone="mutedForeground">
                  {t('wizard.step3.resendIn', { seconds: String(secondsLeft) })}
                </OrbixText>
              )}
            </View>
          ) : null}

          {phase === 'verifying' ? (
            <Animated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.spacing.sm,
              }}
              accessibilityLiveRegion="polite"
            >
              <OrbixSpinner size={16} />
              <OrbixText size="base" tone="mutedForeground">
                {t('wizard.step3.verifying')}
              </OrbixText>
            </Animated.View>
          ) : null}

          {phase === 'success' ? (
            <Animated.View
              entering={FadeIn.duration(180)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.spacing.sm,
              }}
              accessibilityLiveRegion="polite"
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.successFg,
                }}
              >
                <CheckIcon size={9} color={theme.colors.card} />
              </View>
              <OrbixText size="base" weight="semibold" tone="successFg">
                {t('wizard.step3.verified')}
              </OrbixText>
            </Animated.View>
          ) : null}
        </>
      )}
    </OrbixScaffold>
  );
}
