/**
 * Account creation — `POST /api/auth/register`.
 *
 * Twin of the sign-in screen: same floating `AuthScreen` panel and section
 * order, with the name field added and the password toggle rendered as a text
 * button inside the input (the DS choice, not an eye icon).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type TextInput } from 'react-native';

import {
  AuthScreen,
  BackButton,
  FieldGroup,
  GoogleButton,
  InlineError,
  OrbixButton,
  OrbixText,
  OrbixTextField,
  OrDivider,
} from '@/components';
import { useSignUp } from '@/features/auth/use-auth-mutations';
import { useGoogleAuth } from '@/features/auth/use-google-auth';
import { buildSignUpSchema, type SignUpValues } from '@/features/auth/schemas';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/utils/error-message';

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const schema = useMemo(() => buildSignUpSchema(t), [t]);
  const { control, handleSubmit } = useForm<SignUpValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
    // Validate on blur, then live once a field has already errored — validating
    // on every keystroke from the start flags a half-typed email as invalid.
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const signUp = useSignUp();
  const google = useGoogleAuth();

  const onSubmit = useCallback(
    (values: SignUpValues) => {
      setFormError(null);
      signUp.mutate(values, {
        onError: (error) => setFormError(toUserMessage(error, t)),
      });
    },
    [signUp, t],
  );

  const onGooglePress = useCallback(() => {
    setFormError(null);
    void google.signIn().catch((error: unknown) => setFormError(toUserMessage(error, t)));
  }, [google, t]);

  return (
    <AuthScreen
      leading={<BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <OrbixText size="3xl" weight="medium" align="center" accessibilityRole="header">
          {t('auth.signUp.title')}
        </OrbixText>
        <OrbixText size="md" tone="mutedForeground" align="center">
          {t('auth.signUp.subtitle')}
        </OrbixText>
      </View>

      <InlineError message={formError ?? (google.error ? toUserMessage(google.error, t) : null)} />

      {google.available ? (
        <>
          <GoogleButton
            label={t('auth.google.button')}
            onPress={onGooglePress}
            loading={google.isPending}
          />
          <OrDivider label={t('common.or')} />
        </>
      ) : null}

      <FieldGroup>
        <OrbixTextField
          control={control}
          name="name"
          label={t('auth.fields.name')}
          placeholder={t('auth.fields.namePlaceholder')}
          autoCapitalize="words"
          textContentType="name"
          autoComplete="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <OrbixTextField
          ref={emailRef}
          control={control}
          name="email"
          label={t('auth.fields.email')}
          placeholder={t('auth.fields.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
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
          textContentType="newPassword"
          autoComplete="new-password"
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
        label={t('auth.signUp.submit')}
        onPress={handleSubmit(onSubmit)}
        loading={signUp.isPending}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
        <OrbixText size="sm" tone="mutedForeground">
          {t('auth.signUp.haveAccount')}
        </OrbixText>
        <Pressable
          onPress={() => router.replace('/(auth)/sign-in')}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={t('auth.signUp.signIn')}
        >
          <OrbixText size="sm" weight="medium" tone="primary">
            {t('auth.signUp.signIn')}
          </OrbixText>
        </Pressable>
      </View>
    </AuthScreen>
  );
}
