/**
 * Account creation — `POST /api/auth/register`.
 *
 * Matches the prototype's sign-up screen field for field. The password toggle
 * is a text button inside the input, as in the design, rather than an eye icon.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type TextInput } from 'react-native';

import {
  BackButton,
  FieldGroup,
  GoogleButton,
  InlineError,
  OrbixButton,
  OrbixScaffold,
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
    <OrbixScaffold scrollable topPadding={theme.spacing.md} contentStyle={{ gap: theme.spacing.xl + 2 }}>
      <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />

      <View style={{ gap: theme.spacing.xs }}>
        <OrbixText size="2xl" weight="bold" accessibilityRole="header">
          {t('auth.signUp.title')}
        </OrbixText>
        <OrbixText size="base" tone="mutedForeground">
          {t('auth.signUp.subtitle')}
        </OrbixText>
      </View>

      <InlineError message={formError ?? (google.error ? toUserMessage(google.error, t) : null)} />

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

      {google.available ? (
        <>
          <OrDivider label={t('common.or')} />
          <GoogleButton
            label={t('auth.google.button')}
            onPress={onGooglePress}
            loading={google.isPending}
          />
        </>
      ) : null}

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
    </OrbixScaffold>
  );
}
