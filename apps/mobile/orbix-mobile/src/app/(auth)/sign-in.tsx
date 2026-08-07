/**
 * Sign in — `POST /api/auth/login`.
 *
 * The API answers with a preliminary JWT plus `availableTenants[]`; picking the
 * tenant is a separate step handled by `RouteGuard` once the session lands.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type TextInput } from 'react-native';

import {
  FieldGroup,
  GoogleButton,
  InlineError,
  OrbixButton,
  OrbixScaffold,
  OrbixText,
  OrbixTextField,
  OrDivider,
} from '@/components';
import { buildSignInSchema, type SignInValues } from '@/features/auth/schemas';
import { useSignIn } from '@/features/auth/use-auth-mutations';
import { useGoogleAuth } from '@/features/auth/use-google-auth';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/utils/error-message';

export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const schema = useMemo(() => buildSignInSchema(t), [t]);
  const { control, handleSubmit } = useForm<SignInValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const signIn = useSignIn();
  const google = useGoogleAuth();

  const onSubmit = useCallback(
    (values: SignInValues) => {
      setFormError(null);
      signIn.mutate(values, {
        onError: (error) => setFormError(toUserMessage(error, t)),
      });
    },
    [signIn, t],
  );

  return (
    <OrbixScaffold
      scrollable
      topPadding={theme.spacing['4xl']}
      contentStyle={{ gap: theme.spacing.xl + 2 }}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <OrbixText size="2xl" weight="bold" accessibilityRole="header">
          {t('auth.signIn.title')}
        </OrbixText>
        <OrbixText size="base" tone="mutedForeground">
          {t('auth.signIn.subtitle')}
        </OrbixText>
      </View>

      <InlineError message={formError ?? (google.error ? toUserMessage(google.error, t) : null)} />

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
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <OrbixTextField
          ref={passwordRef}
          control={control}
          name="password"
          label={t('auth.fields.password')}
          placeholder={t('auth.fields.passwordPlaceholder')}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={handleSubmit(onSubmit)}
          rightAdornment={
            <Pressable
              onPress={() => setShowPassword((current) => !current)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.togglePassword')}
            >
              <OrbixText size="xs" weight="semibold" tone="mutedForeground">
                {showPassword ? t('common.hide') : t('common.show')}
              </OrbixText>
            </Pressable>
          }
        />
      </FieldGroup>

      <OrbixButton
        label={t('auth.signIn.submit')}
        onPress={handleSubmit(onSubmit)}
        loading={signIn.isPending}
      />

      {google.available ? (
        <>
          <OrDivider label={t('common.or')} />
          <GoogleButton
            label={t('auth.google.button')}
            onPress={() => void google.signIn()}
            loading={google.isPending}
          />
        </>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
        <OrbixText size="sm" tone="mutedForeground">
          {t('auth.signIn.noAccount')}
        </OrbixText>
        <Pressable
          onPress={() => router.replace('/(auth)/sign-up')}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={t('auth.signIn.signUp')}
        >
          <OrbixText size="sm" weight="medium" tone="primary">
            {t('auth.signIn.signUp')}
          </OrbixText>
        </Pressable>
      </View>
    </OrbixScaffold>
  );
}
