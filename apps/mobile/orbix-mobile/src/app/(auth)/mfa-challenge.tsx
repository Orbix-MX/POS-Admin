/**
 * MFA challenge — segundo paso del login cuando la cuenta tiene 2FA activo.
 *
 * `RouteGuard` redirige aquí en cuanto `status === 'mfa-pending'` (ver
 * `src/app/route-guard.tsx`); esta pantalla es la única alcanzable en ese
 * estado. Acepta un TOTP de 6 dígitos o un backup code.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { FieldGroup, InlineError, OrbixButton, OrbixScaffold, OrbixText, OrbixTextField } from '@/components';
import { buildMfaChallengeSchema, type MfaChallengeValues } from '@/features/auth/schemas';
import { useVerifyMfa } from '@/features/auth/use-auth-mutations';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/utils/error-message';

export default function MfaChallengeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { cancelMfa } = useAuth();

  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(() => buildMfaChallengeSchema(t), [t]);
  const { control, handleSubmit } = useForm<MfaChallengeValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const verifyMfa = useVerifyMfa();

  const onSubmit = useCallback(
    (values: MfaChallengeValues) => {
      setFormError(null);
      verifyMfa.mutate(values.code, {
        onError: (error) => setFormError(toUserMessage(error, t)),
      });
    },
    [verifyMfa, t],
  );

  const onCancel = useCallback(() => {
    cancelMfa();
    // `cancelMfa` solo cambia `status` a `'unauthenticated'`; `RouteGuard` no
    // navega fuera de `(auth)` porque ya estamos en ese grupo (ver el guard).
    router.replace('/(auth)/sign-in');
  }, [cancelMfa, router]);

  return (
    <OrbixScaffold
      scrollable
      topPadding={theme.spacing['4xl']}
      contentStyle={{ gap: theme.spacing.xl + 2 }}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <OrbixText size="2xl" weight="bold" accessibilityRole="header">
          {t('auth.mfa.title')}
        </OrbixText>
        <OrbixText size="base" tone="mutedForeground">
          {t('auth.mfa.subtitle')}
        </OrbixText>
      </View>

      <InlineError message={formError} />

      <FieldGroup>
        <OrbixTextField
          control={control}
          name="code"
          label={t('auth.mfa.codeLabel')}
          placeholder={t('auth.mfa.codePlaceholder')}
          keyboardType="number-pad"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={handleSubmit(onSubmit)}
        />
      </FieldGroup>

      <OrbixButton
        label={t('auth.mfa.submit')}
        onPress={handleSubmit(onSubmit)}
        loading={verifyMfa.isPending}
      />

      <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button">
        <OrbixText size="sm" weight="medium" tone="primary" style={{ textAlign: 'center' }}>
          {t('auth.mfa.cancel')}
        </OrbixText>
      </Pressable>
    </OrbixScaffold>
  );
}
