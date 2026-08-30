/**
 * "Olvidé mi contraseña" — only triggers `POST /auth/forgot-password`. The
 * actual token-based reset stays on the web page the email links to; this
 * screen never asks for a token, to avoid duplicating that flow natively.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AuthScreen, BackButton, FieldGroup, InlineError, OrbixButton, OrbixText, OrbixTextField } from '@/components';
import { buildForgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/schemas';
import { useRequestPasswordReset } from '@/features/settings/use-account';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/utils/error-message';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const schema = useMemo(() => buildForgotPasswordSchema(t), [t]);
  const { control, handleSubmit } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const requestReset = useRequestPasswordReset();

  const onSubmit = useCallback(
    (values: ForgotPasswordValues) => {
      setFormError(null);
      requestReset.mutate(values.email, {
        onSuccess: () => setSentTo(values.email),
        onError: (error) => setFormError(toUserMessage(error, t)),
      });
    },
    [requestReset, t],
  );

  return (
    <AuthScreen
      leading={<BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <OrbixText size="3xl" weight="medium" align="center" accessibilityRole="header">
          {t('auth.forgotPassword.title')}
        </OrbixText>
        <OrbixText size="md" tone="mutedForeground" align="center">
          {t('auth.forgotPassword.subtitle')}
        </OrbixText>
      </View>

      {sentTo ? (
        <OrbixText size="sm" tone="successFg">
          {t('auth.forgotPassword.sent', { email: sentTo })}
        </OrbixText>
      ) : (
        <>
          <InlineError message={formError} />

          <FieldGroup>
            <OrbixTextField
              control={control}
              name="email"
              label={t('auth.fields.email')}
              placeholder={t('auth.fields.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          </FieldGroup>

          <OrbixButton
            label={t('auth.forgotPassword.submit')}
            onPress={handleSubmit(onSubmit)}
            loading={requestReset.isPending}
          />
        </>
      )}

      <Pressable
        onPress={() => router.replace('/(auth)/sign-in')}
        hitSlop={8}
        accessibilityRole="link"
        accessibilityLabel={t('auth.forgotPassword.backToSignIn')}
      >
        <OrbixText size="sm" weight="medium" tone="primary" style={{ textAlign: 'center' }}>
          {t('auth.forgotPassword.backToSignIn')}
        </OrbixText>
      </Pressable>
    </AuthScreen>
  );
}
